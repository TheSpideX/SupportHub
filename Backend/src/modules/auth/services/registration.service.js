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

    // Create user with session if provided
    // Let the User model's pre-save middleware handle password hashing
    const userDoc = {
      email,
      profile: {
        firstName,
        lastName,
      },
      security: {
        password: password, // Pass the plain password, let model middleware hash it
        emailVerified: false,
      },
      role,
      organizationId: userData.organizationId || null,
    };

    // Log for debugging
    logger.debug(
      `Creating user with email: ${email} and letting model hash password`
    );

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

    // Try to validate the invitation code using both systems
    let validation;
    let isTeamInvite = false;

    try {
      // First try organization invite code system
      validation = await inviteCodeService.validateInviteCode(inviteCode);

      if (!validation.isValid) {
        // If organization invite code is invalid, try team invite code system
        const teamService = require("../../team/services/team.service");
        const team = await teamService.findTeamByInvitationCode(inviteCode);

        if (team) {
          // Found a valid team invitation code
          isTeamInvite = true;
          const invitationCode = team.invitationCodes.find(
            (c) => c.code === inviteCode
          );

          // Create a validation result in the same format as organization invite codes
          validation = {
            isValid: true,
            message: "Valid team invitation code",
            inviteCode: {
              code: invitationCode.code,
              role: invitationCode.role,
              expiresAt: invitationCode.expiresAt,
            },
            organization: {
              id: team.organizationId,
              name: "Organization", // Will be populated later
            },
            team: {
              id: team._id,
              name: team.name,
              type: team.teamType,
            },
          };

          // Use metadata if available
          if (invitationCode.metadata) {
            logger.info(
              `Using metadata from invitation code: ${JSON.stringify(
                invitationCode.metadata
              )}`
            );

            // Update validation with metadata information
            validation.organization.id = invitationCode.metadata.organizationId;
            validation.organization.name =
              invitationCode.metadata.organizationName;
            validation.team.id = invitationCode.metadata.teamId;
            validation.team.name = invitationCode.metadata.teamName;
            validation.team.type = invitationCode.metadata.teamType;
            validation.inviteCode.role = invitationCode.metadata.position;
          } else {
            // Fallback to populating organization info manually
            logger.info(
              `No metadata found in invitation code, populating manually`
            );
            const Organization = require("../../organization/models/organization.model");
            const org = await Organization.findById(team.organizationId);
            if (org) {
              validation.organization.name = org.name;
              validation.organization.orgId = org.orgId;
              validation.organization.type = org.type;
            }
          }

          logger.info(
            `Using team invitation code: ${inviteCode} for team ${team.name}`
          );
        } else {
          // Neither organization nor team invitation code is valid
          throw new AuthError("Invalid invitation code", "INVALID_INVITE_CODE");
        }
      }
    } catch (error) {
      if (error.code === "INVALID_INVITE_CODE") {
        throw error;
      }
      logger.error(`Error validating invitation code: ${error.message}`, error);
      throw new AuthError(
        "Error validating invitation code",
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

    // Log the invitation code data for debugging
    logger.debug(`Invitation code data: ${JSON.stringify(inviteCodeData)}`);

    // Check if we have metadata with position information
    const metadata = validation.metadata || (team && team.metadata);
    const position = metadata ? metadata.position : inviteCodeData.role;

    logger.info(
      `Position from invitation code: ${position}, Role from inviteCode: ${inviteCodeData.role}`
    );

    // Handle different role naming conventions between team and user systems
    if (
      position === "lead" ||
      inviteCodeData.role === "lead" ||
      position === "team_lead" ||
      inviteCodeData.role === "team_lead"
    ) {
      role = USER_ROLES.TEAM_LEAD;
      logger.info(
        `Assigning team_lead role to user based on invitation code role: ${
          position || inviteCodeData.role
        }`
      );
    } else if (team && team.type === "technical") {
      role = USER_ROLES.TECHNICAL;
      logger.info(
        `Assigning technical role to user based on team type: ${team.type}`
      );
    } else {
      role = USER_ROLES.SUPPORT;
      logger.info(`Assigning support role to user (default)`);
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

      // Add user to team members properly using the addMember method
      await teamDoc.addMember({
        userId: user._id,
        role: role === "team_lead" ? "lead" : "member",
        invitedBy: inviteCodeData.createdBy || null,
      });

      // Update user with team ID
      user.teamId = team.id;
      await user.save();

      logger.info(
        `User ${user.email} added to team ${teamDoc.name} with role ${role}`
      );
    }

    // Mark invite code as used
    if (isTeamInvite) {
      // For team invitation codes
      const teamService = require("../../team/services/team.service");
      const team = await teamService.findTeamByInvitationCode(inviteCode);

      if (team) {
        // Find the code and mark it as used
        const codeIndex = team.invitationCodes.findIndex(
          (c) => c.code === inviteCode
        );
        if (codeIndex !== -1) {
          team.invitationCodes[codeIndex].isUsed = true;
          team.invitationCodes[codeIndex].usedBy = user._id;
          team.invitationCodes[codeIndex].usedAt = new Date();
          await team.save();
          logger.info(
            `Team invitation code ${inviteCode} marked as used by user ${user._id}`
          );
        }
      }
    } else {
      // For organization invitation codes
      await inviteCodeService.useInviteCode(inviteCode, user._id);
    }

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
