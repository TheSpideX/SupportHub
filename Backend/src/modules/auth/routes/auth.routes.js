const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const securityController = require("../controllers/security.controller");
const rateLimitMiddleware = require("../middleware/rateLimit.middleware");
const { csrfMiddleware } = require("../middleware");
const authMiddleware = require("../middleware/auth.middleware");
const securityMiddleware = require("../middleware/security.middleware");
const validate = require("../middleware/validate");
const schemas = require("../validations/schemas");
const logger = require('../../../utils/logger');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Session = require('../models/session.model');
const tokenService = require('../services/token.service');

// Fix the import path - use the correct path to errorHandlers.js
const { asyncHandler } = require("../../../utils/errorHandlers");

// Add a health check endpoint for the auth module
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    module: "auth",
    timestamp: new Date().toISOString()
  });
});

// Login route - remove CSRF validation for initial login
router.post(
    "/login",
    rateLimitMiddleware.loginRateLimit(),
    validate(schemas.login),
    // Remove csrfMiddleware.validateToken here since user won't have a token yet
    authController.login
);

// Logout route
router.post(
    '/logout',
    authMiddleware.authenticateToken,
    csrfMiddleware.validateToken,
    asyncHandler(authController.logout)
);

// Refresh token route
router.post(
    '/refresh',
    rateLimitMiddleware.apiRateLimit(),
    csrfMiddleware.validateToken,
    asyncHandler(authController.refreshToken)  // Make sure to wrap with asyncHandler
);

// Session validation route
router.get(
    '/validate-session',
    authMiddleware.authenticateToken, // Use the correct function name
    asyncHandler(authController.validateSession) // Make sure to wrap with asyncHandler
);

// Current user information route
router.get(
    '/user',
    authMiddleware.authenticateToken, // Don't wrap with asyncHandler
    asyncHandler(authController.getCurrentUser)
);

// Register route
// router.post(
//     "/register",
//     rateLimitMiddleware.createRateLimiter({
//         windowMs: 60 * 60 * 1000, // 1 hour
//         max: 3,
//         prefix: "rate_limit:register:",
//         errorCode: "REGISTER_RATE_LIMIT_EXCEEDED",
//         message: "Too many registration attempts. Please try again later."
//     }),
//     validate(schemas.register),
//     csrfMiddleware.validateToken,
//     authController.register
// );

// Forgot password route
// router.post(
//     "/forgot-password",
//     rateLimitMiddleware.createRateLimiter({
//         windowMs: 60 * 60 * 1000, // 1 hour
//         max: 3,
//         prefix: "rate_limit:forgot_password:",
//         errorCode: "FORGOT_PASSWORD_RATE_LIMIT_EXCEEDED",
//         message: "Too many password reset attempts. Please try again later."
//     }),
//     validate(schemas.forgotPassword),
//     csrfMiddleware.validateToken,
//     authController.forgotPassword
// );

// Reset password route
// router.post(
//     "/reset-password",
//     rateLimitMiddleware.createRateLimiter({
//         windowMs: 60 * 60 * 1000, // 1 hour
//         max: 3,
//         prefix: "rate_limit:reset_password:",
//         errorCode: "RESET_PASSWORD_RATE_LIMIT_EXCEEDED",
//         message: "Too many password reset attempts. Please try again later."
//     }),
//     validate(schemas.resetPassword),
//     csrfMiddleware.validateToken,
//     authController.resetPassword
// );

// Security routes
// router.post(
//     "/change-password",
//     rateLimitMiddleware.apiRateLimit(),
//     authMiddleware.authenticate,
//     validate(schemas.changePassword),
//     csrfMiddleware.validateToken,
//     securityController.changePassword
// );

// Get security status
// router.get(
//     "/security-status",
//     rateLimitMiddleware.apiRateLimit(),
//     authMiddleware.authenticate,
//     csrfMiddleware.validateToken,
//     securityController.getSecurityStatus
// );

// Generate CSRF token route
router.get('/csrf-token',
  rateLimitMiddleware.apiRateLimit(),
  csrfMiddleware.generateToken,
  (req, res) => {
    res.json({ csrfToken: res.locals.csrfToken });
  }
);

