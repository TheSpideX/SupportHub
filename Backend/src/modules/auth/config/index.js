/**
 * Centralized auth configuration
 * Single source of truth for all auth-related settings
 * Includes WebSocket authentication system with hierarchical rooms
 */
const tokenConfig = require("./token.config");
const sessionConfig = require("./session.config");
const securityConfig = require("./security.config");
const cookieConfig = require("./cookie.config");
const socketAdapterConfig = require("./socket-adapter.config");
const roomRegistryConfig = require("./room-registry.config");
const eventPropagationConfig = require("./event-propagation.config");
const websocketConfig = require("./websocket.config");

// Validate configuration for consistency
function validateConfig() {
  // Ensure token and session expiry times are aligned
  if (tokenConfig.expiry.refresh !== sessionConfig.store.ttl) {
    console.log(
      `Aligning refresh token expiry (${tokenConfig.expiry.refresh}s) with session TTL (${sessionConfig.store.ttl}s)`
    );
    // Align them - use the refresh token expiry as the source of truth
    sessionConfig.store.ttl = tokenConfig.expiry.refresh;
  }

  // Ensure CSRF token expiry matches in all places
  const csrfExpiryInSeconds = tokenConfig.expiry.csrf;
  const cookieCsrfMaxAge = cookieConfig.csrfOptions?.maxAge || 0;

  if (csrfExpiryInSeconds * 1000 !== cookieCsrfMaxAge) {
    console.warn("WARNING: CSRF token expiry times are not consistent");
    // Align them
    if (!cookieConfig.csrfOptions) {
      cookieConfig.csrfOptions = {};
    }
    cookieConfig.csrfOptions.maxAge = csrfExpiryInSeconds * 1000;
  }

  // Ensure cookie domains match if specified
  const domain = cookieConfig.baseOptions?.domain;
  const csrfDomain = cookieConfig.csrfOptions?.domain;

  if (domain && csrfDomain && domain !== csrfDomain) {
    console.warn(
      "WARNING: Cookie domains are not consistent between base and CSRF options"
    );
  }

  // Ensure cookies are set as HTTP-only
  if (!cookieConfig.baseOptions?.httpOnly) {
    console.warn("WARNING: HTTP-only flag not set for auth cookies");
    // Set HTTP-only flag
    if (!cookieConfig.baseOptions) {
      cookieConfig.baseOptions = {};
    }
    cookieConfig.baseOptions.httpOnly = true;
  }

  // Validate WebSocket-related configurations
  validateWebSocketConfig();

  return true;
}

// Validate WebSocket-specific configurations
function validateWebSocketConfig() {
  // Ensure session TTL and room registry TTL are aligned
  if (sessionConfig.store.ttl !== roomRegistryConfig.storage.roomTTL) {
    console.log(
      `Aligning session TTL (${sessionConfig.store.ttl}s) with room registry TTL (${roomRegistryConfig.storage.roomTTL}s)`
    );
    // Align them - use the session TTL as the source of truth
    roomRegistryConfig.storage.roomTTL = sessionConfig.store.ttl;
    roomRegistryConfig.storage.metadataTTL = sessionConfig.store.ttl;
  }

  // Ensure token expiry warning time is configured for WebSocket notifications
  const tokenWarningTime = tokenConfig.socket?.expiryWarningTime || 0;
  if (tokenWarningTime <= 0) {
    console.warn(
      "WARNING: Token warning threshold not set for WebSocket notifications"
    );
    // Set a default (5 minutes before expiry)
    if (!tokenConfig.socket) tokenConfig.socket = {};
    tokenConfig.socket.expiryWarningTime = 300;
  }

  // Validate event propagation configuration against room hierarchy
  const maxRoomDepth = roomRegistryConfig.hierarchy.maxDepth;
  if (maxRoomDepth < 4) {
    // We need at least 4 levels (user->device->session->tab)
    console.warn(
      "WARNING: Room hierarchy depth is insufficient for the required structure"
    );
    roomRegistryConfig.hierarchy.maxDepth = 4;
  }

  // Ensure WebSocket room prefixes are consistent
  const roomPrefixes = websocketConfig.rooms.roomNames;
  if (roomPrefixes) {
    if (roomRegistryConfig.naming?.prefixes) {
      const registryPrefixes = roomRegistryConfig.naming.prefixes;
      if (
        roomPrefixes.userPrefix !== registryPrefixes.user ||
        roomPrefixes.devicePrefix !== registryPrefixes.device ||
        roomPrefixes.sessionPrefix !== registryPrefixes.session ||
        roomPrefixes.tabPrefix !== registryPrefixes.tab
      ) {
        console.warn(
          "WARNING: Room prefixes are inconsistent between WebSocket and registry configs"
        );
        // Align them
        roomPrefixes.userPrefix = registryPrefixes.user;
        roomPrefixes.devicePrefix = registryPrefixes.device;
        roomPrefixes.sessionPrefix = registryPrefixes.session;
        roomPrefixes.tabPrefix = registryPrefixes.tab;
      }
    }
  }

  // Ensure token refresh settings are aligned
  if (
    tokenConfig.refreshThreshold !==
    websocketConfig.tokenRefresh.backgroundTabs.soonThreshold
  ) {
    console.warn("WARNING: Token refresh thresholds are inconsistent");
    // Align them
    websocketConfig.tokenRefresh.backgroundTabs.soonThreshold =
      tokenConfig.refreshThreshold;
  }

  return true;
}

// Convert string time to seconds
function parseTimeToSeconds(timeStr) {
  if (typeof timeStr === "number") return timeStr;

  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return parseInt(timeStr, 10) || 0;

  const [, value, unit] = match;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(value, 10) * multipliers[unit];
}

// Normalize config values
function normalizeConfig() {
  // No need to convert time values as they're already in seconds in token.config.js

  return {
    token: tokenConfig,
    session: sessionConfig,
    security: securityConfig,
    cookie: cookieConfig,
    socketAdapter: socketAdapterConfig,
    roomRegistry: roomRegistryConfig,
    eventPropagation: eventPropagationConfig,
    websocket: websocketConfig,
  };
}

// Run validation and normalization
const config = normalizeConfig();
validateConfig();

module.exports = {
  ...config,
  requireEmailVerification:
    process.env.REQUIRE_EMAIL_VERIFICATION === "true" || false,
};

/**
 * Helper function to parse duration strings like '1h' into seconds
 * @param {string} durationStr - Duration string (e.g., '1h', '30m', '1d')
 * @returns {number} Duration in seconds
 */
function parseDuration(durationStr) {
  if (typeof durationStr !== "string") return 3600; // Default to 1 hour

  const match = durationStr.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // Default to 1 hour if format is invalid

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 24 * 60 * 60;
    default:
      return 3600;
  }
}
