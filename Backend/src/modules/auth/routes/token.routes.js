/**
 * Token Routes
 * Handles all token-related operations
 */

const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/token.controller');
const rateLimitMiddleware = require('../middleware/rate-limit');
const authMiddleware = require('../middleware/authenticate');
const csrfMiddleware = require('../middleware/csrf');
const { asyncHandler } = require('../../../utils/errorHandlers');

// Refresh tokens
router.post(
  '/refresh-token', // Match the frontend endpoint
  rateLimitMiddleware.refreshTokenRateLimit(),
  asyncHandler(tokenController.refreshTokens)
);

// Generate CSRF token
router.get(
  '/csrf',
  authMiddleware.optionalAuth,
  asyncHandler(tokenController.generateCsrfToken)
);

// Validate token
router.post(
  '/validate',
  asyncHandler(tokenController.validateToken)
);

// Revoke token
router.post(
  '/revoke',
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(tokenController.revokeToken)
);

// Verify access token
router.get(
  '/verify',
  asyncHandler(tokenController.verifyAccessToken)
);

module.exports = router;
