/**
 * Organization Controller
 * Handles HTTP requests for organization management
 */

const organizationService = require("../services/organization.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const { sendSuccess, sendError } = require("../../../utils/apiResponse");
const asyncHandler = require("../../../utils/asyncHandler");
const { formatOrganizationResponse } = require("../utils/format.utils");

/**
 * Create a new organization
 * @route POST /api/organizations
 * @access Private - Admin only
 */
exports.createOrganization = asyncHandler(async (req, res) => {
  const { name, description, type } = req.body;
  const userId = req.user._id;

  const organization = await organizationService.createOrganization(
    { name, description, type },
    userId
  );

  // Format the response to match frontend expectations
  const formattedOrganization = formatOrganizationResponse(organization);

  res.status(201).json({
    success: true,
    data: formattedOrganization,
  });
});

/**
 * Get all organizations
 * @route GET /api/organizations
 * @access Private - Admin only
 */
exports.getAllOrganizations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, ...filters } = req.query;

  const result = await organizationService.getAllOrganizations(
    filters,
    parseInt(page),
    parseInt(limit)
  );

  res.status(200).json({
    success: true,
    data: result.organizations,
    pagination: result.pagination,
  });
});

/**
 * Get organization by ID
 * @route GET /api/organizations/:id
 * @access Private - Admin or organization member
 */
exports.getOrganizationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organization = await organizationService.getOrganizationById(id);

  // Check if user has access to this organization
  if (
    (req.user.role !== "admin" &&
      organization.owner.toString() !== req.user._id.toString() &&
      !req.user.organizationId) ||
    req.user.organizationId.toString() !== organization._id.toString()
  ) {
    throw new ApiError(403, "You don't have access to this organization");
  }

  // Format the response to match frontend expectations
  const formattedOrganization = formatOrganizationResponse(organization);

  return sendSuccess(
    res,
    formattedOrganization,
    "Organization retrieved successfully"
  );
});

/**
 * Get organization by orgId
 * @route GET /api/organizations/org/:orgId
 * @access Public - For customer registration
 */
exports.getOrganizationByOrgId = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const organization = await organizationService.getOrganizationByOrgId(orgId);

  // Return limited information for public access
  return sendSuccess(
    res,
    formatOrganizationResponse(organization, false), // false = don't include details
    "Organization found"
  );
});

/**
 * Update organization
 * @route PUT /api/organizations/:id
 * @access Private - Admin or organization owner
 */
exports.updateOrganization = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user._id;

  // Get organization to check ownership
  const organization = await organizationService.getOrganizationById(id);

  // Check if user has permission to update
  if (
    req.user.role !== "admin" &&
    organization.owner.toString() !== userId.toString()
  ) {
    throw new ApiError(
      403,
      "You don't have permission to update this organization"
    );
  }

  const updatedOrganization = await organizationService.updateOrganization(
    id,
    updateData
  );

  // Format the response to match frontend expectations
  const formattedOrganization = formatOrganizationResponse(updatedOrganization);

  res.status(200).json({
    success: true,
    data: formattedOrganization,
  });
});

/**
 * Validate organization ID
 * @route GET /api/organizations/validate/:orgId
 * @access Public - For customer registration
 */
exports.validateOrgId = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const validationResult = await organizationService.validateOrgId(orgId);

  res.status(200).json({
    success: true,
    ...validationResult,
  });
});

/**
 * Add team to organization
 * @route POST /api/organizations/:id/teams
 * @access Private - Admin or organization owner
 */
exports.addTeamToOrganization = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { teamId } = req.body;

  if (!teamId) {
    throw new ApiError(400, "Team ID is required");
  }

  // Get organization to check ownership
  const organization = await organizationService.getOrganizationById(id);

  // Check if user has permission
  if (
    req.user.role !== "admin" &&
    organization.owner.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(
      403,
      "You don't have permission to update this organization"
    );
  }

  const updatedOrganization = await organizationService.addTeamToOrganization(
    id,
    teamId
  );

  // Format the response to match frontend expectations
  const formattedOrganization = formatOrganizationResponse(updatedOrganization);

  res.status(200).json({
    success: true,
    data: formattedOrganization,
  });
});

/**
 * Add customer to organization
 * @route POST /api/organizations/:id/customers
 * @access Private - Admin or organization owner
 */
exports.addCustomerToOrganization = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { customerId } = req.body;

  if (!customerId) {
    throw new ApiError(400, "Customer ID is required");
  }

  // Get organization to check ownership
  const organization = await organizationService.getOrganizationById(id);

  // Check if user has permission
  if (
    req.user.role !== "admin" &&
    organization.owner.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(
      403,
      "You don't have permission to update this organization"
    );
  }

  const updatedOrganization =
    await organizationService.addCustomerToOrganization(id, customerId);

  // Format the response to match frontend expectations
  const formattedOrganization = formatOrganizationResponse(updatedOrganization);

  res.status(200).json({
    success: true,
    data: formattedOrganization,
  });
});
