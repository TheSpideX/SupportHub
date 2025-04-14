/**
 * Validation middleware
 * Validates request data against Joi schemas
 */

/**
 * Creates a validation middleware using the provided schema
 * @param {Object} schema - Joi schema with body, params, query validators
 * @returns {Function} Express middleware function
 */
const validate = (schema) => {
  return (req, res, next) => {
    const validationErrors = [];

    // Validate request body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        validationErrors.push(
          ...error.details.map((detail) => ({
            type: "body",
            message: detail.message,
          }))
        );
      } else {
        req.body = value;
      }
    }

    // Validate URL parameters
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        validationErrors.push(
          ...error.details.map((detail) => ({
            type: "params",
            message: detail.message,
          }))
        );
      } else {
        req.params = value;
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        validationErrors.push(
          ...error.details.map((detail) => ({
            type: "query",
            message: detail.message,
          }))
        );
      } else {
        req.query = value;
      }
    }

    // If validation errors exist, return them
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors
        .map((err) => `${err.type}: ${err.message}`)
        .join(", ");

      return res.status(400).json({
        status: "error",
        code: "VALIDATION_ERROR",
        message: errorMessage,
        errors: validationErrors,
      });
    }

    next();
  };
};

module.exports = validate;
