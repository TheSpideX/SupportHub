/**
 * Centralized auth configuration
 * Single source of truth for all auth-related settings
 */
const tokenConfig = require('./token.config');
const sessionConfig = require('./session.config');
const securityConfig = require('./security.config');
const cookieConfig = require('./cookie.config');

// Validate configuration for consistency
function validateConfig() {
  // Ensure token and session expiry times are aligned
  if (tokenConfig.refresh.expiresInSeconds !== sessionConfig.store.ttl) {
    console.warn('WARNING: Refresh token expiry and session TTL are not aligned');
    // Align them
    sessionConfig.store.ttl = tokenConfig.refresh.expiresInSeconds;
  }
  
  // Ensure CSRF token expiry matches in all places
  const csrfExpiryInSeconds = tokenConfig.csrf.expiresIn 
    ? (typeof tokenConfig.csrf.expiresIn === 'string' 
      ? parseDuration(tokenConfig.csrf.expiresIn) 
      : tokenConfig.csrf.expiresIn)
    : 3600; // Default to 1 hour
    
  const cookieCsrfMaxAge = cookieConfig.csrfOptions?.maxAge || 0;
  
  if (csrfExpiryInSeconds * 1000 !== cookieCsrfMaxAge) {
    console.warn('WARNING: CSRF token expiry times are not consistent');
    // Align them
    if (!cookieConfig.csrfOptions) {
      cookieConfig.csrfOptions = {};
    }
    cookieConfig.csrfOptions.maxAge = csrfExpiryInSeconds * 1000;
    tokenConfig.csrf.expiresInSeconds = csrfExpiryInSeconds;
  }
  
  // Ensure cookie domains match if specified
  const domain = cookieConfig.baseOptions?.domain;
  const csrfDomain = cookieConfig.csrfOptions?.domain;

  if (domain && csrfDomain && domain !== csrfDomain) {
    console.warn('WARNING: Cookie domains are not consistent between base and CSRF options');
  }
  
  return true;
}

// Convert string time to seconds
function parseTimeToSeconds(timeStr) {
  if (typeof timeStr === 'number') return timeStr;
  
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return parseInt(timeStr, 10) || 0;
  
  const [, value, unit] = match;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(value, 10) * multipliers[unit];
}

// Normalize config values
function normalizeConfig() {
  // Convert all time values to seconds for consistency
  tokenConfig.access.expiresInSeconds = parseTimeToSeconds(tokenConfig.access.expiresIn);
  tokenConfig.refresh.expiresInSeconds = parseTimeToSeconds(tokenConfig.refresh.expiresIn);
  tokenConfig.csrf.expiresInSeconds = parseTimeToSeconds(tokenConfig.csrf.expiresIn);
  
  return {
    token: tokenConfig,
    session: sessionConfig,
    security: securityConfig,
    cookie: cookieConfig
  };
}

// Run validation and normalization
const config = normalizeConfig();
validateConfig();

module.exports = config;

/**
 * Helper function to parse duration strings like '1h' into seconds
 * @param {string} durationStr - Duration string (e.g., '1h', '30m', '1d')
 * @returns {number} Duration in seconds
 */
function parseDuration(durationStr) {
  if (typeof durationStr !== 'string') return 3600; // Default to 1 hour
  
  const match = durationStr.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // Default to 1 hour if format is invalid
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 3600;
  }
}
