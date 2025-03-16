const AuthError = require('./auth.error');

// Error handler middleware
const authErrorHandler = (err, req, res, next) => {
  if (err instanceof AuthError) {
    // Log the error
    console.error(`[AuthError] ${err.code}: ${err.message}`, err.details);
    
    // Send standardized response
    return res.status(err.status || 401).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details
      }
    });
  }
  
  // Pass other errors to the default error handler
  next(err);
};

module.exports = { AuthError, authErrorHandler };
