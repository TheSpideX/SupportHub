/**
 * Request utility functions for handling HTTP requests
 */

/**
 * Extract client IP address from request
 * @param {Object} req - Express request object
 * @returns {String} IP address
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         req.ip || 
         '0.0.0.0';
};

/**
 * Extract device information from request
 * @param {Object} req - Express request object
 * @returns {Object} Device information
 */
const getDeviceInfo = (req) => {
  // Get device info from request body or headers
  const deviceInfo = req.body.deviceInfo || {};
  
  return {
    userAgent: req.headers['user-agent'] || deviceInfo.userAgent || 'unknown',
    ipAddress: getClientIp(req),
    fingerprint: deviceInfo.fingerprint || '',
    device: deviceInfo.device || 'unknown',
    // Add any additional device info from request
    ...deviceInfo
  };
};

/**
 * Get request origin information
 * @param {Object} req - Express request object
 * @returns {Object} Origin information
 */
const getRequestOrigin = (req) => {
  return {
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    referer: req.headers.referer || 'direct',
    origin: req.headers.origin || 'unknown'
  };
};

/**
 * Check if request is from a mobile device
 * @param {Object} req - Express request object
 * @returns {Boolean} True if mobile device
 */
const isMobileRequest = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  return /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
};

module.exports = {
  getClientIp,
  getDeviceInfo,
  getRequestOrigin,
  isMobileRequest
};