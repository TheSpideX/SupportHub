/**
 * Registration Service
 * Handles different types of user registration
 */

const User = require("../models/user.model");
const Organization = require("../../organization/models/organization.model");
const Team = require("../../team/models/team.model");
const { AuthError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const organizationService = require("../../organization/services/organization.service");
const teamService = require("../../team/services/team.service");

/**
 * Register a new user (base function)
 * @param {Object} userData - User data
 * @returns {Promise<Object>} User and verification token
 */
exports.registerUser = async (userData) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role = "customer",
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

    // Create user
    const user = await User.create({
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
      organization: userData.organization || null,
    });

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Store verification token (in a real app, you'd hash this)
    user.security.verificationToken = verificationToken;
    user.security.verificationTokenExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ); // 24 hours

    await user.save();

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

    // Create organization first
    const organization = await organizationService.createOrganization(
      {
        name: organizationName,
        type: organizationType, // Default value is set in the schema
      },
      null // We'll update this after creating the user
    );

    // Register admin user
    const { user, verificationToken } = await this.registerUser({
      email,
      password,
      firstName,
      lastName,
      role: "admin",
      organization: organization._id,
    });

    // Update organization with owner
    logger.info(`Setting organization owner to user ID: ${user._id}`);
    organization.owner = user._id;
    try {
      await organization.save();
      logger.info(`Successfully updated organization with owner: ${user._id}`);
    } catch (saveError) {
      logger.error(
        `Error saving organization with owner: ${saveError.message}`,
        saveError
      );
      throw saveError;
    }

    // Create default teams (technical and support)
    const technicalTeam = await teamService.createTeam(
      {
        name: "Technical Team",
        description: "Default technical team",
        teamType: "technical",
      },
      user._id
    );

    const supportTeam = await teamService.createTeam(
      {
        name: "Support Team",
        description: "Default support team",
        teamType: "support",
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
  } catch (error) {
    logger.error("Error registering organization:", error);
    throw error;
  }
};

/**
 * Register a new member using invitation code
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} User and verification token
 */
exports.registerWithInviteCode = async (data) => {
  try {
    const { email, password, firstName, lastName, inviteCode } = data;

    // Validate invitation code
    const team = await Team.findOne({
      "invitationCodes.code": inviteCode,
      "invitationCodes.isUsed": false,
      "invitationCodes.expiresAt": { $gt: new Date() },
    });

    if (!team) {
      throw new AuthError(
        "Invalid or expired invitation code",
        "INVALID_INVITE_CODE"
      );
    }

    // Get the specific invitation code
    const invitationCode = team.invitationCodes.find(
      (code) => code.code === inviteCode
    );

    // Determine role based on invitation code
    const userRole =
      invitationCode.role === "lead"
        ? "team_lead"
        : team.teamType === "technical"
        ? "technical"
        : "support";

    // Get organization ID from team creator
    const teamCreator = await User.findById(team.createdBy);
    if (!teamCreator || !teamCreator.organization) {
      throw new AuthError(
        "Team creator or organization not found",
        "ORGANIZATION_NOT_FOUND"
      );
    }

    // Register user
    const { user, verificationToken } = await this.registerUser({
      email,
      password,
      firstName,
      lastName,
      role: userRole,
      organization: teamCreator.organization,
    });

    // Add user to team
    await team.addMember({
      userId: user._id,
      role: invitationCode.role,
      invitedBy: invitationCode.createdBy,
    });

    // Mark invitation code as used
    invitationCode.isUsed = true;
    invitationCode.usedBy = user._id;
    invitationCode.usedAt = new Date();
    await team.save();

    logger.info(
      `User registered with invitation code: ${user.email} for team: ${team.name}`
    );

    return { user, team, verificationToken };
  } catch (error) {
    logger.error("Error registering with invitation code:", error);
    throw error;
  }
};

/**
 * Register a new customer for an organization
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} User and verification token
 */
exports.registerCustomer = async (data) => {
  try {
    const { email, password, firstName, lastName, orgId } = data;

    // Validate organization ID
    const organization = await Organization.findOne({ orgId });
    if (!organization) {
      throw new AuthError(
        "Invalid organization ID. Please check the ID and try again.",
        "INVALID_ORGANIZATION_ID"
      );
    }

    // Check if organization is active
    if (organization.status !== "active") {
      throw new AuthError(
        "The organization is not active. Please contact the organization administrator.",
        "ORGANIZATION_INACTIVE"
      );
    }

    // Register customer
    const { user, verificationToken } = await this.registerUser({
      email,
      password,
      firstName,
      lastName,
      role: "customer",
      organization: organization._id,
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
