/**
 * Auth module events
 * Defines event handlers and emitters for auth-related events
 */
const EventEmitter = require('events');

// Create auth event emitter
const authEvents = new EventEmitter();

// Event types
const EVENT_TYPES = {
  LOGIN_SUCCESS: 'login:success',
  LOGIN_FAILURE: 'login:failure',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password:change',
  PASSWORD_RESET: 'password:reset',
  ACCOUNT_LOCKED: 'account:locked',
  ACCOUNT_UNLOCKED: 'account:unlocked',
  SUSPICIOUS_ACTIVITY: 'suspicious:activity',
  SECURITY_SETTINGS_CHANGED: 'security:settings:changed',
  MFA_ENABLED: 'mfa:enabled',
  MFA_DISABLED: 'mfa:disabled',
  TOKEN_REFRESH: 'token:refresh',
  SESSION_EXPIRED: 'session:expired'
};

// Export event emitter and types
module.exports = {
  emitter: authEvents,
  types: EVENT_TYPES
};