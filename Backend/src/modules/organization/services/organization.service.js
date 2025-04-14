/**
 * Organization Service
 * Handles business logic for organization management
 */

const Organization = require("../models/organization.model");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");

/**
 * Create a new organization
 * @param {Object} orgData - Organization data
 * @param {string} userId - User ID of the organization owner
 * @returns {Promise<Organization>} Created organization
 */
exports.createOrganization = async (orgData, userId) => {
  try {
    // Check if organization name already exists
    const existingOrg = await Organization.findOne({ name: orgData.name });
    if (existingOrg) {
      throw new ApiError(400, "Organization name already exists");
    }

    // Generate unique organization ID
    const orgId = await Organization.generateOrgId();

    // Create organization
    const organizationData = {
      name: orgData.name,
      description: orgData.description || `${orgData.name} organization`,
      orgId,
      status: "active",
      type: orgData.type, // Default value is set in the schema
    };

    // Only set owner if provided (will be updated later in registration flow if not provided)
    if (userId) {
      logger.info(`Setting initial organization owner to: ${userId}`);
      organizationData.owner = userId;
    } else {
      logger.info(
        "No userId provided for organization owner, will be set later"
      );
    }

    logger.info(
      `Creating organization with data: ${JSON.stringify(organizationData)}`
    );
    try {
      const organization = await Organization.create(organizationData);
      logger.info(
        `Organization created successfully with ID: ${organization._id}`
      );
      return organization;
    } catch (createError) {
      logger.error(
        `Error creating organization: ${createError.message}`,
        createError
      );
      throw createError;
    }
  } catch (error) {
    logger.error("Error creating organization:", error);
    throw error;
  }
};

/**
 * Get organization by ID
 * @param {string} id - Organization ID
 * @returns {Promise<Organization>} Organization
 */
exports.getOrganizationById = async (id) => {
  try {
    const organization = await Organization.findById(id);
    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }
    return organization;
  } catch (error) {
    logger.error(`Error fetching organization with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Validate organization ID format
 * @param {string} orgId - Organization ID to validate
 * @returns {boolean} True if valid format
 */
const isValidOrgIdFormat = (orgId) => {
  return /^ORG-[A-Z0-9]{5}$/.test(orgId);
};

/**
 * Get organization by orgId
 * @param {string} orgId - Organization unique ID
 * @returns {Promise<Organization>} Organization
 */
exports.getOrganizationByOrgId = async (orgId) => {
  try {
    // Validate format first
    if (!isValidOrgIdFormat(orgId)) {
      throw new ApiError(
        400,
        "Invalid organization ID format. Expected format: ORG-XXXXX"
      );
    }

    const organization = await Organization.findOne({ orgId });
    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }
    return organization;
  } catch (error) {
    logger.error(`Error fetching organization with orgId ${orgId}:`, error);
    throw error;
  }
};

/**
 * Update organization
 * @param {string} id - Organization ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Organization>} Updated organization
 */
exports.updateOrganization = async (id, updateData) => {
  try {
    // Check if organization exists
    const organization = await Organization.findById(id);
    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    // Check if name is being updated and if it's unique
    if (updateData.name && updateData.name !== organization.name) {
      const existingOrg = await Organization.findOne({ name: updateData.name });
      if (existingOrg) {
        throw new ApiError(400, "Organization name already exists");
      }
    }

    // Update organization
    Object.keys(updateData).forEach((key) => {
      organization[key] = updateData[key];
    });

    await organization.save();
    logger.info(`Organization updated: ${organization.name}`);

    return organization;
  } catch (error) {
    logger.error(`Error updating organization with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Add team to organization
 * @param {string} orgId - Organization ID
 * @param {string} teamId - Team ID to add
 * @returns {Promise<Organization>} Updated organization
 */
exports.addTeamToOrganization = async (orgId, teamId) => {
  try {
    const organization = await Organization.findById(orgId);
    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    await organization.addTeam(teamId);
    logger.info(`Team ${teamId} added to organization ${organization.name}`);

    return organization;
  } catch (error) {
    logger.error(`Error adding team to organization:`, error);
    throw error;
  }
};

/**
 * Add customer to organization
 * @param {string} orgId - Organization ID
 * @param {string} customerId - Customer ID to add
 * @returns {Promise<Organization>} Updated organization
 */
exports.addCustomerToOrganization = async (orgId, customerId) => {
  try {
    const organization = await Organization.findById(orgId);
    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    await organization.addCustomer(customerId);
    logger.info(
      `Customer ${customerId} added to organization ${organization.name}`
    );

    return organization;
  } catch (error) {
    logger.error(`Error adding customer to organization:`, error);
    throw error;
  }
};

/**
 * Get all organizations
 * @param {Object} filters - Optional filters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Organizations and pagination info
 */
exports.getAllOrganizations = async (filters = {}, page = 1, limit = 10) => {
  try {
    const query = { ...filters };
    const skip = (page - 1) * limit;

    // Get organizations with pagination
    const organizations = await Organization.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "profile.firstName profile.lastName email")
      .lean();

    // Get total count
    const total = await Organization.countDocuments(query);

    return {
      organizations,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error fetching organizations:", error);
    throw error;
  }
};

/**
 * Validate organization ID
 * @param {string} orgId - Organization ID to validate
 * @returns {Promise<Object>} Object with isValid flag and organization data if valid
 */
exports.validateOrgId = async (orgId) => {
  try {
    // Check if the orgId follows the expected format
    if (!isValidOrgIdFormat(orgId)) {
      return {
        isValid: false,
        message: "Invalid organization ID format. Expected format: ORG-XXXXX",
      };
    }

    const organization = await Organization.findOne({ orgId });

    if (!organization) {
      return { isValid: false, message: "Organization not found" };
    }

    // Check if organization is active
    if (organization.status !== "active") {
      return {
        isValid: false,
        message: "Organization is not active",
        status: organization.status,
      };
    }

    return {
      isValid: true,
      message: "Valid organization ID",
      organizationName: organization.name,
      organizationType: organization.type,
    };
  } catch (error) {
    logger.error(`Error validating organization ID ${orgId}:`, error);
    return { isValid: false, message: "Error validating organization ID" };
  }
};
