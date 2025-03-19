const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Session Schema
 * Represents a user session with device information and expiry
 */
const SessionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceInfo: {
    fingerprint: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      required: true
    },
    ip: {
      type: String,
      default: '0.0.0.0'
    },
    location: {
      country: String,
      city: String,
      coordinates: [Number]
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  rememberMe: {
    type: Boolean,
    default: false
  },
  tokenVersion: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Add index for finding and cleaning expired sessions
SessionSchema.index({ expiresAt: 1, isActive: 1 });

// Add index for finding user's active sessions
SessionSchema.index({ userId: 1, isActive: 1 });

// Add method to check if session is expired
SessionSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Add method to extend session expiry
SessionSchema.methods.extend = function(durationInSeconds) {
  const newExpiryDate = new Date();
  newExpiryDate.setSeconds(newExpiryDate.getSeconds() + durationInSeconds);
  this.expiresAt = newExpiryDate;
  this.lastActivity = new Date();
  return this.save();
};

// Add method to invalidate session
SessionSchema.methods.invalidate = function() {
  this.isActive = false;
  return this.save();
};

const Session = mongoose.model('Session', SessionSchema);

module.exports = Session;
