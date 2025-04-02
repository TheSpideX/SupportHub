/**
 * Token configuration - single source of truth
 * Match these with frontend expectations
 */
require('dotenv').config(); // Ensure environment variables are loaded

// Default secrets for development (DO NOT USE IN PRODUCTION)
const DEFAULT_ACCESS_SECRET = 'dev-access-token-secret-key-2024';
const DEFAULT_REFRESH_SECRET = 'dev-refresh-token-secret-key-2024';
const DEFAULT_CSRF_SECRET = 'dev-csrf-token-secret-key-2024';

// Check if secrets are available and log warnings if using defaults
if (!process.env.ACCESS_TOKEN_SECRET) {
  console.warn('WARNING: ACCESS_TOKEN_SECRET not found in environment variables. Using default (UNSAFE for production).');
}
if (!process.env.REFRESH_TOKEN_SECRET) {
  console.warn('WARNING: REFRESH_TOKEN_SECRET not found in environment variables. Using default (UNSAFE for production).');
}
if (!process.env.CSRF_SECRET) {
  console.warn('WARNING: CSRF_SECRET not found in environment variables. Using default (UNSAFE for production).');
}

// Import session config to ensure alignment
const sessionConfig = require('./session.config');

const tokenConfig = {
  // Token secrets - use environment variables or defaults for development
  secrets: {
    access: process.env.ACCESS_TOKEN_SECRET || DEFAULT_ACCESS_SECRET,
    refresh: process.env.REFRESH_TOKEN_SECRET || DEFAULT_REFRESH_SECRET,
    csrf: process.env.CSRF_SECRET || DEFAULT_CSRF_SECRET
  },
  
  // Token expiry times (in seconds)
  expiry: {
    access: parseInt(process.env.ACCESS_TOKEN_EXPIRY || '900'), // 15 minutes
    refresh: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '604800'), // 7 days - aligned with session TTL
    csrf: 3600 // 1 hour
  },
  
  // Token refresh threshold (in seconds)
  refreshThreshold: 300, // 5 minutes before expiry
  
  // Remember me multiplier
  rememberMeMultiplier: 7, // Extend token lifetime by 7x
  
  // Token type
  tokenType: 'Bearer',
  
  // JWT configuration
  jwt: {
    algorithms: {
      access: 'HS256',
      refresh: 'HS256',
      csrf: 'HS256'
    },
    issuer: process.env.JWT_ISSUER || 'auth-service',
    audience: process.env.JWT_AUDIENCE || 'app-client'
  },
  
  // Cookie settings for HTTP-only cookies
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined
  },
  
  // CSRF configuration
  csrf: {
    headerName: 'X-CSRF-Token',
    cookieName: 'csrf_token'
  },
  
  // WebSocket notification settings
  socket: {
    notifyBeforeExpiry: true,
    expiryWarningTime: 5 * 60, // 5 minutes before expiry
    refreshQueueDelay: 100 // ms between concurrent refresh attempts
  }
};

module.exports = tokenConfig;
