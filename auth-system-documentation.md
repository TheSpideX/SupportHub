# Authentication System Documentation

## Core Authentication Routes (`/api/auth/`)

### 1. Login
- **Route**: `/api/auth/login`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "deviceInfo": {
      "fingerprint": "device-unique-id-123",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "ip": "192.168.1.1"
    },
    "rememberMe": false
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": "user123",
        "email": "john.doe@example.com",
        "name": "John Doe",
        "role": "TECHNICAL"
      },
      "session": {
        "id": "session123",
        "expiresAt": "2023-01-01T01:00:00.000Z"
      }
    }
  }
  ```
- **Notes**: 
  - Access and refresh tokens are set as HTTP-only cookies
  - CSRF token is set as a non-HTTP-only cookie
  - If 2FA is enabled, returns a temporary token for verification

### 2. Register
- **Route**: `/api/auth/register`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "email": "new.user@example.com",
    "password": "SecurePass123!",
    "name": "New User",
    "role": "SUPPORT",
    "deviceInfo": {
      "fingerprint": "device-unique-id-123",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "ip": "192.168.1.1"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "user": {
        "id": "user124",
        "email": "new.user@example.com",
        "name": "New User",
        "role": "SUPPORT"
      }
    }
  }
  ```
- **Notes**: 
  - Access and refresh tokens are set as HTTP-only cookies
  - CSRF token is set as a non-HTTP-only cookie

### 3. Logout
- **Route**: `/api/auth/logout`
- **Method**: POST
- **Request Data**: None (uses tokens from cookies)
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Logout successful"
  }
  ```
- **Notes**: Requires authentication token and CSRF token

### 4. Get Current User
- **Route**: `/api/auth/me`
- **Method**: GET
- **Request Data**: None (requires authentication token)
- **Response**:
  ```json
  {
    "id": "user123",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "role": "TECHNICAL",
    "twoFactorEnabled": false,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
  ```

### 5. Verify Email
- **Route**: `/api/auth/verify-email`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "token": "verification-token-123"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Email verified successfully"
  }
  ```

### 6. Resend Verification Email
- **Route**: `/api/auth/resend-verification`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "email": "john.doe@example.com"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Verification email sent"
  }
  ```

### 7. Auth Status
- **Route**: `/api/auth/status`
- **Method**: GET
- **Request Data**: None (optional authentication)
- **Response**:
  ```json
  {
    "authenticated": true,
    "user": {
      "id": "user123",
      "role": "TECHNICAL"
    },
    "session": {
      "expiresAt": "2023-01-01T01:00:00.000Z"
    }
  }
  ```

### 8. Health Check
- **Route**: `/api/auth/health`
- **Method**: GET
- **Response**:
  ```json
  {
    "status": "ok",
    "module": "auth",
    "timestamp": "2023-01-01T00:00:00.000Z"
  }
  ```

## Token Routes (`/api/auth/token/`)

### 1. Refresh Tokens
- **Route**: `/api/auth/token/refresh`
- **Method**: POST
- **Request Data**: None (uses refresh token from HTTP-only cookie)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Tokens refreshed successfully",
    "data": {
      "session": {
        "id": "session123",
        "expiresAt": "2023-01-01T01:00:00.000Z",
        "lastActivity": "2023-01-01T00:30:00.000Z",
        "idleTimeout": 1800
      }
    }
  }
  ```
- **Notes**:
  - New access and refresh tokens are set as HTTP-only cookies
  - CSRF token is refreshed as a non-HTTP-only cookie

### 2. Generate CSRF Token
- **Route**: `/api/auth/token/csrf`
- **Method**: GET
- **Request Data**: None (optional authentication)
- **Response**:
  ```json
  {
    "csrfToken": "csrf-token-123"
  }
  ```

### 3. Validate Token
- **Route**: `/api/auth/token/validate`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "token": "token-to-validate"
  }
  ```
- **Response**:
  ```json
  {
    "valid": true,
    "payload": {
      "userId": "user123",
      "exp": 1672531200
    }
  }
  ```

### 4. Revoke Token
- **Route**: `/api/auth/token/revoke`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "tokenId": "token-id-to-revoke"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Token revoked successfully"
  }
  ```
- **Notes**: Requires authentication token and CSRF token

