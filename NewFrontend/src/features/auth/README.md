# Frontend Authentication System

This document outlines the authentication system implemented in the SupportHub frontend, including recent improvements to work with the backend WebSocket authentication system.

## Overview

The frontend authentication system uses HTTP-only cookies for secure token storage, with WebSocket connections for real-time session management and cross-tab synchronization as a fallback mechanism.

## Key Components

### TokenService

The `TokenService` handles all token-related operations:
- Token validation and refresh
- CSRF token management
- Cross-tab synchronization
- Session metadata management

### WebSocketService

The `WebSocketService` manages WebSocket connections:
- Establishes secure WebSocket connections to the backend
- Handles authentication using HTTP-only cookies
- Implements fallback to cross-tab synchronization when WebSockets are unavailable
- Manages room-based event subscriptions

### SessionService

The `SessionService` manages user sessions:
- Tracks session activity
- Handles session timeouts
- Synchronizes session state across tabs

## Recent Improvements

### WebSocket Authentication

- Updated to use HTTP-only cookies for WebSocket authentication
- Configured WebSocket connections to use the backend port (4290)
- Added proper error handling for WebSocket authentication failures
- Implemented fallback mechanism when WebSockets are unavailable

### Cross-Tab Synchronization

- Enhanced cross-tab synchronization as a fallback mechanism
- Implemented leader election for coordinated token refresh
- Added polling for auth events when WebSockets are unavailable
- Improved device and tab tracking

### Token Management

- Enhanced token refresh to include device and tab information
- Improved handling of HTTP-only cookies
- Added token rotation support
- Enhanced security with device fingerprinting

## Usage

### Initializing the Authentication System

```typescript
// Initialize the authentication system
const authService = AuthService.getInstance();
const tokenService = TokenService.getInstance();
const webSocketService = WebSocketService.getInstance();

// Set auth services for WebSocket
webSocketService.setAuthServices(tokenService, securityService);

// Initialize WebSocket connection
webSocketService.initialize();
```

### Handling Authentication Events

```typescript
// Subscribe to authentication events
webSocketService.on('token:expiring', (data) => {
  // Handle token expiring event
  tokenService.refreshToken();
});

webSocketService.on('session:terminated', (data) => {
  // Handle session termination
  authService.logout();
});
```

## Implementation Details

### WebSocket Connection

The WebSocket connection is established with:
- HTTP-only cookies for authentication
- CSRF token for additional security
- Device and tab identification
- Proper error handling and reconnection logic

### Fallback Mechanism

When WebSockets are unavailable:
1. The system detects connection failures
2. It enables fallback mode with cross-tab synchronization
3. The leader tab polls for auth events using REST API
4. Events are broadcast to other tabs using BroadcastChannel or localStorage

### Token Refresh

Token refresh is coordinated across tabs:
1. Only the leader tab performs token refresh
2. The refresh includes device and tab information
3. Successful refresh is broadcast to other tabs
4. All tabs update their session metadata

## Security Considerations

- Tokens are stored as HTTP-only cookies to prevent JavaScript access
- CSRF protection is implemented for all state-changing operations
- Device fingerprinting helps identify suspicious activity
- Leader election prevents race conditions in token refresh
