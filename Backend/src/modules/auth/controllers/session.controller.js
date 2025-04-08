/**
 * Session Controller
 * Handles all session-related operations
 */
const { AppError } = require("../../../utils/errors");
const sessionService = require("../services/session.service");
const tokenService = require("../services/token.service");
const cookieConfig = require("../config/cookie.config");
const logger = require("../../../utils/logger");
const asyncHandler = require("../../../utils/asyncHandler");

/**
 * Validate session
 * @route GET /api/auth/session/validate
 */
exports.validateSession = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sessionId = req.session.id;

    // Validate session using service
    const validationResult = await sessionService.validateSession(sessionId);

    if (!validationResult.valid) {
      return res.status(200).json({
        success: true,
        authenticated: false,
        reason: validationResult.reason,
      });
    }

    // Refresh tokens and set cookies
    const { accessToken, refreshToken } = await tokenService.generateAuthTokens(
      userId,
      req.user.security.tokenVersion,
      sessionId,
      validationResult.session.rememberMe || false
    );

    // Set both HTTP-only token cookies
    tokenService.setTokenCookies(res, { accessToken, refreshToken });

    // Get session info using service
    const sessionInfo = await sessionService.getSessionInfo(sessionId);

    return res.status(200).json({
      success: true,
      authenticated: true,
      data: {
        user: { id: userId },
        session: sessionInfo,
      },
    });
  } catch (error) {
    logger.error("Session validation error:", error);
    return next(
      new AppError(
        "Failed to validate session",
        500,
        "SESSION_VALIDATION_ERROR"
      )
    );
  }
};

/**
 * Synchronize session across tabs
 * @route POST /api/auth/session/sync
 */
exports.syncSession = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { tabId, clientInfo, scope, deviceId } = req.body;

    // Sync session using service
    const syncResult = await sessionService.syncSession(sessionId, {
      tabId,
      clientInfo,
      userId: req.user._id,
      scope: scope || "device",
      deviceId: deviceId,
    });

    if (!syncResult.success) {
      return next(
        new AppError(syncResult.message, syncResult.statusCode, syncResult.code)
      );
    }

    // Broadcast event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        sessionId,
        "session-update",
        syncResult.eventData
      );
    }

    return res.status(200).json({
      success: true,
      data: syncResult.sessionInfo,
    });
  } catch (error) {
    logger.error("Session sync error:", error);
    return next(
      new AppError("Failed to sync session", 500, "SESSION_SYNC_ERROR")
    );
  }
};

/**
 * Update tab focus state
 * @route POST /api/auth/session/tab-focus
 * @access Private - Requires authentication
 */
exports.updateTabFocus = async (req, res, next) => {
  try {
    const sessionId = req.session._id;
    const { tabId, hasFocus } = req.body;

    // Update tab focus using service
    const result = await sessionService.updateTabFocus(
      sessionId,
      tabId,
      hasFocus
    );

    if (!result.success) {
      return next(
        new AppError(result.message, result.statusCode || 400, result.code)
      );
    }

    // Broadcast tab focus update if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        sessionId,
        "tab-focus-changed",
        { tabId, hasFocus }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Tab focus updated",
      data: { tabId, hasFocus },
    });
  } catch (error) {
    logger.error("Error updating tab focus:", error);
    return next(new AppError("Failed to update tab focus", 500));
  }
};

/**
 * Acknowledge session timeout warning
 * @route POST /api/auth/session/timeout-warning/acknowledge
 * @access Private - Requires authentication and CSRF protection
 */
exports.acknowledgeTimeoutWarning = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { warningId } = req.body;

    if (!warningId) {
      return next(new AppError("Warning ID is required", 400));
    }

    // Acknowledge warning using service
    const result = await sessionService.acknowledgeWarning(
      sessionId,
      warningId
    );

    if (!result.success) {
      return next(new AppError(result.message, result.statusCode));
    }

    // Broadcast event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        sessionId,
        "warning-acknowledged",
        { warningId }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Warning acknowledged",
      data: { warningId },
    });
  } catch (error) {
    logger.error("Error acknowledging timeout warning:", error);
    return next(new AppError("Failed to acknowledge timeout warning", 500));
  }
};

/**
 * Extend session
 * @route POST /api/auth/session/extend
 * @access Private - Requires authentication and CSRF protection
 */
