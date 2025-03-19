# Cross-Tab Synchronization

This document describes how the backend supports cross-tab synchronization for the frontend authentication system.

## Overview

The authentication system supports multiple tabs/windows of the application being open simultaneously by the same user. The backend provides mechanisms to ensure consistent session state across all tabs.

## Key Components

### 1. Session Sync Endpoint

The `/api/auth/session/sync` endpoint allows the frontend to:
- Update the server with the latest user activity
- Synchronize session state across tabs
- Receive updated session expiration information

### 2. Session Timeout Standardization

Session timeout values are centralized in `session.config.js` and include:
- `idleTimeout`: Time of inactivity before session expires (30 minutes)
- `absoluteTimeout`: Maximum session duration regardless of activity (24 hours)

These values are consistent with frontend expectations.

### 3. Session Tracking

The backend tracks:
- Last activity time for each session
- Device information
- Session creation time
- Session metrics

### 4. Security Considerations

- Changes in device information during a session are logged for security monitoring
- Session sync requests require CSRF protection
- Rate limiting is applied to prevent abuse

## Implementation Details

### Session Model

The Session model includes fields for:
- User ID
- Token ID (JTI)
- Device information
- IP address
- Last activity timestamp
- Creation timestamp
- Active status

### Cross-Tab Communication Flow

1. User opens a new tab
2. Frontend detects existing session
3. Frontend calls `/api/auth/session/sync` to validate and update session
4. Backend returns updated session information
5. Frontend synchronizes state across tabs using BroadcastChannel API

### Error Handling

The backend returns standardized error codes that match frontend expectations:
- `SESSION_EXPIRED`: When session has timed out
- `SESSION_NOT_FOUND`: When session ID is invalid
- `UNAUTHORIZED`: When authentication is required
- `CSRF_INVALID`: When CSRF token is missing or invalid

## Testing Cross-Tab Functionality

To test cross-tab synchronization:
1. Log in to the application
2. Open multiple tabs
3. Perform actions in one tab
4. Verify session state is synchronized across tabs
5. Test session timeout scenarios