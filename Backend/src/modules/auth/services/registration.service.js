/**
 * Registration Service
 * Handles different types of user registration
 */

const mongoose = require("mongoose");
const User = require("../models/user.model");
const Organization = require("../../organization/models/organization.model");
const Team = require("../../team/models/team.model");
const InviteCode = require("../../organization/models/inviteCode.model");
const { AuthError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const organizationService = require("../../organization/services/organization.service");
const teamService = require("../../team/services/team.service");
const inviteCodeService = require("../../organization/services/inviteCode.service");
const { USER_ROLES } = require("../constants/roles.constant");

/**
 * Register a new user (base function)
 * @param {Object} userData - User data
 * @param {mongoose.ClientSession} [session] - MongoDB session for transactions
 * @returns {Promise<Object>} User and verification token
 */
exports.registerUser = async (userData, session = null) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role = USER_ROLES.CUSTOMER,
    } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AuthError("Email already in use", "EMAIL_IN_USE");
    }

    // Validate password format before hashing
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new AuthError(
        "Password must contain uppercase, lowercase, number, and special character",
        "INVALID_PASSWORD_FORMAT"
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with session if provided
    const userDoc = {
      email,
      profile: {
        firstName,
        lastName,
      },
      security: {
        password: hashedPassword,
        emailVerified: false,
      },
      role,
      organizationId: userData.organizationId || null,
    };

    const user = session
      ? await User.create([userDoc], { session }).then((docs) => docs[0])
      : await User.create(userDoc);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Store verification token (in a real app, you'd hash this)
    user.security.verificationToken = verificationToken;
    user.security.verificationTokenExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ); // 24 hours

    // Save with session if provided
    if (session) {
      await user.save({ session });
    } else {
      await user.save();
    }

    logger.info(`User registered: ${user.email}`);

    return { user, verificationToken };
  } catch (error) {
    logger.error("Error registering user:", error);
    throw error;
  }
};

/**
 * Register a new organization with admin user
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} User, organization, and verification token
 */
exports.registerOrganization = async (data) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      organizationName,
      organizationType,
    } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AuthError("Email already in use", "EMAIL_IN_USE");
    }

    // Log organization data before creation
    logger.debug("Organization registration data:", {
      organizationName,
      organizationType,
    });

    if (!organizationName) {
      logger.error("Organization name is missing in registration data");
      throw new AuthError("Organization name is required", "MISSING_ORG_NAME");
    }

    // Create organization first
    const organization = await organizationService.createOrganization(
      {
        name: organizationName,
        type: organizationType, // Default value is set in the schema
      },
      null // We'll update this after creating the user
    );

    try {
      // Register admin user
      const { user, verificationToken } = await this.registerUser({
        email,
        password,
        firstName,
        lastName,
        role: USER_ROLES.ADMIN,
        organizationId: organization._id,
      });

      // Update organization with owner
      logger.info(`Setting organization owner to user ID: ${user._id}`);
      organization.owner = user._id;
      await organization.save();
      logger.info(`Successfully updated organization with owner: ${user._id}`);

      try {
        // Create default teams (technical and support) with organization ID
        const technicalTeam = await teamService.createTeam(
          {
            name: "Technical Team",
            description: "Default technical team",
            teamType: "technical",
            organizationId: organization._id,
          },
          user._id
        );

        const supportTeam = await teamService.createTeam(
          {
            name: "Support Team",
            description: "Default support team",
            teamType: "support",
            organizationId: organization._id,
          },
          user._id
        );

        // Add teams to organization
        await organizationService.addTeamToOrganization(
          organization._id,
          technicalTeam._id
        );
        await organizationService.addTeamToOrganization(
          organization._id,
          supportTeam._id
        );

        logger.info(
          `Organization registered: ${organization.name} with admin: ${user.email}`
        );

        return { user, organization, verificationToken };
      } catch (teamError) {
        // If there's an error creating teams, clean up
        logger.error(
          "Error creating teams during organization registration:",
          teamError
        );

        // Clean up the user
        await User.findByIdAndDelete(user._id);

        // Clean up the organization
        await Organization.findByIdAndDelete(organization._id);

        throw teamError;
      }
    } catch (userError) {
      // If there's an error creating the user, clean up the organization
      logger.error(
        "Error creating user during organization registration:",
        userError
      );
      await Organization.findByIdAndDelete(organization._id);
      throw userError;
    }
  } catch (error) {
    logger.error("Error registering organization:", error);
    throw error;
  }
};

/**
 * Register a new member using invitation code
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} User, team, and verification token
 */
exports.registerWithInviteCode = async (data) => {
  try {
    const { email, password, firstName, lastName, inviteCode } = data;

    // Validate invitation code
    const validation = await inviteCodeService.validateInviteCode(inviteCode);

    if (!validation.isValid) {
      throw new AuthError(
        validation.message || "Invalid invitation code",
        "INVALID_INVITE_CODE"
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AuthError("Email already in use", "EMAIL_IN_USE");
    }

    // Get organization and team from validation result
    const { organization, team, inviteCode: inviteCodeData } = validation;

    // Determine role based on invitation code and team type
    let role;
    if (inviteCodeData.role === "team_lead") {
      role = USER_ROLES.TEAM_LEAD;
    } else if (team && team.type === "technical") {
      role = USER_ROLES.TECHNICAL;
    } else {
      role = USER_ROLES.SUPPORT;
    }

    // Register user
    const { user, verificationToken } = await this.registerUser({
      email,
      password,
      firstName,
      lastName,
      role,
      organizationId: organization.id,
    });

    // Add user to team if team exists
    if (team) {
      const teamDoc = await Team.findById(team.id);

      // Add user to team members
      if (!teamDoc.members.includes(user._id)) {
        teamDoc.members.push(user._id);
      }

      // If user is a team lead, update team with the lead
      if (role === "team_lead") {
        teamDoc.teamLead = user._id;
      }

      await teamDoc.save();

      // Update user with team ID
      user.teamId = team.id;
      await user.save();
    }

    // Mark invite code as used
    await inviteCodeService.useInviteCode(inviteCode, user._id);

    logger.info(
      `User registered with invitation code: ${user.email} for organization: ${organization.name}`
    );

    return {
      user,
      team: team || null,
      organization: {
        _id: organization.id,
        name: organization.name,
      },
      verificationToken,
    };
  } catch (error) {
    logger.error("Error registering with invitation code:", error);
    throw error;
  }
};

/**
 * Register a new customer for an organization
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} User, organization, and verification token
 */
exports.registerCustomer = async (data) => {
  try {
    const { email, password, firstName, lastName, orgId } = data;

    // Validate organization ID
    const validation = await organizationService.validateOrgId(orgId);

    if (!validation.isValid) {
      throw new AuthError(
        validation.message || "Invalid organization ID",
        "INVALID_ORGANIZATION_ID"
      );
    }

    // Get organization
    const organization = await Organization.findOne({ orgId });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AuthError("Email already in use", "EMAIL_IN_USE");
    }

    // Register customer
    const { user, verificationToken } = await this.registerUser({
      email,
      password,
      firstName,
      lastName,
      role: USER_ROLES.CUSTOMER,
      organizationId: organization._id,
    });

    // Add customer to organization
    await organizationService.addCustomerToOrganization(
      organization._id,
      user._id
    );

    logger.info(
      `Customer registered: ${user.email} for organization: ${organization.name}`
    );

    return { user, organization, verificationToken };
  } catch (error) {
    logger.error("Error registering customer:", error);
    throw error;
  }
};
