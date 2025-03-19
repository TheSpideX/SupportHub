/**
 * Security Event Model
 * Stores security-related events for audit and analysis
 */
const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow events without user ID (e.g., failed login with unknown email)
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'login_success',
      'login_failure',
      'logout',
      'password_change',
      'password_reset_request',
      'password_reset_complete',
      'account_locked',
      'account_unlocked',
      'suspicious_activity',
      'failed_login_attempt',
      'device_verified',
      'new_device_detected',
      'token_refresh',
      'mfa_enabled',
      'mfa_disabled',
      'security_settings_changed'
    ]
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipHash: String,
  userAgent: String,
  contextId: String
});

// Index for faster queries
securityEventSchema.index({ userId: 1, timestamp: -1 });
securityEventSchema.index({ eventType: 1, timestamp: -1 });

const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);

module.exports = SecurityEvent;