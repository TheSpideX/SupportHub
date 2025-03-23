/**
 * Auth Routes
 * Handles core authentication operations
 */

const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const rateLimitMiddleware = require("../middleware/rate-limit");
const csrfMiddleware = require("../middleware/csrf");
const authMiddleware = require("../middleware/authenticate");
const validate = require("../../../middleware/validate");
const schemas = require("../validations/schemas");
const { asyncHandler } = require("../../../utils/errorHandlers");

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    module: "auth",
    timestamp: new Date().toISOString()
  });
});

// Authentication endpoints
router.post(
  "/login",
  rateLimitMiddleware.loginRateLimit(),
  validate(schemas.login),
  asyncHandler(authController.login)
);

router.post(
  "/logout",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(authController.logout)
);

router.post(
  "/register",
  rateLimitMiddleware.registrationRateLimit(),
  validate(schemas.register),
  asyncHandler(authController.register)
);

// User information
router.get(
  "/me",
  authMiddleware.authenticateToken,
  asyncHandler(authController.getCurrentUser)
);

// Email verification
router.post(
  "/verify-email",
  validate(schemas.verifyEmail),
  asyncHandler(authController.verifyEmail)
);

router.post(
  "/resend-verification",
  rateLimitMiddleware.apiRateLimit(),
  validate(schemas.resendVerification),
  asyncHandler(authController.resendVerification)
);

// Auth status endpoint
router.get(
  "/status",
  authMiddleware.optionalAuth,
  asyncHandler(authController.getAuthStatus)
);

// Add a lightweight endpoint to check token status
router.get('/token-status', authMiddleware.authenticateToken, (req, res) => {
  // Calculate token expiration time
  const expiresIn = req.tokenExpiry ? req.tokenExpiry - Math.floor(Date.now() / 1000) : null;
  
  res.json({
    valid: true,
    expiresIn: expiresIn,
    // Don't include sensitive information
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

// Token refresh endpoint
router.post(
  '/token/refresh',
  rateLimitMiddleware.apiRateLimit(),
  asyncHandler(authController.refreshToken)
);

// Check session status (lightweight version for tab sync)
router.get(
  "/session-check", 
  authMiddleware.authenticateToken, // Use standard auth middleware
  asyncHandler(authController.checkSessionStatus)
);

module.exports = router;