### 5. Verify Access Token
- **Route**: `/api/auth/token/verify`
- **Method**: GET
- **Request Data**: None (uses access token from cookie)
- **Response**:
  ```json
  {
    "valid": true,
    "expiresAt": "2023-01-01T01:00:00.000Z"
  }
  ```

## Session Routes (`/api/auth/session/`)

### 1. Validate Session
- **Route**: `/api/auth/session/validate`
- **Method**: GET
- **Request Data**: None (requires authentication token)
- **Response**:
  ```json
  {
    "valid": true,
    "session": {
      "id": "session123",
      "expiresAt": "2023-01-01T01:00:00.000Z",
      "lastActivity": "2023-01-01T00:30:00.000Z"
    }
  }
  ```

### 2. Sync Session
- **Route**: `/api/auth/session/sync`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "tabId": "tab-123",
    "screenSize": { "width": 1920, "height": 1080 },
    "lastUserActivity": "2023-01-01T00:00:00.000Z"
  }
  ```
- **Response**:
  ```json
  {
    "sessionId": "session-123",
    "expiresAt": "2023-01-01T01:00:00.000Z",
    "warningAt": "2023-01-01T00:45:00.000Z"
  }
  ```
- **Notes**: Requires authentication token and CSRF token

### 3. Acknowledge Warning
- **Route**: `/api/auth/session/acknowledge-warning`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "warningType": "IDLE"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "session": {
      "expiresAt": "2023-01-01T01:15:00.000Z"
    }
  }
  ```
- **Notes**: Requires authentication token and CSRF token

### 4. Get Active Sessions
- **Route**: `/api/auth/session/active`
- **Method**: GET
- **Request Data**: None (requires authentication token and CSRF token)
- **Response**:
  ```json
  {
    "sessions": [
      {
        "id": "session-123",
        "device": "Chrome on Windows",
        "ip": "192.168.1.1",
        "lastActive": "2023-01-01T00:00:00.000Z",
        "current": true
      }
    ]
  }
  ```

### 5. Terminate Session
- **Route**: `/api/auth/session/:sessionId`
- **Method**: DELETE
- **Request Data**: None (requires authentication token and CSRF token)
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Session terminated successfully"
  }
  ```

### 6. Terminate All Sessions
- **Route**: `/api/auth/session/terminate-all`
- **Method**: POST
- **Request Data**: None (requires authentication token and CSRF token)
- **Response**: 
  ```json
  {
    "success": true,
    "message": "All sessions terminated successfully"
  }
  ```

### 7. Get Session Details
- **Route**: `/api/auth/session/:sessionId`
- **Method**: GET
- **Request Data**: None (requires authentication token)
- **Response**:
  ```json
  {
    "id": "session-123",
    "device": "Chrome on Windows",
    "ip": "192.168.1.1",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "lastActive": "2023-01-01T00:30:00.000Z",
    "expiresAt": "2023-01-01T01:00:00.000Z"
  }
  ```

### 8. Update Session Activity (Heartbeat)
- **Route**: `/api/auth/session/heartbeat`
- **Method**: POST
- **Request Data**: None (requires authentication token)
- **Response**: 
  ```json
  {
    "success": true,
    "expiresAt": "2023-01-01T01:00:00.000Z"
  }
  ```

## Security Routes (`/api/auth/security/`)

### 1. Verify 2FA
- **Route**: `/api/auth/security/verify-2fa`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "code": "123456",
    "tempToken": "temp-token-from-login"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "2FA verification successful",
    "data": {
      "user": {
        "id": "user123",
        "email": "john.doe@example.com",
        "name": "John Doe"
      }
    }
  }
  ```
- **Notes**: Access and refresh tokens are set as HTTP-only cookies

### 2. Setup 2FA
- **Route**: `/api/auth/security/setup-2fa`
- **Method**: POST
- **Request Data**: None (requires authentication token and CSRF token)
- **Response**:
  ```json
  {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUrl": "data:image/png;base64,..."
  }
  ```