exports.extendSession = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { reason } = req.body;

    // Extend session using service
    const result = await sessionService.extendSession(sessionId, reason);

    if (!result.success) {
      return next(new AppError(result.message, result.statusCode));
    }

    // Broadcast event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        sessionId,
        "session-extended",
        result.eventData
      );
    }

    return res.status(200).json({
      success: true,
      message: "Session extended",
      data: result.sessionInfo,
    });
  } catch (error) {
    logger.error("Error extending session:", error);
    return next(new AppError("Failed to extend session", 500));
  }
};

/**
 * Poll for session events (fallback when WebSocket is down)
 * @route GET /api/auth/session/events
 * @access Private - Requires authentication
 */
exports.pollSessionEvents = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { lastEventId } = req.query;

    // Get events and update activity using service
    const result = await sessionService.pollSessionEvents(
      sessionId,
      lastEventId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Error polling session events:", error);
    return next(new AppError("Failed to poll session events", 500));
  }
};

/**
 * Check authentication status
 * @route GET /api/auth/session/check
 */
exports.checkAuthStatus = async (req, res) => {
  // Get access token from cookie
  const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];

  if (!accessToken) {
    return res.status(200).json({
      authenticated: false,
      reason: "NO_TOKEN",
    });
  }

  try {
    // Use service to check auth status
    const result = await sessionService.checkAuthStatus(accessToken);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(200).json({
      authenticated: false,
      reason:
        error.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
    });
  }
};

/**
 * Join session rooms for WebSocket
 * @route POST /api/auth/session/join-rooms
 */
exports.joinSessionRooms = async (req, res, next) => {
  try {
    const { socketId, tabId } = req.body;
    const userId = req.user._id;
    const sessionId = req.session.id;

    if (!socketId || !tabId) {
      return next(new AppError("Socket ID and Tab ID are required", 400));
    }

    // Get socket instance from io
    const io = req.io;
    if (!io) {
      return next(new AppError("WebSocket server not available", 500));
    }

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      return next(new AppError("Socket not found", 404));
    }

    // Join hierarchical rooms using service
    await sessionService.joinSessionRooms(socket, {
      userId,
      sessionId,
      tabId,
      deviceId: req.session.deviceId,
    });

    return res.status(200).json({
      success: true,
      message: "Joined session rooms successfully",
    });
  } catch (error) {
    logger.error("Error joining session rooms:", error);
    return next(new AppError("Failed to join session rooms", 500));
  }
};

/**
 * Get active sessions for user
 * @route GET /api/auth/session/active
 */
exports.getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const sessions = await sessionService.getActiveSessions(userId);

    return res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    logger.error("Error fetching active sessions:", error);
    return next(new AppError("Failed to fetch active sessions", 500));
  }
};

/**
 * Terminate session
 * @route POST /api/auth/session/terminate
 */
exports.terminateSession = async (req, res, next) => {
  try {
    const { targetSessionId } = req.body;
    const userId = req.user._id;

    if (!targetSessionId) {
      return next(new AppError("Session ID is required", 400));
    }

    // Terminate session using service
    const result = await sessionService.terminateSession(
      targetSessionId,
      userId
    );

    if (!result.success) {
      return next(new AppError(result.message, result.statusCode));
    }

    // Broadcast termination event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionTermination(
        req.io,
        userId,
        targetSessionId,
        "user-terminated"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Session terminated successfully",
    });
  } catch (error) {
    logger.error("Error terminating session:", error);
    return next(new AppError("Failed to terminate session", 500));
  }
};

/**
 * Terminate all sessions except current
 * @route POST /api/auth/session/terminate-all
 * @access Private - Requires authentication and CSRF protection
 */
