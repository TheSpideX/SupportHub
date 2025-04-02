/**
 * Token Routes
 * Handles all token-related operations
 * 
 * These routes serve as fallback mechanisms when WebSocket connections
 * are unavailable or experiencing issues. The primary authentication flow
 * should use WebSockets when available.
 */

const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/token.controller');
const rateLimitMiddleware = require('../middleware/rate-limit');
const authMiddleware = require('../middleware/authenticate');
const csrfMiddleware = require('../middleware/csrf');
const { asyncHandler } = require('../../../utils/errorHandlers');
const { validateRequest } = require('../middleware/validate');

// ===== Core Token Operations =====

// // Generate CSRF token
// router.get(
//   '/csrf',
//   authMiddleware.optionalAuth,
//   asyncHandler(tokenController.generateCsrfToken)
// );

// // Refresh token endpoint (explicit refresh when needed)
// router.post(
//   '/refresh',
//   authMiddleware.authenticateRefreshToken,
//   csrfMiddleware.validateToken,
//   asyncHandler(tokenController.refreshToken)
// );

// // ===== WebSocket Token Management =====

// // First, let's check if the method exists
// console.log('Controller methods available:', Object.keys(tokenController));
// console.log('generateWebSocketToken exists:', !!tokenController.generateWebSocketToken);

// // Generate WebSocket authentication token
// router.post(
//   '/ws-auth',
//   rateLimitMiddleware.apiRateLimit(),
//   validateRequest({
//     body: {
//       deviceId: { type: 'string', required: true },
//       tabId: { type: 'string', required: true }
//     }
//   }),
//   // Use a safe wrapper that checks if the method exists
//   (req, res, next) => {
//     if (typeof tokenController.generateWebSocketToken === 'function') {
//       return tokenController.generateWebSocketToken(req, res, next);
//     } else {
//       console.error('generateWebSocketToken is not a function:', tokenController.generateWebSocketToken);
//       return res.status(500).json({ error: 'Internal server error' });
//     }
//   }
// );

// // Validate WebSocket token - with safe wrapper
// router.post(
//   '/ws-validate',
//   (req, res, next) => {
//     if (typeof tokenController.validateWebSocketToken === 'function') {
//       return tokenController.validateWebSocketToken(req, res, next);
//     } else {
//       console.error('validateWebSocketToken is not a function:', tokenController.validateWebSocketToken);
//       return res.status(500).json({ error: 'Internal server error' });
//     }
//   }
// );

// // WebSocket token management (for initial setup when WebSocket connects)
// router.post(
//   '/ws-token',
//   authMiddleware.authenticateToken,
//   csrfMiddleware.validateToken,
//   tokenController.generateWebSocketToken  // Direct reference
// );

// // Make sure this controller method exists
// router.post(
//   '/ws-token/validate',
//   tokenController.validateWebSocketToken  // Direct reference
// );

// // ===== Token Validation Fallbacks =====

// // Validate token (fallback when WebSocket is unavailable)
// router.post(
//   '/validate',
//   tokenController.validateToken  // Direct reference
// );

// // Verify access token (fallback when WebSocket is unavailable)
// router.get(
//   '/verify',
//   tokenController.verifyAccessToken  // Direct reference
// );

// // Token expiration check (fallback when WebSocket is unavailable)
// router.get(
//   '/expiration',
//   authMiddleware.authenticateToken,
//   asyncHandler(tokenController.getTokenExpiration)
// );

// // Token refresh notification endpoint (fallback for cross-tab coordination)
// router.post(
//   '/refresh-notification',
//   authMiddleware.authenticateToken,
//   csrfMiddleware.validateToken,
//   asyncHandler(tokenController.sendRefreshNotification)
// );

module.exports = router;
