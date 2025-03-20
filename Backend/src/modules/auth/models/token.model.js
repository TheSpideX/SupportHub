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

// Static method to clean up expired tokens
TokenSchema.statics.cleanupExpiredTokens = async function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

const Token = mongoose.model('Token', TokenSchema);

module.exports = Token;