exports.terminateAllSessions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const currentSessionId = req.session.id;

    // Terminate all sessions except current using service
    const result = await sessionService.endAllUserSessionsExceptCurrent(
      userId,
      currentSessionId
    );

    // Broadcast termination event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        userId,
        "session-terminated-all",
        {
          initiatedBy: currentSessionId,
          reason: "user-requested",
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Successfully terminated ${result} sessions`,
      terminatedCount: result,
    });
  } catch (error) {
    logger.error("Error terminating all sessions:", error);
    return next(new AppError("Failed to terminate sessions", 500));
  }
};

/**
 * Update session state
 */
exports.updateSessionState = asyncHandler(async (req, res) => {
  const { state } = req.body;
  const userId = req.user._id;
  const sessionId = req.session._id;
  const deviceId = req.device._id;
  const tabId = req.headers["x-tab-id"];

  // Use cross-tab service to update state with proper synchronization
  await crossTabService.updateSharedState(
    userId,
    deviceId,
    tabId,
    "session",
    state,
    true // sync across tabs
  );

  // Return success
  res.status(200).json({
    status: "success",
    message: "Session state updated",
  });
});

/**
 * Get session state
 */
exports.getSessionState = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const deviceId = req.device._id;

  // Get synchronized state
  const state = await crossTabService.getSharedState(
    userId,
    deviceId,
    "session"
  );

  res.status(200).json({
    status: "success",
    data: {
      state,
    },
  });
});

/**
 * Get session status
 * @route GET /api/auth/session/status
 * @access Public - Uses token from cookie
 */
exports.getSessionStatus = async (req, res) => {
  try {
    // Log all cookies for debugging
    logger.debug("Session status request cookies:", {
      cookies: req.cookies,
      cookieHeader: req.headers.cookie,
      accessTokenName: cookieConfig.names.ACCESS_TOKEN,
    });

    // Get access token from cookie
    const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];

    if (!accessToken) {
      logger.debug("No access token found in cookies");
      return res.status(200).json({
        active: false,
        authenticated: false,
        reason: "NO_TOKEN",
      });
    }

    try {
      // Verify token without throwing
      const decoded = await tokenService.verifyAccessToken(accessToken);

      if (!decoded || !decoded.sessionId) {
        return res.status(200).json({
          active: false,
          authenticated: false,
          reason: "INVALID_TOKEN",
        });
      }

      // Get session info
      const sessionInfo = await sessionService.getSessionInfo(
        decoded.sessionId
      );

      if (!sessionInfo) {
        return res.status(200).json({
          active: false,
          authenticated: false,
          reason: "SESSION_NOT_FOUND",
        });
      }

      return res.status(200).json({
        active: true,
        authenticated: true,
        session: sessionInfo,
      });
    } catch (error) {
      return res.status(200).json({
        active: false,
        reason:
          error.name === "TokenExpiredError"
            ? "TOKEN_EXPIRED"
            : "INVALID_TOKEN",
      });
    }
  } catch (error) {
    logger.error("Error getting session status:", error);
    return res.status(500).json({
      active: false,
      reason: "SERVER_ERROR",
    });
  }
};

/**
 * Get session details by ID
 * @route GET /api/auth/session/:sessionId
 * @access Private - Requires authentication
 */
exports.getSessionById = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    // Check if session exists and belongs to user
    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      return next(new AppError("Session not found", 404, "SESSION_NOT_FOUND"));
    }

    // Security check - ensure user can only access their own sessions
    if (session.userId.toString() !== userId.toString()) {
      return next(
        new AppError("Unauthorized access to session", 403, "FORBIDDEN")
      );
    }

    // Get formatted session info for client
    const sessionInfo = await sessionService.getSessionInfo(sessionId, {
      includeDetails: true,
    });

    return res.status(200).json({
      success: true,
      data: sessionInfo,
    });
  } catch (error) {
    logger.error("Error getting session by ID:", error);
    return next(new AppError("Failed to retrieve session details", 500));
  }
};

/**
 * Update session activity (heartbeat)
 * @route POST /api/auth/session/heartbeat
 * @access Private - Requires authentication
 */
exports.updateSessionActivity = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { tabId } = req.body;

    // Update session activity
    const result = await sessionService.updateSessionActivity(sessionId);

    // If tabId is provided, update tab activity as well
    if (tabId) {
      await sessionService.updateTabActivity(sessionId, tabId, req.body);
    }

    return res.status(200).json({
      success: true,
      message: "Session activity updated",
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    logger.error("Error updating session activity:", error);
    return next(new AppError("Failed to update session activity", 500));
  }
};

/**
 * Acknowledge session warning
 * @route POST /api/auth/session/acknowledge-warning
 * @access Private - Requires authentication and CSRF protection
 */
exports.acknowledgeWarning = async (req, res, next) => {
  try {
    const sessionId = req.session._id;
    const { warningType } = req.body;

    if (!["IDLE", "ABSOLUTE", "SECURITY"].includes(warningType)) {
      return next(
        new AppError("Invalid warning type", 400, "INVALID_WARNING_TYPE")
      );
    }

    // Acknowledge warning using service
    const result = await sessionService.acknowledgeSessionWarning(
      sessionId,
      warningType
    );

    if (!result.success) {
      return next(
        new AppError(result.message, result.statusCode || 400, result.code)
      );
    }

    // Broadcast event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        sessionId,
        "warning-acknowledged",
        { warningType, timestamp: new Date() }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Warning acknowledged",
      data: {
        warningType,
        acknowledgedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error("Error acknowledging warning:", error);
    return next(new AppError("Failed to acknowledge warning", 500));
  }
};

/**
 * Update tab activity
 * @route POST /api/auth/session/tab-activity
 * @access Private - Requires authentication
 */
exports.updateTabActivity = async (req, res, next) => {
  try {
    const sessionId = req.session._id;
    const { tabId, activity, timestamp } = req.body;

    // Update tab activity using service
    const result = await sessionService.updateTabActivity(
      sessionId,
      tabId,
      activity,
      new Date(timestamp)
    );

    if (!result.success) {
      return next(
        new AppError(result.message, result.statusCode || 400, result.code)
      );
    }

    // Broadcast tab activity update if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        sessionId,
        "tab-activity-updated",
        {
          tabId,
          activity,
          timestamp: new Date(timestamp),
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Tab activity updated",
      data: {
        tabId,
        activity,
        timestamp: new Date(timestamp),
      },
    });
  } catch (error) {
    logger.error("Error updating tab activity:", error);
    return next(new AppError("Failed to update tab activity", 500));
  }
};

/**
 * Register WebSocket connection
 * @route POST /api/auth/session/ws-connect
 * @access Private - Requires authentication and CSRF protection
 */
exports.registerWebSocketConnection = async (req, res, next) => {
  try {
    const sessionId = req.session._id;
    const userId = req.user._id;
    const { tabId, deviceId } = req.body;

    // Register connection using service
    const result = await sessionService.registerWebSocketConnection(
      userId,
      sessionId,
      tabId,
      deviceId
    );

    if (!result.success) {
      return next(
        new AppError(result.message, result.statusCode || 400, result.code)
      );
    }

    return res.status(200).json({
      success: true,
      message: "WebSocket connection registered",
      data: {
        connectionId: result.connectionId,
        sessionId,
        tabId,
        deviceId,
      },
    });
  } catch (error) {
    logger.error("Error registering WebSocket connection:", error);
    return next(new AppError("Failed to register WebSocket connection", 500));
  }
};

/**
 * Unregister WebSocket connection
 * @route POST /api/auth/session/ws-disconnect
 * @access Private - Requires authentication
 */
exports.unregisterWebSocketConnection = async (req, res, next) => {
  try {
    const sessionId = req.session._id;
    const { connectionId } = req.body;

    // Unregister connection using service
    const result = await sessionService.unregisterWebSocketConnection(
      sessionId,
      connectionId
    );

    if (!result.success) {
      return next(
        new AppError(result.message, result.statusCode || 400, result.code)
      );
    }

    return res.status(200).json({
      success: true,
      message: "WebSocket connection unregistered",
    });
  } catch (error) {
    logger.error("Error unregistering WebSocket connection:", error);
    return next(new AppError("Failed to unregister WebSocket connection", 500));
  }
};

/**
 * Register device
 * @route POST /api/auth/session/devices
 * @access Private - Requires authentication and CSRF protection
 */
exports.registerDevice = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { deviceId, deviceName, deviceType } = req.body;

    // Register device using service
    const result = await sessionService.registerDevice(
      userId,
      deviceId,
      deviceName,
      deviceType
    );

    if (!result.success) {
      return next(
        new AppError(result.message, result.statusCode || 400, result.code)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Device registered successfully",
      data: result.device,
    });
  } catch (error) {
    logger.error("Error registering device:", error);
    return next(new AppError("Failed to register device", 500));
  }
};

/**
 * Update device info
 * @route PUT /api/auth/session/devices/:deviceId
 * @access Private - Requires authentication and CSRF protection
 */
exports.updateDeviceInfo = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { deviceId } = req.params;
    const { deviceName, trusted } = req.body;

    // Update device using service
    const result = await sessionService.updateDeviceInfo(userId, deviceId, {
      deviceName,
      trusted,
    });

    if (!result.success) {
      return next(
        new AppError(result.message, result.statusCode || 400, result.code)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Device updated successfully",
      data: result.device,
    });
  } catch (error) {
    logger.error("Error updating device info:", error);
    return next(new AppError("Failed to update device info", 500));
  }
};
