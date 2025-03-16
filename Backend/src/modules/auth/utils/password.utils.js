const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const zxcvbn = require('zxcvbn');
const config = require('../config/security.config');

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  if (!password) {
    throw new Error('Password is required');
  }
  
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Hashed password to compare against
 * @returns {Promise<boolean>} True if password matches hash
 */
const verifyPassword = async (password, hash) => {
  if (!password || !hash) {
    return false;
  }
  
  return bcrypt.compare(password, hash);
};

/**
 * Check password strength using zxcvbn
 * @param {string} password - Password to evaluate
 * @returns {Object} Strength assessment with score and feedback
 */
const checkPasswordStrength = (password) => {
  if (!password) {
    return { 
      score: 0, 
      feedback: { 
        warning: 'Password is required',
        suggestions: ['Enter a password'] 
      },
      isStrong: false
    };
  }
  
  const result = zxcvbn(password);
  
  // Add custom feedback based on policy requirements
  const suggestions = [...(result.feedback.suggestions || [])];
  const warnings = [];
  
  if (password.length < config.passwordPolicy.minLength) {
    warnings.push(`Password must be at least ${config.passwordPolicy.minLength} characters`);
  }
  
  if (config.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    suggestions.push('Add uppercase letters');
  }
  
  if (config.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    suggestions.push('Add lowercase letters');
  }
  
  if (config.passwordPolicy.requireNumbers && !/\d/.test(password)) {
    suggestions.push('Add numbers');
  }
  
  if (config.passwordPolicy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    suggestions.push('Add special characters');
  }
  
  // Consider a password strong if it meets policy requirements and has a score of at least 3
  const isStrong = (
    result.score >= 3 &&
    password.length >= config.passwordPolicy.minLength &&
    (!config.passwordPolicy.requireUppercase || /[A-Z]/.test(password)) &&
    (!config.passwordPolicy.requireLowercase || /[a-z]/.test(password)) &&
    (!config.passwordPolicy.requireNumbers || /\d/.test(password)) &&
    (!config.passwordPolicy.requireSpecialChars || /[^A-Za-z0-9]/.test(password))
  );
  
  return {
    score: result.score,
    feedback: {
      warning: result.feedback.warning || (warnings.length ? warnings[0] : ''),
      suggestions: suggestions,
      warnings: warnings
    },
    isStrong,
    crackTimeDisplay: result.crack_times_display.offline_slow_hashing_1e4_per_second,
    guessesLog10: result.guesses_log10
  };
};

/**
 * Check if a password is commonly used (and therefore insecure)
 * @param {string} password - Password to check
 * @returns {Promise<boolean>} True if password is common/breached
 */
const isCommonPassword = async (password) => {
  if (!password || password.length < 5) {
    return true; // Very short passwords are automatically considered common
  }
  
  // Check against a list of common passwords (simplified version)
  const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty', 
    'admin', 'welcome', 'login', 'abc123', 'letmein', 
    'monkey', 'football', 'iloveyou', 'starwars', 'dragon'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    return true;
  }
  
  // If enabled, check against HIBP API using k-anonymity model
  if (config.passwordPolicy.preventCommonPasswords) {
    try {
      return await isPasswordBreached(password);
    } catch (error) {
      console.error('Error checking password breach status:', error);
      // If the API check fails, fall back to local validation only
    }
  }
  
  return false;
};

/**
 * Check if password has been breached using HIBP API
 * @param {string} password - Password to check
 * @returns {Promise<boolean>} True if password is breached
 */
const isPasswordBreached = async (password) => {
  try {
    // Use k-anonymity model with HIBP API
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);
    
    const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
      timeout: 3000, // 3 second timeout
      headers: {
        'User-Agent': 'password-utils/1.0'
      }
    });
    
    // Check if password hash suffix is in the response
    return response.data.split('\r\n').some(line => {
      const [hashSuffix] = line.split(':');
      return hashSuffix === suffix;
    });
  } catch (error) {
    console.error('Error checking HIBP API:', error.message);
    // In case of API failure, err on the side of caution
    return false;
  }
};

/**
 * Validate password against policy requirements
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and reasons
 */
const validatePasswordPolicy = (password) => {
  const result = {
    isValid: true,
    reasons: []
  };
  
  if (!password) {
    result.isValid = false;
    result.reasons.push('Password is required');
    return result;
  }
  
  if (password.length < config.passwordPolicy.minLength) {
    result.isValid = false;
    result.reasons.push(`Password must be at least ${config.passwordPolicy.minLength} characters`);
  }
  
  if (config.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    result.isValid = false;
    result.reasons.push('Password must contain at least one uppercase letter');
  }
  
  if (config.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    result.isValid = false;
    result.reasons.push('Password must contain at least one lowercase letter');
  }
  
  if (config.passwordPolicy.requireNumbers && !/\d/.test(password)) {
    result.isValid = false;
    result.reasons.push('Password must contain at least one number');
  }
  
  if (config.passwordPolicy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    result.isValid = false;
    result.reasons.push('Password must contain at least one special character');
  }
  
  return result;
};

/**
 * Generate a secure random password
 * @param {Object} options - Password generation options
 * @returns {string} Generated password
 */
const generateSecurePassword = (options = {}) => {
  const defaults = {
    length: config.passwordPolicy.minLength,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSpecialChars: true
  };
  
  const opts = { ...defaults, ...options };
  
  const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed confusing chars like I, O
  const lowercaseChars = 'abcdefghijkmnopqrstuvwxyz'; // Removed confusing chars like l
  const numberChars = '23456789'; // Removed confusing chars like 0, 1
  const specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  
  let allChars = '';
  if (opts.includeUppercase) allChars += uppercaseChars;
  if (opts.includeLowercase) allChars += lowercaseChars;
  if (opts.includeNumbers) allChars += numberChars;
  if (opts.includeSpecialChars) allChars += specialChars;
  
  if (!allChars) {
    throw new Error('At least one character type must be included');
  }
  
  // Ensure we have at least one of each required character type
  let password = '';
  
  if (opts.includeUppercase) {
    password += uppercaseChars.charAt(Math.floor(crypto.randomInt(0, uppercaseChars.length)));
  }
  
  if (opts.includeLowercase) {
    password += lowercaseChars.charAt(Math.floor(crypto.randomInt(0, lowercaseChars.length)));
  }
  
  if (opts.includeNumbers) {
    password += numberChars.charAt(Math.floor(crypto.randomInt(0, numberChars.length)));
  }
  
  if (opts.includeSpecialChars) {
    password += specialChars.charAt(Math.floor(crypto.randomInt(0, specialChars.length)));
  }
  
  // Fill the rest of the password
  while (password.length < opts.length) {
    password += allChars.charAt(Math.floor(crypto.randomInt(0, allChars.length)));
  }
  
  // Shuffle the password characters
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Create a SHA-256 hash of a password (for frontend compatibility)
 * @param {string} password - Password to hash
 * @returns {string} SHA-256 hash in hex format
 */
const createSha256Hash = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

module.exports = {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
  isCommonPassword,
  isPasswordBreached,
  validatePasswordPolicy,
  generateSecurePassword,
  createSha256Hash
};