### 3. Disable 2FA
- **Route**: `/api/auth/security/disable-2fa`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "code": "123456"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "2FA disabled successfully"
  }
  ```
- **Notes**: Requires authentication token and CSRF token

### 4. Generate Backup Codes
- **Route**: `/api/auth/security/generate-backup-codes`
- **Method**: POST
- **Request Data**: None (requires authentication token and CSRF token)
- **Response**:
  ```json
  {
    "backupCodes": [
      "12345-67890",
      "abcde-fghij",
      "..."
    ]
  }
  ```

### 5. Verify Device
- **Route**: `/api/auth/security/verify-device`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "deviceId": "device-123",
    "verificationCode": "123456"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Device verified successfully"
  }
  ```

### 6. Get Security Events
- **Route**: `/api/auth/security/events`
- **Method**: GET
- **Request Data**: None (requires authentication token and CSRF token)
- **Response**:
  ```json
  {
    "events": [
      {
        "id": "event-123",
        "type": "LOGIN",
        "ip": "192.168.1.1",
        "device": "Chrome on Windows",
        "timestamp": "2023-01-01T00:00:00.000Z"
      }
    ]
  }
  ```

### 7. Get Security Settings
- **Route**: `/api/auth/security/settings`
- **Method**: GET
- **Request Data**: None (requires authentication token)
- **Response**:
  ```json
  {
    "twoFactorEnabled": true,
    "loginNotifications": true,
    "deviceVerification": true,
    "passwordLastChanged": "2023-01-01T00:00:00.000Z"
  }
  ```

### 8. Update Security Settings
- **Route**: `/api/auth/security/settings`
- **Method**: PUT
- **Request Data**:
  ```json
  {
    "loginNotifications": false,
    "deviceVerification": true
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Security settings updated successfully",
    "settings": {
      "twoFactorEnabled": true,
      "loginNotifications": false,
      "deviceVerification": true
    }
  }
  ```
- **Notes**: Requires authentication token and CSRF token

### 9. Report Security Issue
- **Route**: `/api/auth/security/report-issue`
- **Method**: POST
- **Request Data**:
  ```json
  {
    "type": "SUSPICIOUS_ACTIVITY",
    "description": "Unexpected login notification",
    "metadata": {
      "location": "Unknown location",
      "time": "2023-01-01T00:00:00.000Z"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Security issue reported successfully",
    "reportId": "report-123"
  }
  ```

## User Routes (`/api/auth/user/`)

### 1. Get User Profile
- **Route**: `/api/auth/user/profile`
- **Method**: GET
- **Request Data**: None (requires authentication token)
- **Response**:
  ```json
  {
    "id": "user123",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "role": "TECHNICAL",
    "profileImage": "https://example.com/profile.jpg",
    "contactInfo": {
      "phone": "+1234567890",
      "address": "123 Main St"
    }
  }
  ```

### 2. Update User Profile
- **Route**: `/api/auth/user/profile`
- **Method**: PUT
- **Request Data**:
  ```json
  {
    "name": "John D. Doe",
    "profileImage": "https://example.com/new-profile.jpg",
    "contactInfo": {
      "phone": "+0987654321"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Profile updated successfully",
    "data": {
      "id": "user123",
      "name": "John D. Doe",
      "profileImage": "https://example.com/new-profile.jpg"
    }
  }
  ```
- **Notes**: Requires authentication token and rate limiting

### 3. Change Password
- **Route**: `/api/auth/user/password`
- **Method**: PUT
- **Request Data**:
  ```json
  {
    "currentPassword": "OldSecurePass123!",
    "newPassword": "NewSecurePass456!"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Password changed successfully"
  }
  ```
- **Notes**: Requires authentication token and rate limiting

### 4. Get User Preferences
- **Route**: `/api/auth/user/preferences`
- **Method**: GET
- **Request Data**: None (requires authentication token)
- **Response**:
  ```json
  {
    "theme": "dark",
    "language": "en",
    "notifications": {
      "email": true,
      "push": false
    },
    "dashboard": {
      "layout": "compact",
      "widgets": ["tickets", "calendar", "stats"]
    }
  }
  ```

### 5. Update User Preferences
- **Route**: `/api/auth/user/preferences`
- **Method**: PUT
- **Request Data**:
  ```json
  {
    "theme": "light",
    "notifications": {
      "push": true
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Preferences updated successfully",
    "data": {
      "theme": "light",
      "notifications": {
        "email": true,
        "push": true
      }
    }
  }
  ```
- **Notes**: Requires authentication token and rate limiting
