# Complete Authentication Architecture

## File Structure and Responsibilities

```
/backend
├── src/
│   ├── config/                 # Global configuration
│   │   ├── index.js            # Main config entry point - imports and exports all configs
│   │   ├── cors.config.js      # CORS settings - single source for CORS configuration
│   │   ├── db.config.js        # Database settings
│   │   └── redis.config.js     # Redis settings
│   │
│   ├── modules/                # Domain modules
│   │   ├── auth/               # Authentication module
│   │   │   ├── config/         # Auth-specific configs
│   │   │   │   ├── index.js    # Auth config entry point - imports and exports all auth configs
│   │   │   │   ├── token.config.js # Token settings - JWT secrets, expiry times
│   │   │   │   ├── cookie.config.js # Cookie settings - names, options, aligned with frontend
│   │   │   │   ├── security.config.js # Security settings - password policies, rate limits
│   │   │   │   └── session.config.js # Session settings - timeouts, limits
│   │   │   │
│   │   │   ├── controllers/    # Route handlers
│   │   │   │   ├── auth.controller.js # Handles login, register, logout
│   │   │   │   └── session.controller.js # Handles session management
│   │   │   │
│   │   │   ├── services/       # Business logic
│   │   │   │   ├── auth.service.js # User authentication, registration
│   │   │   │   ├── token.service.js # Token generation, validation, refresh
│   │   │   │   └── session.service.js # Session creation, validation, termination
│   │   │   │
│   │   │   ├── models/         # Data models
│   │   │   │   ├── user.model.js # User schema and methods
│   │   │   │   └── session.model.js # Session schema and methods
│   │   │   │
│   │   │   ├── middleware/     # Auth middleware
│   │   │   │   ├── authenticate.js # Validates tokens, establishes user context
│   │   │   │   ├── authorize.js # Role-based access control
│   │   │   │   └── csrf.js # CSRF token validation
│   │   │   │
│   │   │   ├── utils/          # Auth utilities
│   │   │   │   ├── token.utils.js # Token-related helper functions
│   │   │   │   ├── security.utils.js # Security-related helper functions
│   │   │   │   └── csrf.utils.js # CSRF-related helper functions
│   │   │   │
│   │   │   ├── errors/         # Auth-specific errors
│   │   │   │   └── index.js    # Exports custom error classes
│   │   │   │
│   │   │   ├── routes.js       # Auth routes definition
│   │   │   └── index.js        # Module entry - exports routes, middleware
```

## Key Components and Responsibilities

### Configuration Files

1. **`config/index.js`**
   - Imports and exports all global configs
   - Imports and re-exports module configs
   - Sets environment variables with defaults

2. **`modules/auth/config/index.js`**
   - Imports and exports all auth-specific configs
   - Single source of truth for auth configuration
   - Aligned with frontend expectations

3. **`modules/auth/config/cookie.config.js`**
   - Defines cookie names matching frontend constants
   - Sets cookie options (httpOnly, secure, sameSite)
   - Configures expiry times aligned with token expiry

4. **`modules/auth/config/token.config.js`**
   - Defines JWT secrets and algorithms
   - Sets token expiry times
   - Configures refresh thresholds
   - Matches frontend token handling expectations

### Services

1. **`modules/auth/services/auth.service.js`**
   - Handles user authentication
   - Manages user registration and verification
   - Coordinates between token and session services
   - Implements password reset flows

2. **`modules/auth/services/token.service.js`**
   - Generates access and refresh tokens
   - Validates tokens
   - Handles token refresh logic
   - Sets HTTP-only cookies
   - Manages CSRF tokens

3. **`modules/auth/services/session.service.js`**
   - Creates and manages user sessions
   - Handles session validation and expiration
   - Supports cross-device session management
   - Implements session synchronization

### Controllers

1. **`modules/auth/controllers/auth.controller.js`**
   - Handles login requests
   - Processes registration
   - Manages logout
   - Implements token refresh endpoint
   - Returns standardized responses

2. **`modules/auth/controllers/session.controller.js`**
   - Lists user's active sessions
   - Terminates specific sessions
   - Handles logout from all devices
   - Manages session synchronization

### Middleware

1. **`modules/auth/middleware/authenticate.js`**
   - Validates access tokens
   - Establishes user context for requests
   - Handles token expiration
   - Supports optional authentication

2. **`modules/auth/middleware/authorize.js`**
   - Implements role-based access control
   - Validates user permissions
   - Supports resource-based authorization

3. **`modules/auth/middleware/csrf.js`**
   - Validates CSRF tokens
   - Protects against CSRF attacks
   - Works with HTTP-only cookie authentication

### Models

1. **`modules/auth/models/user.model.js`**
   - Defines user schema
   - Implements password hashing
   - Provides user-related methods
   - Handles user data validation

2. **`modules/auth/models/session.model.js`**
   - Defines session schema
   - Tracks device information
   - Manages session expiration
   - Supports session revocation

## Frontend-Backend Alignment

### Cookie Names and Settings
- Cookie names in `cookie.config.js` match frontend constants
- Cookie options (httpOnly, secure, sameSite) consistent with frontend expectations
- Cookie expiry times aligned with token expiry times

### Token Management
- Token refresh strategy matches frontend's background refresh
- CSRF implementation consistent between frontend and backend
- Error handling aligned with frontend expectations

### Session Handling
- Session timeout aligned with frontend expectations
- Session synchronization supports frontend's cross-tab functionality
- Session termination properly reflected in frontend state

## Security Implementation

### HTTP-Only Cookie Authentication
- Access token stored in HTTP-only cookie
- Refresh token stored in HTTP-only cookie
- CSRF token accessible to JavaScript for request headers

### CSRF Protection
- Double Submit Cookie pattern
- CSRF token required for all state-changing operations
- CSRF token refreshed with access token

### Token Refresh Strategy
- Silent background refresh before expiration
- Refresh token rotation for enhanced security
- Absolute session limits with forced re-authentication
