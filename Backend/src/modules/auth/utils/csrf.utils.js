const crypto = require('crypto');

/**
 * Generate a CSRF token
 * @returns {String} CSRF token
 */
exports.generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Validate CSRF token
 * @param {String} token - Token from request
 * @param {String} storedToken - Token from cookie or session
 * @returns {Boolean} Whether token is valid
 */
exports.validateToken = (token, storedToken) => {
  if (!token || !storedToken) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(storedToken)
  );
};