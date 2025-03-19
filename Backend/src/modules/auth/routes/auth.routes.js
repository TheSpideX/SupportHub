const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const securityController = require("../controllers/security.controller");
const sessionController = require("../controllers/session.controller");
const rateLimitMiddleware = require("../middleware/rate-limit");
const csrfMiddleware = require("../middleware/csrf");
const { validateToken } = csrfMiddleware;
const authMiddleware = require("../middleware/authenticate");
const { authenticateToken, optionalAuth } = authMiddleware;
// Import validation middleware from the correct location
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
  validateToken,
  asyncHandler(authController.logout)
);

router.post(
  "/register",
  rateLimitMiddleware.registrationRateLimit(),
  validate(schemas.register),
  asyncHandler(authController.register)
);

// Token management
router.post(
  "/refresh-token",
  rateLimitMiddleware.apiRateLimit(),
  asyncHandler(authController.refreshToken)
);

router.get(
  "/csrf-token",
  authMiddleware.optionalAuth,
  asyncHandler(securityController.generateCsrfToken)
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

// Two-factor authentication
router.post(
  "/verify-2fa",
  rateLimitMiddleware.apiRateLimit(),
  validate(schemas.verify2FA),
  asyncHandler(authController.verify2FA)
);

router.post(
  "/setup-2fa",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(authController.setup2FA)
);

router.post(
  "/disable-2fa",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  validate(schemas.disable2FA),
  asyncHandler(authController.disable2FA)
);

router.post(
  "/generate-backup-codes",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(authController.generateBackupCodes)
);

// Password management
router.post(
  "/forgot-password",
  rateLimitMiddleware.apiRateLimit(),
  validate(schemas.forgotPassword),
  asyncHandler(authController.forgotPassword)
);

router.post(
  "/reset-password",
  validate(schemas.resetPassword),
  asyncHandler(authController.resetPassword)
);

router.post(
  "/change-password",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  validate(schemas.changePassword),
  asyncHandler(securityController.changePassword)
);

// Profile management
router.put(
  "/update-profile",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  validate(schemas.updateProfile),
  asyncHandler(authController.updateProfile)
);

// Session management
router.get(
  "/validate-session",
  authMiddleware.authenticateToken,
  asyncHandler(authController.validateSession)
);

router.post(
  "/session/sync",
  authMiddleware.optionalAuth,
  asyncHandler(sessionController.syncSession)
);

router.head(
  "/session/sync",
  (req, res) => res.status(200).end()
);

router.get(
  "/sessions",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(sessionController.getSessions)
);

router.post(
  "/sessions/terminate",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  validate(schemas.terminateSession),
  asyncHandler(sessionController.terminateSession)
);

router.post(
  "/sessions/terminate-all",
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(sessionController.terminateAllSessions)
);

// Security
router.post(
  "/verify-device",
  authMiddleware.optionalAuth,
  validate(schemas.verifyDevice),
  asyncHandler(securityController.verifyDevice)
);

router.post(
  "/report-security-issue",
  validate(schemas.reportSecurityIssue),
  asyncHandler(securityController.reportSecurityIssue)
);

// Auth status endpoint
router.get(
  "/status",
  authMiddleware.optionalAuth,
  asyncHandler(authController.getAuthStatus)
);

// User validation endpoint
router.get(
  "/validate",
  authMiddleware.authenticateToken,
  authController.validateUser
);

// Get current user endpoint
router.get(
  "/user",
  authMiddleware.authenticateToken,
  authController.getCurrentUser
);

// Add this endpoint for token validation
router.get(
  "/validate",
  asyncHandler(async (req, res) => {
    try {
      // Check for token in cookies
      const token = req.cookies[cookieConfig.names.ACCESS_TOKEN];
      
      if (!token) {
        return res.status(401).json({ 
          valid: false,
          message: 'No authentication token found'
        });
      }
      
      // Verify the token
      const decoded = await tokenService.verifyAccessToken(token);
      
      // Return validation result
      return res.status(200).json({
        valid: true,
        userId: decoded.userId,
        sessionId: decoded.sessionId
      });
    } catch (error) {
      return res.status(401).json({ 
        valid: false,
        message: 'Invalid or expired token'
      });
    }
  })
);

// Add this endpoint for session validation
router.get(
  "/validate-session",
  asyncHandler(async (req, res) => {
    try {
      // Check for token in cookies
      const token = req.cookies[cookieConfig.names.ACCESS_TOKEN];
      
      if (!token) {
        return res.status(401).json({ 
          valid: false,
          message: 'No authentication token found'
        });
      }
      
      // Verify the token
      const decoded = await tokenService.verifyAccessToken(token);
      
      // Check if session exists and is active
      const session = await Session.findOne({
        _id: decoded.sessionId,
        userId: decoded.userId,
        isActive: true
      });
      
      if (!session) {
        return res.status(401).json({
          valid: false,
          message: 'Session not found or inactive'
        });
      }
      
      // Return validation result
      return res.status(200).json({
        valid: true,
        userId: decoded.userId,
        sessionId: decoded.sessionId
      });
    } catch (error) {
      return res.status(401).json({ 
        valid: false,
        message: 'Invalid or expired token'
      });
    }
  })
);

module.exports = router;
