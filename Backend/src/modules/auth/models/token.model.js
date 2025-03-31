const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['refresh', 'access', 'reset-password', 'email-verification', 'two-factor', 'device-verification'],
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    revokedAt: {
      type: Date,
      default: null
    },
    deviceFingerprint: {
      type: String,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // WebSocket-specific fields
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sessionId: {
      type: String,
      index: true
    },
    deviceId: {
      type: String,
      index: true
    },
    tokenVersion: {
      type: Number,
      default: 0
    },
    notifiedExpiration: {
      type: Boolean,
      default: false
    },
    lastCheckedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Add index for token expiration and revocation status
TokenSchema.index({ expiresAt: 1, isRevoked: 1 }, { 
  expireAfterSeconds: 0,  // This adds TTL functionality
  name: 'token_expiry_ttl_index'
});

// Add compound index for token lookup
TokenSchema.index({ token: 1, type: 1, isRevoked: 1 });

// Add compound index for user's tokens
TokenSchema.index({ user: 1, type: 1, isRevoked: 1 });

// This compound index includes expiresAt
// TokenSchema.index({ expiresAt: 1, isRevoked: 1 });

// Add compound index for WebSocket token lookup by session and user
TokenSchema.index({ sessionId: 1, userId: 1, isRevoked: 1 });

// Add compound index for device-specific tokens
TokenSchema.index({ deviceFingerprint: 1, userId: 1, type: 1 });

// Add validation for WebSocket-specific fields
TokenSchema.path('userId').validate(function(value) {
  // Ensure userId is always present for WebSocket tokens
  return value != null;
}, 'UserId is required for WebSocket authentication');

TokenSchema.path('sessionId').validate(function(value) {
  // Only validate if token type is 'access'
  if (this.type === 'access') {
    return value != null;
  }
  return true;
}, 'SessionId is required for access tokens');

// Static method to clean up expired tokens
TokenSchema.statics.cleanupExpiredTokens = async function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

/**
 * Checks if the token is valid for WebSocket authentication
 * 
 * A token is valid for WebSocket connections if:
 * 1. It is not revoked
 * 2. It has not expired
 * 3. It is an access token type
 * 
 * @returns {boolean} Whether the token is valid for WebSocket authentication
 */
TokenSchema.methods.isValidForWebSocket = function() {
  return !this.isRevoked && 
         new Date() < this.expiresAt && 
         this.type === 'access';
};

/**
 * Checks if the token is about to expire and should trigger a warning
 * 
 * @param {number} warningThresholdMinutes - Minutes before expiration to trigger warning
 * @returns {boolean} Whether the token is about to expire
 */
TokenSchema.methods.isAboutToExpire = function(warningThresholdMinutes = 5) {
  const warningThreshold = warningThresholdMinutes * 60 * 1000; // Convert to milliseconds
  const timeUntilExpiration = this.expiresAt.getTime() - Date.now();
  
  return timeUntilExpiration > 0 && timeUntilExpiration <= warningThreshold;
};

// Add method to notify about expiration
TokenSchema.methods.notifyExpiration = async function() {
  if (this.notifiedExpiration) return false;
  
  // Mark as notified
  this.notifiedExpiration = true;
  this.lastCheckedAt = new Date();
  await this.save();
  
  // Create expiration event
  if (this.sessionId) {
    const Session = mongoose.model('Session');
    const session = await Session.findById(this.sessionId);
    
    if (session) {
      return session.propagateEvent('token:expiring', {
        tokenId: this._id,
        expiresAt: this.expiresAt,
        timeRemaining: this.expiresAt.getTime() - Date.now()
      }, 'down');
    }
  }
  
  return false;
};

// Add method to check token against user's token version
TokenSchema.methods.isValidVersion = async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.userId);
  
  if (!user) return false;
  
  return this.tokenVersion === user.tokenVersion;
};

const Token = mongoose.model('Token', TokenSchema);

module.exports = Token;
