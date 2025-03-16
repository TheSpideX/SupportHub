# Authentication System Documentation

This document provides an overview of the authentication system in our CRM Portal, detailing each file's purpose and responsibilities.

## Core Authentication Files

### Services

#### `auth.service.ts`
- Primary service for authentication operations
- Handles login, logout, token refresh
- Manages authentication state persistence
- Communicates with backend authentication endpoints
- Validates credentials before sending to server

#### `token.service.ts`
- Manages JWT tokens (access and refresh)
- Handles token storage, retrieval, and clearing
- Provides token validation and expiration checking
- Decodes JWT tokens to extract user information
- Implements secure token storage strategies

### Hooks

#### `useAuth.ts`
- Custom React hook providing authentication context to components
- Exposes login, logout, and registration functions
- Manages authentication loading and error states
- Handles authentication persistence across page refreshes
- Provides current user information to components

#### `useUser.ts`
- Manages current user data and profile information
- Provides user role and permission checking
- Handles user preference settings
- Caches user data to minimize API calls

### Components

#### `LoginForm.tsx`
- Renders the login form UI
- Handles form validation and submission
- Manages form state and error display
- Provides password visibility toggle
- Checks server status before attempting login

#### `LoginPage.tsx`
- Container for the login experience
- Manages page-level state and redirects
- Handles authentication success/failure flows
- Provides layout for login-related components
- Implements "remember me" functionality

#### `ProtectedRoute.tsx`
- Higher-order component for route protection
- Redirects unauthenticated users to login
- Handles role-based access control
- Manages loading states during authentication checks
- Provides fallback UI while checking authentication

#### `AuthProvider.tsx`
- Provides authentication context to the application
- Initializes authentication state from storage
- Sets up global authentication event listeners
- Handles authentication state synchronization
- Provides centralized authentication state management

### Utils

#### `auth-validators.ts`
- Contains validation functions for authentication forms
- Implements password strength requirements
- Validates email format and username requirements
- Provides consistent validation across auth components
- Exports reusable validation schemas

#### `auth-storage.ts`
- Manages persistent storage of authentication data
- Implements secure storage strategies
- Handles storage synchronization across tabs
- Provides fallback mechanisms for storage failures
- Manages storage cleanup on logout

## Authentication Flow

1. User enters credentials in `LoginForm`
2. Form validation occurs via `auth-validators.ts`
3. On submission, `LoginPage` calls `useAuth.login()`
4. `useAuth` delegates to `auth.service.ts`
5. `auth.service.ts` communicates with the backend
6. On success, tokens are stored via `token.service.ts`
7. `AuthProvider` updates global authentication state
8. User is redirected to the protected application

## Error Handling

- Form-level validation errors are handled by `LoginForm`
- Network and server errors are processed by `auth.service.ts`
- Global authentication errors are managed by `useAuth`
- Unauthorized access is handled by `ProtectedRoute`

## Security Considerations

- Tokens are stored securely using HttpOnly cookies when possible
- Sensitive data is never logged or stored in local storage
- Password requirements enforce strong security practices
- Automatic token refresh occurs in the background
- Session timeout is enforced for inactive users