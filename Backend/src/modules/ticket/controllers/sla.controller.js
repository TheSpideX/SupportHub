/**
 * SLA Controller
 * Handles HTTP requests for SLA policy operations
 */

const slaService = require("../services/sla.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");

/**
 * Create a new SLA policy
 * @route POST /api/sla/policies
 */
exports.createSLAPolicy = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    // Add organization ID to policy data
    const policyData = {
      ...req.body,
      organizationId,
    };
    
    const policy = await slaService.createSLAPolicy(policyData, userId);
    
    return res.status(201).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    logger.error("Error creating SLA policy:", error);
    return next(error);
  }
};

/**
 * Get SLA policy by ID
 * @route GET /api/sla/policies/:id
 */
exports.getSLAPolicyById = async (req, res, next) => {
  try {
    const policyId = req.params.id;
    const organizationId = req.user.organizationId;
    
    const policy = await slaService.getSLAPolicyById(policyId, organizationId);
    
    return res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    logger.error("Error getting SLA policy:", error);
    return next(error);
  }
};

/**
 * Get SLA policies for organization
 * @route GET /api/sla/policies
 */
exports.getSLAPolicies = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    
    const policies = await slaService.getSLAPolicies(organizationId);
    
    return res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (error) {
    logger.error("Error getting SLA policies:", error);
    return next(error);
  }
};

/**
 * Update SLA policy
 * @route PUT /api/sla/policies/:id
 */
exports.updateSLAPolicy = async (req, res, next) => {
  try {
    const policyId = req.params.id;
    const organizationId = req.user.organizationId;
    
    const policy = await slaService.updateSLAPolicy(
      policyId,
      req.body,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    logger.error("Error updating SLA policy:", error);
    return next(error);
  }
};

/**
 * Delete SLA policy
 * @route DELETE /api/sla/policies/:id
 */
exports.deleteSLAPolicy = async (req, res, next) => {
  try {
    const policyId = req.params.id;
    const organizationId = req.user.organizationId;
    
    await slaService.deleteSLAPolicy(policyId, organizationId);
    
    return res.status(200).json({
      success: true,
      message: "SLA policy deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting SLA policy:", error);
    return next(error);
  }
};

/**
 * Apply SLA policy to ticket
 * @route POST /api/sla/apply/:ticketId
 */
exports.applyPolicyToTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.ticketId;
    const { policyId } = req.body;
    const organizationId = req.user.organizationId;
    
    if (!policyId) {
      return next(new ApiError(400, "Policy ID is required"));
    }
    
    const ticket = await slaService.applyPolicyToTicket(
      ticketId,
      policyId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error applying SLA policy to ticket:", error);
    return next(error);
  }
};

/**
 * Pause SLA for a ticket
 * @route POST /api/sla/pause/:ticketId
 */
exports.pauseSLA = async (req, res, next) => {
  try {
    const ticketId = req.params.ticketId;
    const { reason } = req.body;
    const organizationId = req.user.organizationId;
    
    if (!reason) {
      return next(new ApiError(400, "Reason is required"));
    }
    
    const ticket = await slaService.pauseSLA(
      ticketId,
      reason,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error pausing SLA:", error);
    return next(error);
  }
};

/**
 * Resume SLA for a ticket
 * @route POST /api/sla/resume/:ticketId
 */
exports.resumeSLA = async (req, res, next) => {
  try {
    const ticketId = req.params.ticketId;
    const organizationId = req.user.organizationId;
    
    const ticket = await slaService.resumeSLA(
      ticketId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error resuming SLA:", error);
    return next(error);
  }
};

/**
 * Check SLA breaches for all active tickets
 * @route POST /api/sla/check-breaches
 * @access Admin only
 */
exports.checkSLABreaches = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    
    const results = await slaService.checkSLABreaches(organizationId);
    
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error("Error checking SLA breaches:", error);
    return next(error);
  }
};