// Add a route to get the current user's information
router.get(
  "/me",
  authMiddleware.authenticateToken, // Changed from authenticate to authenticateToken
  asyncHandler(async (req, res) => {
    // The user is already available in req.user thanks to the auth middleware
    const user = req.user;
    
    // Return user data (excluding sensitive information)
    return res.status(200).json({
      success: true,
      user: {
        id: user._id || user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        preferences: user.preferences || {},
        // Add other non-sensitive user fields as needed
      }
    });
  })
);

// Test cookie endpoint for frontend diagnostics
router.get('/test-cookie', (req, res) => {
  // Set a test cookie to verify cookie functionality
  res.cookie('test-cookie', 'working', {
    httpOnly: false, // Make it accessible to JavaScript for testing
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 60 * 1000 // 1 minute expiration
  });
  
  return res.status(200).json({
    success: true,
    message: 'Test cookie set successfully'
  });
});

// Add the auth status endpoint
router.get('/status', authMiddleware.optionalAuth, authController.getAuthStatus);

// Session sync endpoint
router.post('/session/sync', authMiddleware.authenticate, authController.syncSession);
router.head('/session/sync', (req, res) => res.status(200).end()); // Simple HEAD endpoint for checking existence

// Fix any other routes that might be using asyncHandler incorrectly
// For example:
router.post(
    '/logout',
    authMiddleware.authenticateToken,
    csrfMiddleware.validateToken,
    asyncHandler(authController.logout)
);

router.post(
    '/refresh',
    rateLimitMiddleware.apiRateLimit(),
    csrfMiddleware.validateToken,
    asyncHandler(authController.refreshToken)
);

// Add a token validation endpoint
router.get(
  '/validate-token',
  asyncHandler(async (req, res) => {
    try {
      const token = req.cookies?.access_token;
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      }
      
      // Verify the token
      const decoded = await tokenService.verifyToken(token, 'access');
      
      // Check if user exists
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      return res.json({
        success: true,
        message: 'Token is valid'
      });
    } catch (error) {
      logger.error('Token validation error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  })
);

// Add a session validation endpoint with detailed logging
router.get(
  '/validate-session',
  asyncHandler(async (req, res) => {
    console.log('Session validation request received');
    console.log('Cookies received:', req.cookies);
    
    try {
      // Check for access token in cookies
      const accessToken = req.cookies?.access_token;
      
      if (!accessToken) {
        console.log('No access_token cookie found');
        return res.status(401).json({
          success: false,
          message: 'No active session found'
        });
      }
      
      console.log('Access token found, verifying...');
      
      // Verify the token
      const decoded = await tokenService.verifyToken(accessToken);
      console.log('Token verified successfully for user:', decoded.userId);
      
      // Get user data
      const user = await User.findById(decoded.userId)
        .select('-password -passwordResetToken -passwordResetExpires');
      
      if (!user) {
        console.log('User not found in database:', decoded.userId);
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      console.log('User found, session is valid');
      
      // Return user data
      return res.status(200).json({
        success: true,
        message: 'Session is valid',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          sessionExpiry: new Date(decoded.exp * 1000)
        }
      });
    } catch (error) {
      console.error('Session validation error:', error);
      
      // Clear invalid cookies
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session'
      });
    }
  })
);

/**
 * Validate authentication tokens
 * @route GET /api/auth/validate
 */
router.get('/validate', authMiddleware.authenticateToken, (req, res) => {
  // If we reach here, the token is valid (authenticateToken middleware passed)
  return res.status(200).json({
    success: true,
    valid: true,
    data: {
      userId: req.user.id,
      // Return minimal user data
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role
      }
    }
  });
});

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token is required'
        }
      });
    }
    
    // Verify refresh token and generate new access token
    const tokenService = new TokenService();
    const result = await tokenService.refreshAccessToken(refreshToken);
    
    // Set new access token as HTTP-only cookie
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: securityConfig.session.accessTokenExpiry * 1000
    });
    
    // Generate new CSRF token
    const csrfToken = csrfUtils.generateToken();
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    return res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully',
      csrfToken: csrfToken
    });
  } catch (error) {
    logger.error('Token refresh failed', {
      component: COMPONENT,
      error: error.message
    });
    
    // Clear all auth cookies on refresh failure
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie('csrf_token');
    res.clearCookie('auth_token_exists');
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh token'
      }
    });
  }
});

/**
 * Logout user
 * @route POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  // Clear all auth cookies
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.clearCookie('csrf_token');
  res.clearCookie('auth_token_exists');
  
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Make sure the router is properly exported at the end of the file
module.exports = router;
