/**
 * Request validation middleware
 */
const { AppError } = require('../../../utils/errors');

/**
 * Validates request data against schema
 * @param {Object} schema - Validation schema with body, query, params
 */
exports.validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const errors = {};
      
      // Validate request body if schema provided
      if (schema.body && req.body) {
        const bodyErrors = validateObject(req.body, schema.body);
        if (Object.keys(bodyErrors).length > 0) {
          errors.body = bodyErrors;
        }
      }
      
      // Validate query parameters if schema provided
      if (schema.query && req.query) {
        const queryErrors = validateObject(req.query, schema.query);
        if (Object.keys(queryErrors).length > 0) {
          errors.query = queryErrors;
        }
      }
      
      // Validate URL parameters if schema provided
      if (schema.params && req.params) {
        const paramErrors = validateObject(req.params, schema.params);
        if (Object.keys(paramErrors).length > 0) {
          errors.params = paramErrors;
        }
      }
      
      // If validation errors exist, return error response
      if (Object.keys(errors).length > 0) {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors));
      }
      
      next();
    } catch (error) {
      next(new AppError('Validation error', 500, 'VALIDATION_SYSTEM_ERROR'));
    }
  };
};

/**
 * Validates an object against a schema
 * @param {Object} object - Object to validate
 * @param {Object} schema - Schema to validate against
 * @returns {Object} - Validation errors
 */
function validateObject(object, schema) {
  const errors = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    // Skip validation if field is optional and not provided
    if (rules.optional && (object[field] === undefined || object[field] === null)) {
      continue;
    }
    
    // Check if required field is missing
    if (!rules.optional && (object[field] === undefined || object[field] === null)) {
      errors[field] = 'Field is required';
      continue;
    }
    
    // Skip further validation if field is not provided
    if (object[field] === undefined || object[field] === null) {
      continue;
    }
    
    // Type validation
    if (rules.type) {
      const typeValid = validateType(object[field], rules.type);
      if (!typeValid) {
        errors[field] = `Expected type ${rules.type}`;
        continue;
      }
    }
    
    // Enum validation
    if (rules.enum && Array.isArray(rules.enum)) {
      if (!rules.enum.includes(object[field])) {
        errors[field] = `Value must be one of: ${rules.enum.join(', ')}`;
        continue;
      }
    }
    
    // Min/max validation for strings and arrays
    if (typeof object[field] === 'string' || Array.isArray(object[field])) {
      if (rules.min !== undefined && object[field].length < rules.min) {
        errors[field] = `Minimum length is ${rules.min}`;
        continue;
      }
      
      if (rules.max !== undefined && object[field].length > rules.max) {
        errors[field] = `Maximum length is ${rules.max}`;
        continue;
      }
    }
    
    // Min/max validation for numbers
    if (typeof object[field] === 'number') {
      if (rules.min !== undefined && object[field] < rules.min) {
        errors[field] = `Minimum value is ${rules.min}`;
        continue;
      }
      
      if (rules.max !== undefined && object[field] > rules.max) {
        errors[field] = `Maximum value is ${rules.max}`;
        continue;
      }
    }
    
    // Pattern validation for strings
    if (typeof object[field] === 'string' && rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(object[field])) {
        errors[field] = rules.patternMessage || 'Invalid format';
        continue;
      }
    }
    
    // Custom validation function
    if (typeof rules.validate === 'function') {
      const isValid = rules.validate(object[field]);
      if (!isValid) {
        errors[field] = rules.validateMessage || 'Validation failed';
        continue;
      }
    }
  }
  
  return errors;
}

/**
 * Validates value type
 * @param {any} value - Value to validate
 * @param {string} type - Expected type
 * @returns {boolean} - Whether type is valid
 */
function validateType(value, type) {
  switch (type.toLowerCase()) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && !Array.isArray(value) && value !== null;
    case 'date':
      return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
    default:
      return true;
  }
}