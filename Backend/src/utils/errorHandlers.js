const logger = require("./logger");
const config = require("../config");

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Async handler to wrap async route handlers and middleware
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found error handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFound = (req, res, next) => {
  const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
  next(error);
};

/**
 * Global error handler middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  // Default error status and message
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || "INTERNAL_SERVER_ERROR";
  const message = err.message || "Something went wrong";

  // Log the error
  logger.error(message, {
    errorCode: err.statusCode || 500,
    errorName: err.name,
    stack: err.stack,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    requestId: req.id || "unknown",
    service: config.serviceName,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
  });

  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
};

module.exports = {
  ApiError,
  asyncHandler,
  notFound,
  globalErrorHandler,
};
