const mongoose = require('mongoose');

/**
 * Token Blacklist Schema
 * For invalidating tokens before their expiration
 */
const TokenBlacklistSchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create TTL index to automatically remove expired tokens
TokenBlacklistSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0
});

const TokenBlacklist = mongoose.model('TokenBlacklist', TokenBlacklistSchema);

module.exports = TokenBlacklist;