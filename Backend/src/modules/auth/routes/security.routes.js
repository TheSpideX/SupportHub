/**
 * Security Routes
 * Handles security-related operations and notifications
 */

const express = require('express');
const router = express.Router();
const securityController = require('../controllers/security.controller');
const { authenticateToken, csrfProtection } = require('../middleware');
const { validateRequest } = require('../middleware/validate');
const rateLimitMiddleware = require('../middleware/rate-limit');

// ===== Security Settings =====

// Get security settings
router.get(
  '/settings',
  authenticateToken,
  securityController.getSecuritySettings
);

// Update security settings
router.put(
  '/settings',
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      requireMfa: { type: 'boolean', optional: true },
      sessionTimeout: { type: 'number', optional: true },
      trustedDevicesOnly: { type: 'boolean', optional: true }
    }
  }),
  securityController.updateSecuritySettings
);

// ===== Two-Factor Authentication =====

// Setup 2FA
router.post(
  '/2fa/setup',
  authenticateToken,
  csrfProtection,
  securityController.setup2FA
);

// Verify 2FA setup
router.post(
  '/2fa/verify-setup',
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      token: { type: 'string', required: true }
    }
  }),
  securityController.verify2FASetup
);

// Disable 2FA
router.post(
  '/2fa/disable',
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      token: { type: 'string', required: true }
    }
  }),
  securityController.disable2FA
);

// Verify 2FA token
router.post(
  '/2fa/verify',
  rateLimitMiddleware.apiRateLimit(),
  validateRequest({
    body: {
      token: { type: 'string', required: true },
      sessionId: { type: 'string', required: true }
    }
  }),
  securityController.verify2FAToken
);

// ===== Device Verification =====

// Verify device
router.post(
  '/devices/verify',
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      deviceId: { type: 'string', required: true },
      verificationCode: { type: 'string', required: true }
    }
  }),
  securityController.verifyDevice
);

// Remove trusted device
router.delete(
  '/devices/:deviceId',
  authenticateToken,
  csrfProtection,
  securityController.removeTrustedDevice
);

// ===== Security Events =====

// Get security events
router.get(
  '/events',
  authenticateToken,
  securityController.getSecurityEvents
);

// Acknowledge security event
router.post(
  '/events/:eventId/acknowledge',
  authenticateToken,
  csrfProtection,
  securityController.acknowledgeSecurityEvent
);

// Report security issue
router.post(
  '/report',
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      issueType: { type: 'string', required: true },
      description: { type: 'string', required: true }
    }
  }),
  securityController.reportSecurityIssue
);

// ===== Security Notifications =====

// Get security notifications (fallback for WebSocket security events)
router.get(
  '/notifications',
  authenticateToken,
  securityController.getSecurityNotifications
);

module.exports = router;
