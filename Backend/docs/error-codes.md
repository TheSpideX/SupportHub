# Error Codes Reference

This document lists all error codes returned by the API and expected by the frontend.

## Authentication Errors

| Code | HTTP Status | Description | Frontend Handling |
|------|-------------|-------------|------------------|
| `UNAUTHORIZED` | 401 | User is not authenticated | Redirect to login page |
| `TOKEN_EXPIRED` | 401 | Access token has expired | Attempt token refresh |
| `TOKEN_INVALID` | 401 | Token is invalid or malformed | Force logout |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token has expired | Force logout |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token is invalid | Force logout |
| `SESSION_EXPIRED` | 401 | User session has timed out | Show session expired dialog |
| `SESSION_INVALID` | 401 | Session is invalid or not found | Force logout |
| `SESSION_NOT_FOUND` | 404 | Requested session does not exist | Show error message |
| `CSRF_INVALID` | 403 | CSRF token is missing or invalid | Refresh CSRF token and retry |
| `ACCOUNT_LOCKED` | 403 | Account is temporarily locked | Show account locked message |
| `ACCOUNT_DISABLED` | 403 | Account has been disabled | Show account disabled message |
| `MFA_REQUIRED` | 403 | Multi-factor authentication required | Redirect to MFA page |
| `DEVICE_VERIFICATION_REQUIRED` | 403 | Device verification required | Redirect to device verification |

## Authorization Errors

| Code | HTTP Status | Description | Frontend Handling |
|------|-------------|-------------|------------------|
| `FORBIDDEN` | 403 | User lacks permission for this action | Show permission denied message |
| `ROLE_REQUIRED` | 403 | User lacks required role | Show role requirement message |

## Rate Limiting Errors

| Code | HTTP Status | Description | Frontend Handling |
|------|-------------|-------------|------------------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Show rate limit message with retry time |

## Validation Errors

| Code | HTTP Status | Description | Frontend Handling |
|------|-------------|-------------|------------------|
| `VALIDATION_ERROR` | 400 | Request data validation failed | Show field-specific error messages |
| `INVALID_INPUT` | 400 | General input validation error | Show error message |

## Server Errors

| Code | HTTP Status | Description | Frontend Handling |
|------|-------------|-------------|------------------|
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error | Show generic error message |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | Show service unavailable message |

## Resource Errors

| Code | HTTP Status | Description | Frontend Handling |
|------|-------------|-------------|------------------|
| `NOT_FOUND` | 404 | Resource not found | Show not found message |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) | Show conflict message |

## How to Use Error Codes

### Backend Implementation

```javascript
// Example of throwing an error with a specific code
throw new AppError('Session has expired', 401, 'SESSION_EXPIRED');
```

### Frontend Handling

```typescript
// Example of handling specific error codes
try {
  await authApi.refreshSession();
} catch (error) {
  if (error.code === 'SESSION_EXPIRED') {
    showSessionExpiredDialog();
  } else if (error.code === 'CSRF_INVALID') {
    await refreshCsrfToken();
    retry();
  } else {
    handleGenericError(error);
  }
}
```