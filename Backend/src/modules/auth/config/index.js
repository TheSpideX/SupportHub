/**
 * Auth Module Configuration
 * Single source of truth for all auth-related configuration
 */
const token = require('./token.config');
const cookie = require('./cookie.config');
const security = require('./security.config');
const session = require('./session.config');

// Environment-aware settings
const isDevelopment = process.env.NODE_ENV === 'development';

// Export consolidated auth configuration
module.exports = {
  // Re-export specific configs
  token,
  cookie,
  security,
  session,
  
  // Common auth settings
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },
  
  // Session limits
  maxSessionsPerUser: isDevelopment ? 10 : 5,
  
  // Login attempts
  maxLoginAttempts: isDevelopment ? 10 : 5,
  lockoutDuration: 15 * 60, // 15 minutes
  
  // Registration
  requireEmailVerification: false,
  emailVerificationExpiry: 24 * 60 * 60, // 24 hours
  
  // Password reset
  passwordResetExpiry: 60 * 60, // 1 hour
  
  // 2FA
  enable2FA: false, // Disabled as requested
  
  // Security level
  securityLevel: isDevelopment ? 'low' : 'medium'
};
