/**
 * Security Controller
 * Handles security-related endpoints including:
 * - CSRF token generation
 * - Device verification
 * - Security context validation
 */
const securityService = require('../services/security.service');
const { AuthError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

/**
 * Generate a CSRF token
 * @route GET /api/auth/csrf-token
 */
exports.generateCsrfToken = (req, res, next) => {
  try {
    const token = securityService.generateCsrfToken(res);
    return res.status(200).json({ success: true, token });
  } catch (error) {
    logger.error('CSRF token generation error:', error);
    next(error);
  }
};

/**
 * Verify a device
 * @route POST /api/auth/verify-device
 */
exports.verifyDevice = async (req, res, next) => {
  try {
    const { userId, verificationCode, deviceInfo } = req.body;
    
    if (!userId || !verificationCode || !deviceInfo) {
      return next(new AuthError('Missing required verification information', 400));
    }
    
    const verified = await securityService.verifyDevice(userId, verificationCode, deviceInfo);
    
    if (!verified) {
      return next(new AuthError('Device verification failed', 400));
    }
    
    return res.status(200).json({
      success: true,
      message: 'Device verified successfully'
    });
  } catch (error) {
    logger.error('Device verification error:', error);
    next(error);
  }
};

/**
 * Validate security context
 * @route POST /api/auth/validate-context
 */
exports.validateSecurityContext = async (req, res, next) => {
  try {
    const { securityContext } = req.body;
    const userId = req.user ? req.user._id : null;
    
    if (!securityContext || !userId) {
      return next(new AuthError('Invalid security context', 400));
    }
    
    const isValid = await securityService.validateSecurityContext(securityContext, userId);
    
    return res.status(200).json({
      success: true,
      valid: isValid
    });
  } catch (error) {
    logger.error('Security context validation error:', error);
    next(error);
  }
};

/**
 * Report suspicious activity
 * @route POST /api/auth/report-activity
 */
exports.reportSuspiciousActivity = async (req, res, next) => {
  try {
    const { activityType, details } = req.body;
    const userId = req.user ? req.user._id : null;
    
    await securityService.logSecurityEvent(userId, activityType, details);
    
    return res.status(200).json({
      success: true,
      message: 'Activity reported successfully'
    });
  } catch (error) {
    logger.error('Activity reporting error:', error);
    next(error);
  }
};