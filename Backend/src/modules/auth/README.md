# Authentication System

This document outlines the authentication system implemented in the SupportHub backend, including recent improvements and fixes.

## Overview

The authentication system uses a combination of HTTP-only cookies, JWT tokens, and WebSocket connections for secure and real-time session management. It supports cross-tab synchronization with leader election and cross-device session management.

## Key Components

### Auth Service

The `auth.service.js` handles all authentication operations:

- User registration and login
- Password management
- Session creation and termination
- Multi-device logout

### Token Service

The `token.service.js` manages all token-related operations:

- Token generation and verification
- Token refresh and rotation
- Token blacklisting
- CSRF protection

### Session Service

The `session.service.js` manages user sessions:

- Session creation and retrieval
- Session activity tracking
- Session termination
- Cross-tab synchronization
- Security event recording

### Device Service

The `device.service.js` handles device management:

- Device fingerprinting and identification
- Device security assessment
- Device verification
- Suspicious activity detection

## Recent Improvements

### Redis Integration

- Fixed Redis client wrapper with proper method implementations
- Added missing Redis methods: `hget`, `hset`, `sMembers`, `sAdd`, `sRem`
- Fixed Redis set syntax errors by using the correct options format
- Implemented a robust fallback mechanism using an in-memory store

### MongoDB Integration

- Fixed ObjectId constructor calls by adding the `new` keyword
- Made deviceId and hierarchy fields optional in the session model
- Improved error handling in database operations

### Error Handling

- Added the AppError class for consistent error handling
- Implemented graceful error recovery throughout the system
- Added fallback mechanisms for critical operations

### Security Enhancements

- Improved CSRF token handling
- Enhanced session security with proper expiry times
- Added security event recording and propagation

## Usage

### User Authentication

```javascript
// Login a user
const loginResult = await authService.login(email, password, {
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
  deviceInfo: {
    // Device information
  },
});

// Logout a user
await authService.logout(accessToken, refreshToken, sessionId);

// Logout from all devices
await authService.logoutAllDevices(userId);
```

### Token Management

```javascript
// Verify an access token
const decoded = await tokenService.verifyAccessToken(accessToken);

// Refresh tokens
const refreshResult = await tokenService.refreshToken(refreshToken);

// Blacklist a token
await tokenService.blacklistToken(token, "access");
```

### Session Management

```javascript
// Get a session by ID
const session = await sessionService.getSessionById(sessionId);

// Update session activity
await sessionService.updateSessionActivity(sessionId, "user_action");

// Terminate a session
await sessionService.terminateSession(sessionId, userId, "user_logout");

// Record a security event
await sessionService.recordSecurityEvent(
  userId,
  sessionId,
  "security:alert",
  "medium",
  { details: "Suspicious activity detected" }
);
```

## Implementation Details

### Cross-Tab Synchronization

The system supports cross-tab synchronization with leader election:

1. Each tab creates a session with the same device ID
2. One tab is elected as the leader
3. The leader tab is responsible for token refresh and other shared operations
4. If the leader tab is closed, a new leader is elected

### Cross-Device Management

The system supports cross-device session management:

1. Each device creates a unique fingerprint
2. Sessions are associated with devices
3. Users can view and manage all their active sessions
4. Sessions can be terminated individually or all at once

### Fallback Mechanisms

The system includes robust fallback mechanisms:

1. Redis operations fall back to an in-memory store if Redis is unavailable
2. Database operations include error handling and recovery
3. Critical operations are retried with exponential backoff

## Security Considerations

- Tokens are stored as HTTP-only cookies to prevent JavaScript access
- CSRF protection is implemented for all state-changing operations
- Device fingerprinting helps identify suspicious activity
- Session activity is monitored for anomalies
- Security events are recorded and propagated in real-time
