const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    refreshToken: {
      type: String,
      select: false // Don't return in queries by default
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    ipAddress: String,
    deviceInfo: {
      userAgent: String,
      browser: String,
      os: String,
      device: String,
      deviceType: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'unknown'
      }
    },
    lastActivity: Date,
    // Fields for timeout warnings
    warningsSent: [{
      timestamp: {
        type: Date,
        required: true
      },
      warningType: {
        type: String,
        enum: ['IDLE', 'ABSOLUTE', 'SECURITY'],
        required: true
      },
      acknowledged: {
        type: Boolean,
        default: false
      }
    }],
    // Track when user acknowledged warnings
    lastWarningAcknowledged: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Index for cleanup of expired sessions
SessionSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0,
  name: 'session_expiry_ttl_index'
});

// Add method to check if session is expired
SessionSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Add method to extend session expiry
SessionSchema.methods.extend = function(durationMs) {
  this.expiresAt = new Date(Date.now() + durationMs);
  this.lastActivity = new Date();
  return this.save();
};

const Session = mongoose.model('Session', SessionSchema);

module.exports = Session;
