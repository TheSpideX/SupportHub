/**
 * API Response Utility
 * Provides standardized response formats for API endpoints
 */

/**
 * Create a success response
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Formatted success response
 */
exports.successResponse = (data = null, message = "Success", statusCode = 200) => {
  return {
    status: "success",
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Create an error response
 * @param {string} message - Error message
 * @param {string} errorCode - Error code
 * @param {number} statusCode - HTTP status code
 * @param {Object} errors - Additional error details
 * @returns {Object} Formatted error response
 */
exports.errorResponse = (
  message = "An error occurred",
  errorCode = "INTERNAL_ERROR",
  statusCode = 500,
  errors = null
) => {
  return {
    status: "error",
    statusCode,
    message,
    errorCode,
    errors,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Send a success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
exports.sendSuccess = (res, data = null, message = "Success", statusCode = 200) => {
  const response = exports.successResponse(data, message, statusCode);
  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {string} errorCode - Error code
 * @param {number} statusCode - HTTP status code
 * @param {Object} errors - Additional error details
 */
exports.sendError = (
  res,
  message = "An error occurred",
  errorCode = "INTERNAL_ERROR",
  statusCode = 500,
  errors = null
) => {
  const response = exports.errorResponse(message, errorCode, statusCode, errors);
  return res.status(statusCode).json(response);
};
