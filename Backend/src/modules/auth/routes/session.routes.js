/**
 * Session Routes
 * Handles all session-related operations
 *
 * These routes provide both primary HTTP endpoints and fallbacks for
 * WebSocket functionality when connections are unavailable.
 */

const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/session.controller");
const { authenticateToken, csrfProtection } = require("../middleware");
const { validateRequest } = require("../middleware/validate");
const { sessionValidationRateLimit } = require("../middleware/rate-limit");

// ===== Core Session Operations =====

// Validate current session
router.get(
  "/validate",
  sessionValidationRateLimit(),
  authenticateToken,
  sessionController.validateSession
);

// Session status - focused on session details (expiry, activity)
router.get(
  "/status",
  sessionValidationRateLimit(),
  sessionController.getSessionStatus
);

// Get session details
router.get("/:sessionId", authenticateToken, sessionController.getSessionById);

// ===== Session Management =====

// Get active sessions for current user
router.get(
  "/active",
  authenticateToken,
  csrfProtection,
  sessionController.getActiveSessions
);

// Terminate specific session
router.delete(
  "/:sessionId",
  authenticateToken,
  csrfProtection,
  sessionController.terminateSession
);

// Terminate all sessions except current
router.post(
  "/terminate-all",
  authenticateToken,
  csrfProtection,
  sessionController.terminateAllSessions
);

// ===== Activity Tracking =====

// Update session activity (heartbeat)
router.post(
  "/heartbeat",
  authenticateToken,
  sessionController.updateSessionActivity
);

// Endpoint to acknowledge session warnings
router.post(
  "/acknowledge-warning",
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      warningType: { type: "string", enum: ["IDLE", "ABSOLUTE", "SECURITY"] },
    },
  }),
  sessionController.acknowledgeWarning
);

// ===== Cross-Tab Synchronization =====

// Session synchronization endpoint for cross-tab communication
router.post(
  "/sync",
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      tabId: { type: "string", optional: true },
      screenSize: { type: "object", optional: true },
      lastUserActivity: { type: "date", optional: true },
    },
  }),
  sessionController.syncSession
);

// ===== WebSocket Fallbacks =====

// Tab activity update (fallback for WebSocket tab room)
router.post(
  "/tab-activity",
  authenticateToken,
  validateRequest({
    body: {
      tabId: { type: "string", required: true },
      activity: { type: "string", required: true },
      timestamp: { type: "date", required: true },
    },
  }),
  sessionController.updateTabActivity
);

// Tab focus change (fallback for WebSocket tab events)
router.post(
  "/tab-focus",
  authenticateToken,
  validateRequest({
    body: {
      tabId: { type: "string", required: true },
      hasFocus: { type: "boolean", required: true },
    },
  }),
  sessionController.updateTabFocus
);

// Session timeout warning acknowledgment (fallback for WebSocket)
router.post(
  "/timeout-warning/acknowledge",
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      warningId: { type: "string", required: true },
    },
  }),
  sessionController.acknowledgeTimeoutWarning
);

// Request session extension (fallback for WebSocket)
router.post(
  "/extend",
  authenticateToken,
  csrfProtection,
  sessionController.extendSession
);

// Poll for session events (fallback when WebSocket is down)
router.get("/events", authenticateToken, sessionController.pollSessionEvents);

// ===== WebSocket Connection Management =====

// WebSocket session management
router.post(
  "/ws-connect",
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      tabId: { type: "string", required: true },
      deviceId: { type: "string", required: true },
    },
  }),
  sessionController.registerWebSocketConnection
);

router.post(
  "/ws-disconnect",
  authenticateToken,
  validateRequest({
    body: {
      connectionId: { type: "string", required: true },
    },
  }),
  sessionController.unregisterWebSocketConnection
);

// ===== Device Management =====

// Register new device (fallback for WebSocket device room)
router.post(
  "/devices",
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      deviceId: { type: "string", required: true },
      deviceName: { type: "string", required: true },
      deviceType: { type: "string", required: true },
    },
  }),
  sessionController.registerDevice
);

// Update device info (fallback for WebSocket device room)
router.put(
  "/devices/:deviceId",
  authenticateToken,
  csrfProtection,
  validateRequest({
    body: {
      deviceName: { type: "string", optional: true },
      trusted: { type: "boolean", optional: true },
    },
  }),
  sessionController.updateDeviceInfo
);

module.exports = router;
