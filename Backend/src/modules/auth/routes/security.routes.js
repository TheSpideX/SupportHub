/**
 * Security Routes
 * Handles security-related operations
 */

const express = require('express');
const router = express.Router();
const securityController = require('../controllers/security.controller');
const authMiddleware = require('../middleware/authenticate');
const csrfMiddleware = require('../middleware/csrf');
const rateLimitMiddleware = require('../middleware/rate-limit');
const validate = require('../../../middleware/validate');
const schemas = require('../validations/schemas');
const { asyncHandler } = require('../../../utils/errorHandlers');

// Two-factor authentication
router.post(
  '/verify-2fa',
  rateLimitMiddleware.apiRateLimit(),
  validate(schemas.verify2FA),
  asyncHandler(securityController.verify2FA)
);

router.post(
  '/setup-2fa',
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(securityController.setup2FA)
);

router.post(
  '/disable-2fa',
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  validate(schemas.disable2FA),
  asyncHandler(securityController.disable2FA)
);

router.post(
  '/generate-backup-codes',
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(securityController.generateBackupCodes)
);

// Device verification
router.post(
  '/verify-device',
  authMiddleware.optionalAuth,
  validate(schemas.verifyDevice),
  asyncHandler(securityController.verifyDevice)
);

// Security events
router.get(
  '/events',
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  asyncHandler(securityController.getSecurityEvents)
);

// Security settings
router.get(
  '/settings',
  authMiddleware.authenticateToken,
  asyncHandler(securityController.getSecuritySettings)
);

router.put(
  '/settings',
  authMiddleware.authenticateToken,
  csrfMiddleware.validateToken,
  validate(schemas.updateSecuritySettings),
  asyncHandler(securityController.updateSecuritySettings)
);

// Report security issue
router.post(
  '/report-issue',
  validate(schemas.reportSecurityIssue),
  asyncHandler(securityController.reportSecurityIssue)
);

module.exports = router;