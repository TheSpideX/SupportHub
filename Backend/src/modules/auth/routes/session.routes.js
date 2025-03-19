const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const sessionController = require('../controllers/session.controller');
const { apiRateLimit } = require('../middleware/rateLimit.middleware');
const csrfProtection = require('../middleware/csrf.middleware').protect;

const router = express.Router();

// Apply authentication to all session routes
router.use(authenticate);

// Get all active sessions for current user
router.get('/', apiRateLimit(), sessionController.getUserSessions);

// Terminate a specific session
router.delete('/:sessionId', apiRateLimit(), csrfProtection, sessionController.terminateSession);

// Terminate all sessions except current
router.delete('/', apiRateLimit(), csrfProtection, sessionController.terminateAllSessions);

// Sync session data (for cross-tab synchronization)
router.post('/sync', apiRateLimit({ max: 60 }), csrfProtection, sessionController.syncSession);

// Export router
module.exports = router;