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

const tokenConfig = {
  // Token secrets - use environment variables or defaults for development
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || DEFAULT_ACCESS_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || DEFAULT_REFRESH_SECRET,
  CSRF_SECRET: process.env.CSRF_SECRET || DEFAULT_CSRF_SECRET,
  
  // Token expiry times (in seconds)
  ACCESS_TOKEN_EXPIRY: parseInt(process.env.ACCESS_TOKEN_EXPIRY || '15') * 60, // 15 minutes
  REFRESH_TOKEN_EXPIRY: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '7') * 24 * 60 * 60, // 7 days
  
  // Token refresh threshold (in seconds)
  REFRESH_THRESHOLD: 5 * 60, // 5 minutes before expiry
  
  // Token types
  TOKEN_TYPE: 'Bearer'
};

module.exports = tokenConfig;
