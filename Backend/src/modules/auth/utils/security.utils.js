const crypto = require('crypto');
const logger = require('../../../utils/logger');

/**
 * Security utility functions for authentication
 */
const securityUtils = {
  /**
   * Generate a secure random token
   * @param {number} length - Length of the token in bytes
   * @returns {string} - Hex string representation of the token
   */
  generateSecureToken: (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * Create a device fingerprint from request data
   * @param {Object} req - Express request object
   * @returns {string} - Hashed device fingerprint
   */
  createDeviceFingerprint: (req) => {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress;
    const fingerprint = `${userAgent}|${ip}`;
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  },

  /**
   * Generate CSRF token
   * @returns {string} - CSRF token
   */
  generateCsrfToken: () => {
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Validate CSRF token
   * @param {string} token - Token from request
   * @param {string} storedToken - Token stored in session
   * @returns {boolean} - Whether token is valid
   */
  validateCsrfToken: (token, storedToken) => {
    return token && storedToken && token === storedToken;
  },

  /**
   * Sanitize device info for logging and storage
   * @param {Object} deviceInfo - Device information
   * @returns {Object} Sanitized device info
   */
  sanitizeDeviceInfo: (deviceInfo) => {
    if (!deviceInfo) return {};
    
    // Create a copy to avoid modifying the original
    const sanitized = { ...deviceInfo };
    
    // Ensure required fields exist
    if (!sanitized.fingerprint) {
      sanitized.fingerprint = sanitized.userAgent || 'unknown';
    }
    
    if (!sanitized.location) {
      sanitized.location = {};
    }
    
    // Remove potentially sensitive fields
    delete sanitized.rawFingerprint;
    delete sanitized.cookies;
    delete sanitized.localStorage;
    delete sanitized.sessionStorage;
    
    return sanitized;
  },
  
  /**
   * Calculate risk score based on device info and user behavior
   * @param {Object} params - Parameters for risk calculation
   * @returns {number} Risk score (0-100)
   */
  calculateRiskScore: ({ deviceInfo, user, ipAddress }) => {
    let score = 0;
    
    // Add implementation here
    
    return score;
  }
};

module.exports = securityUtils;
