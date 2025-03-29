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
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || DEFAULT_ACCESS_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || DEFAULT_REFRESH_SECRET,
  CSRF_SECRET: process.env.CSRF_SECRET || DEFAULT_CSRF_SECRET,
  
  // Token expiry times (in seconds)
  ACCESS_TOKEN_EXPIRY: parseInt(process.env.ACCESS_TOKEN_EXPIRY || '15') * 60, // 15 minutes
  REFRESH_TOKEN_EXPIRY: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '7') * 24 * 60 * 60, // 7 days
  
  // Token refresh threshold (in seconds) - must match frontend
  REFRESH_THRESHOLD: sessionConfig.syncInterval, // 5 minutes before expiry
  
  // Remember me multiplier - standardize to 7x
  REMEMBER_ME_MULTIPLIER: 7,
  
  // Token types
  TOKEN_TYPE: 'Bearer'
};

module.exports = {
  // Existing config...
  
  // Token generation settings
  access: {
    secret: process.env.ACCESS_TOKEN_SECRET || DEFAULT_ACCESS_SECRET,
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m',
    expiresInSeconds: parseInt(process.env.ACCESS_TOKEN_EXPIRY || '15') * 60, // 15 minutes in seconds
    algorithm: 'HS256'
  },
  
  refresh: {
    secret: process.env.REFRESH_TOKEN_SECRET || DEFAULT_REFRESH_SECRET,
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d',
    expiresInSeconds: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '7') * 24 * 60 * 60, // 7 days in seconds
    algorithm: 'HS256'
  },
  
  csrf: {
    secret: process.env.CSRF_TOKEN_SECRET || DEFAULT_CSRF_SECRET,
    expiresIn: '1h',
    expiresInSeconds: 60 * 60 // 1 hour in seconds
  },
  
  // Cookie settings for HTTP-only cookies
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined
  },
  
  // Refresh mechanism
  refreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  refreshQueueDelay: 100 // ms between concurrent refresh attempts
};
