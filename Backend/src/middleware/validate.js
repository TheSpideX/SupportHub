/**
 * Validation middleware
 * Validates request data against Joi schemas
 */

/**
 * Creates a validation middleware using the provided schema
 * @param {Object} schema - Joi schema to validate against
 * @returns {Function} Express middleware function
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: errorMessage
      });
    }

    // Replace request body with validated data
    req.body = value;
    next();
  };
};

module.exports = validate;