/**
 * System Controller
 * Handles system status and health check endpoints
 */

const { asyncHandler } = require('../../../utils/errorHandlers');
const systemService = require('../services/system.service');
const logger = require('../../../utils/logger');

/**
 * Get basic health status
 * @route GET /api/system/health
 * @access Public
 */
exports.getHealthStatus = asyncHandler(async (req, res) => {
  const healthStatus = await systemService.getHealthStatus();
  
  res.status(200).json({
    status: 'success',
    data: healthStatus
  });
});

/**
 * Get detailed system status
 * @route GET /api/system/status
 * @access Private - Admin only
 */
exports.getSystemStatus = asyncHandler(async (req, res) => {
  const systemStatus = await systemService.getSystemStatus();
  
  res.status(200).json({
    status: 'success',
    data: systemStatus
  });
});

/**
 * Get system version information
 * @route GET /api/system/version
 * @access Public
 */
exports.getVersionInfo = asyncHandler(async (req, res) => {
  const versionInfo = await systemService.getVersionInfo();
  
  res.status(200).json({
    status: 'success',
    data: versionInfo
  });
});

/**
 * Get system incidents
 * @route GET /api/system/incidents
 * @access Private - Admin only
 */
exports.getSystemIncidents = asyncHandler(async (req, res) => {
  const incidents = await systemService.getSystemIncidents();
  
  res.status(200).json({
    status: 'success',
    data: incidents
  });
});

/**
 * Get system metrics
 * @route GET /api/system/metrics
 * @access Private - Admin only
 */
exports.getSystemMetrics = asyncHandler(async (req, res) => {
  const metrics = await systemService.getSystemMetrics();
  
  res.status(200).json({
    status: 'success',
    data: metrics
  });
});
