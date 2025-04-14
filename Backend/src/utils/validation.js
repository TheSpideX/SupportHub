/**
 * Validation utilities for Joi schemas
 */

const mongoose = require('mongoose');

/**
 * Custom Joi validator for MongoDB ObjectId
 * @param {string} value - The value to validate
 * @param {Object} helpers - Joi helpers
 * @returns {string|Object} - The value if valid, or an error
 */
const objectId = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  
  return value;
};

/**
 * Custom Joi validator for password strength
 * @param {string} value - The password to validate
 * @param {Object} helpers - Joi helpers
 * @returns {string|Object} - The value if valid, or an error
 */
const password = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  
  if (value.length < 8) {
    return helpers.error('string.min', { limit: 8 });
  }
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(value)) {
    return helpers.message('Password must contain at least one uppercase letter');
  }
  
  // Check for at least one lowercase letter
  if (!/[a-z]/.test(value)) {
    return helpers.message('Password must contain at least one lowercase letter');
  }
  
  // Check for at least one number
  if (!/[0-9]/.test(value)) {
    return helpers.message('Password must contain at least one number');
  }
  
  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
    return helpers.message('Password must contain at least one special character');
  }
  
  return value;
};

/**
 * Custom Joi validator for email
 * @param {string} value - The email to validate
 * @param {Object} helpers - Joi helpers
 * @returns {string|Object} - The value if valid, or an error
 */
const email = (value, helpers) => {
  if (!value) {
    return helpers.error('any.required');
  }
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return helpers.message('Invalid email format');
  }
  
  return value;
};

/**
 * Custom Joi validator for phone numbers
 * @param {string} value - The phone number to validate
 * @param {Object} helpers - Joi helpers
 * @returns {string|Object} - The value if valid, or an error
 */
const phoneNumber = (value, helpers) => {
  if (!value) {
    return value; // Allow empty values (use .required() in schema if needed)
  }
  
  // Remove spaces, dashes, and parentheses
  const cleaned = value.replace(/\s|\(|\)|-/g, '');
  
  // Check if it's a valid number (basic check)
  if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
    return helpers.message('Invalid phone number format');
  }
  
  return value;
};

module.exports = {
  objectId,
  password,
  email,
  phoneNumber,
};
