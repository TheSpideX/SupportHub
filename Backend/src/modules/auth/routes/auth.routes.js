/**
 * Auth Routes
 * Handles core authentication operations
 * 
 * These routes provide both primary HTTP endpoints and fallbacks for
 * WebSocket functionality when connections are unavailable.
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

// // Health check endpoint
// router.get("/health", (req, res) => {
//   res.status(200).json({
//     status: "ok",
//     module: "auth",
//     timestamp: new Date().toISOString()
//   });
// });

// // ===== Core Authentication Endpoints =====

// router.post(
//   "/login",
//   rateLimitMiddleware.loginRateLimit(),
//   validate(schemas.login),
//   asyncHandler(authController.login)
// );

// router.post(
//   "/logout",
//   authMiddleware.authenticateToken,
//   csrfMiddleware.validateToken,
//   asyncHandler(authController.logout)
// );

// router.post(
//   "/register",
//   rateLimitMiddleware.registrationRateLimit(),
//   validate(schemas.register),
//   asyncHandler(authController.register)
// );

// // ===== Email Verification =====

// router.post(
//   "/verify-email",
//   validate(schemas.verifyEmail),
//   asyncHandler(authController.verifyEmail)
// );

// router.post(
//   "/resend-verification",
//   rateLimitMiddleware.apiRateLimit(),
//   validate(schemas.resendVerification),
//   asyncHandler(authController.resendVerification)
// );

// // ===== Auth Status & User Info =====

// // Auth status endpoint - focused on authentication state only
// router.get(
//   "/status",
//   authMiddleware.optionalAuth,
//   asyncHandler(authController.getAuthStatus)
// );

// // Get current user info
// router.get(
//   "/me",
//   authMiddleware.authenticateToken,
//   asyncHandler(authController.getCurrentUser)
// );

// // ===== WebSocket Fallbacks =====

// // Check for permission changes (fallback for WebSocket permission updates)
// router.get(
//   "/permissions",
//   authMiddleware.authenticateToken,
//   asyncHandler(authController.getUserPermissions)
// );

// // ===== Cross-Tab Authentication State =====

// // Sync authentication state across tabs (fallback for WebSocket tab room)
// router.post(
//   "/sync-state",
//   authMiddleware.authenticateToken,
//   validate(schemas.syncState),
//   asyncHandler(authController.syncAuthState)
// );

// // Poll for auth state changes (fallback when WebSocket is down)
// router.get(
//   "/poll-state",
//   authMiddleware.authenticateToken,
//   asyncHandler(authController.pollAuthState)
// );

// // ===== WebSocket Connection Fallbacks =====

// // Register tab connection (fallback for WebSocket tab room)
// router.post(
//   "/register-tab",
//   authMiddleware.authenticateToken,
//   validate(schemas.registerTab),
//   asyncHandler(authController.registerTab)
// );

// // Unregister tab connection (fallback for WebSocket disconnect)
// router.post(
//   "/unregister-tab",
//   authMiddleware.authenticateToken,
//   validate(schemas.unregisterTab),
//   asyncHandler(authController.unregisterTab)
// );

module.exports = router;
