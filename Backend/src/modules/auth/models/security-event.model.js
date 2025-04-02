/**
 * Security Event Model
 * Stores security-related events for audit and analysis
 */
const mongoose = require('mongoose');

// Add new event types while maintaining backward compatibility
const eventTypes = [
  // Authentication events
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
  
  // Token lifecycle events
  'token_refresh',
  'token_refreshed',
  'token_expired',
  'token_revoked',
  
  // WebSocket events
  'socket_connected',
  'socket_disconnected',
  'room_joined',
  'room_left',
  'session_expired',
  'session_timeout_warning',
  'session_extended',
  'device_verification_requested',
  'hierarchy_changed',
  'mfa_enabled',
  'mfa_disabled',
  'security_settings_changed',
  
  // Additional events for controller compatibility
  'security_context_created',
  'security_context_validated',
  'client_report'
];

// Update schema with new fields while maintaining backward compatibility
const securityEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow events without user ID (e.g., failed login with unknown email)
  },
  eventType: {
    type: String,
    required: true,
    enum: eventTypes
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
  
  // WebSocket-specific fields
  socketId: String,
  roomId: String,
  contextId: String,
  
  // Hierarchy fields
  hierarchyPath: String, // Stores full path: user/device/session/tab
  propagationPath: [String], // Track event propagation through room hierarchy
  propagationDirection: {
    type: String,
    enum: ['up', 'down', 'both', 'none'],
    default: 'none'
  },
  deliveredTo: [String], // Socket IDs that received this event
  processed: {
    type: Boolean,
    default: false
  },
  
  // For backward compatibility with security notification model
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: Date
});

// Index for faster queries
securityEventSchema.index({ userId: 1, timestamp: -1 });
securityEventSchema.index({ eventType: 1, timestamp: -1 });
securityEventSchema.index({ roomId: 1, timestamp: -1 });
securityEventSchema.index({ hierarchyPath: 1 });

// Add compound index for event propagation
securityEventSchema.index({ propagationPath: 1, processed: 1, timestamp: -1 });

// Add compound index for room-specific events
securityEventSchema.index({ roomId: 1, eventType: 1, timestamp: -1 });

// Add compound index for user's recent events
securityEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });

// Add validation for propagation direction
securityEventSchema.path('propagationDirection').validate(function(value) {
  // If propagationPath has more than one entry, direction should not be 'none'
  if (this.propagationPath && this.propagationPath.length > 1) {
    return value !== 'none';
  }
  return true;
}, 'Events with multiple propagation paths must have a propagation direction');

// Validate hierarchyPath format
securityEventSchema.path('hierarchyPath').validate(function(value) {
  // If hierarchyPath is provided, it should follow the format: user/device/session/tab
  if (value) {
    const parts = value.split('/');
    return parts.length >= 1 && parts.length <= 4;
  }
  return true;
}, 'HierarchyPath must follow format "user/device/session/tab"');

/**
 * Determines if this security event should propagate upward in the room hierarchy
 * 
 * Upward propagation is used for events that need to notify parent entities
 * about security-related activities in their children, such as suspicious
 * login attempts or device verification requests.
 * 
 * @returns {boolean} Whether this event should propagate upward
 */
securityEventSchema.methods.shouldPropagateUp = function() {
  const upwardEvents = [
    'login_failure', 
    'suspicious_activity', 
    'new_device_detected',
    'device_verification_requested',
    'security_settings_changed'
  ];
  
  return upwardEvents.includes(this.eventType) || 
         this.propagationDirection === 'up' || 
         this.propagationDirection === 'both';
};

/**
 * Determines if this security event should propagate downward in the room hierarchy
 * 
 * Downward propagation is used for events that need to notify child entities
 * about security-related activities from their parents, such as account lockouts,
 * password changes, or session expirations.
 * 
 * @returns {boolean} Whether this event should propagate downward
 */
securityEventSchema.methods.shouldPropagateDown = function() {
  const downwardEvents = [
    'password_change',
    'account_locked',
    'token_revoked',
    'session_expired',
    'session_timeout_warning',
    'hierarchy_changed'
  ];
  
  return downwardEvents.includes(this.eventType) || 
         this.propagationDirection === 'down' || 
         this.propagationDirection === 'both';
};

securityEventSchema.methods.markAsProcessed = function() {
  this.processed = true;
  return this.save();
};

securityEventSchema.methods.addDeliveredSocket = function(socketId) {
  if (!this.deliveredTo.includes(socketId)) {
    this.deliveredTo.push(socketId);
    return this.save();
  }
  return Promise.resolve(this);
};

const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);

module.exports = SecurityEvent;
