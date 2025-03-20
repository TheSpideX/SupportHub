/**
 * Session Routes
 * Handles all session-related operations
 */

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const { authenticateToken, csrfProtection } = require('../middleware');
const { validateRequest } = require('../middleware/validate');

// Validate current session
router.get(
  '/validate',
  authenticateToken,
  sessionController.validateSession
);

// Session synchronization endpoint for cross-tab communication
router.post('/sync', 
  authenticateToken, 
  csrfProtection,
  validateRequest({
    body: {
      tabId: { type: 'string', optional: true },
      screenSize: { type: 'object', optional: true },
      lastUserActivity: { type: 'date', optional: true }
    }
  }),
  sessionController.syncSession
);

// Endpoint to acknowledge session warnings
router.post('/acknowledge-warning',
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      warningType: { type: 'string', enum: ['IDLE', 'ABSOLUTE', 'SECURITY'] }
    }
  }),
  sessionController.acknowledgeWarning
);

// Add the simplified test routes for debugging
router.post('/sync-test', (req, res) => {
  res.status(200).json({ message: 'Test route working' });
});

// Get active sessions for current user
router.get('/active',
  authenticateToken,
  csrfProtection,
  sessionController.getActiveSessions
);

// Terminate specific session
router.delete('/:sessionId',
  authenticateToken,
  csrfProtection,
  sessionController.terminateSession
);

// Terminate all sessions except current
router.post(
  '/terminate-all',
  authenticateToken,
  csrfProtection,
  sessionController.terminateAllSessions
);

// Get session details
router.get(
  '/:sessionId',
  authenticateToken,
  sessionController.getSessionById
);

// Update session activity (heartbeat)
router.post(
  '/heartbeat',
  authenticateToken,
  sessionController.updateSessionActivity
);

module.exports = router;
