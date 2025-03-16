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
const TokenService = require('../services/token.service');
const tokenService = new TokenService();

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

// Login route with improved CSRF handling
router.post(
    "/login",
    rateLimitMiddleware.loginRateLimit(),
    validate(schemas.login),
    (req, res, next) => {
      // Check if CSRF token is present
      const token = req.headers['x-csrf-token'];
      
      // Add debugging only in development
      if (process.env.NODE_ENV === 'development') {
        console.log('=== SERVER LOGIN REQUEST ===');
        console.log('Headers:', {
            csrf: token,
            contentType: req.headers['content-type']
        });
      }
      
      // Skip CSRF validation only in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Skipping CSRF validation: Development mode');
        return next();
      }
      
      // Enforce CSRF validation in all other environments
      if (!token) {
        return res.status(403).json({
          error: {
            code: 'CSRF_ERROR',
            message: 'CSRF token is required'
          }
        });
      }
      
      // Continue with CSRF validation
      try {
        csrfMiddleware.validateToken(req, res, next);
      } catch (error) {
        console.error('CSRF validation error:', error);
        return res.status(403).json({
          error: {
            code: 'CSRF_ERROR',
            message: 'CSRF token validation failed'
          }
        });
      }
    },
    authController.login
);

// Logout route
router.post(
    '/logout',
    authMiddleware.authenticate,
    csrfMiddleware.validateToken,
    authController.logout
);

// Refresh token route
router.post(
    '/refresh',
    rateLimitMiddleware.apiRateLimit(),
    csrfMiddleware.validateToken,
    authController.refreshToken
);

// Validate session route - POST method
router.post(
    "/validate-session",
    rateLimitMiddleware.apiRateLimit(),
    authMiddleware.authenticate,
    csrfMiddleware.validateToken,
    asyncHandler(async (req, res) => {
        // If middleware passes, user is authenticated
        return res.status(200).json({
            success: true,
            user: req.user
        });
    })
);

// Validate session route - GET method with improved error handling
router.get(
    "/validate-session",
    rateLimitMiddleware.apiRateLimit(),
    asyncHandler(async (req, res) => {
        try {
            // Log request details
            logger.debug('Validate session request received', {
                component: 'ValidateSession',
                headers: {
                    authorization: req.headers.authorization ? 'Present' : 'Missing',
                    cookie: req.headers.cookie ? 'Present' : 'Missing'
                },
                cookies: Object.keys(req.cookies || {}),
                query: req.query,
                method: req.method
            });
            
            // Extract token from cookies
            const token = req.cookies.accessToken;
            
            if (!token) {
                logger.debug('No access token found in cookies', {
                    component: 'ValidateSession',
                    cookies: Object.keys(req.cookies || {}),
                    headers: req.headers
                });
                
                return res.status(401).json({
                    success: false,
                    message: "No authentication token found"
                });
            }
            
            // Log token info before verification
            logger.debug('Verifying token', {
                component: 'ValidateSession',
                tokenLength: token.length,
                tokenFirstChars: token.substring(0, 10) + '...',
                tokenLastChars: '...' + token.substring(token.length - 10)
            });
            
            // Check if tokenService is properly initialized
            if (!tokenService || typeof tokenService.verifyToken !== 'function') {
                logger.error('Token service not properly initialized', {
                    component: 'ValidateSession',
                    tokenServiceExists: !!tokenService,
                    availableMethods: tokenService ? Object.keys(tokenService) : 'none'
                });
                
                return res.status(500).json({
                    success: false,
                    message: "Internal server error - token service unavailable"
                });
            }
            
            // Verify token using the correct method from tokenService
            logger.debug('Attempting to verify token', {
                component: 'ValidateSession',
                method: 'verifyToken'
            });
            
            const decoded = await tokenService.verifyToken(token, 'access');
            
            logger.debug('Token verification result', {
                component: 'ValidateSession',
                success: !!decoded,
                decodedExists: !!decoded
            });
            
            if (!decoded) {
                logger.debug('Invalid or expired token', {
                    component: 'ValidateSession'
                });
                
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired token"
                });
            }
            
            // Log decoded token payload
            logger.debug('Token decoded successfully', {
                component: 'ValidateSession',
                decodedPayload: {
                    ...decoded,
                    // Don't log the full token payload for security
                    iat: decoded.iat,
                    exp: decoded.exp,
                    sub: decoded.sub || decoded.userId,
                    type: decoded.type
                },
                userId: decoded.userId || decoded.sub,
                tokenType: decoded.type,
                expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'unknown'
            });
            
            // Check if we're using the right field for user ID
            const userId = decoded.userId || decoded.sub;
            
            if (!userId) {
                logger.warn('No user ID in token payload', {
                    component: 'ValidateSession',
                    decodedPayload: {
                        ...decoded,
                        // Redact sensitive information
                        iat: decoded.iat,
                        exp: decoded.exp
                    }
                });
                
                return res.status(401).json({
                    success: false,
                    message: "Invalid token format - no user ID"
                });
            }
            
            // Log before database query
            logger.debug('Attempting to find user in database', {
                component: 'ValidateSession',
                userId: userId,
                isValidObjectId: mongoose.Types.ObjectId.isValid(userId)
            });
            
            // Get user from database
            const user = await User.findById(userId);
            
            // Log after database query
            logger.debug('User lookup result', {
                component: 'ValidateSession',
                userId: userId,
                userFound: !!user
            });
            
            if (!user) {
                // Try to count users to verify DB connection
                const userCount = await User.countDocuments({});
                
                logger.warn('User not found for token', {
                    userId: userId,
                    component: 'ValidateSession',
                    totalUsers: userCount,
                    databaseConnected: !!mongoose.connection.readyState
                });
                
                return res.status(401).json({
                    success: false,
                    message: "User not found"
                });
            }
            
            // Return user data (sanitize sensitive information)
            const sanitizedUser = {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            };
            
            logger.debug('Session validation successful', {
                component: 'ValidateSession',
                userId: user._id,
                email: user.email
            });
            
            return res.status(200).json({
                success: true,
                user: sanitizedUser
            });
        } catch (error) {
            logger.error('Session validation error', {
                component: 'ValidateSession',
                error: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code
            });
            
            return res.status(401).json({
                success: false,
                message: "Session validation failed",
                error: error.message
            });
        }
    })
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
  authMiddleware.optionalAuth,
  csrfMiddleware.generateToken,
  (req, res) => {
    res.json({ csrfToken: res.locals.csrfToken });
  }
);

// Add a route to get the current user's information
router.get(
  "/me",
  authMiddleware.authenticate,
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

// Make sure the router is properly exported at the end of the file
module.exports = router;
