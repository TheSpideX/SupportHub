const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
  // Token hash (for lookup)
  token: {
    type: String,
    required: true,
    index: true
  },
  
  // JWT ID (jti claim)
  jti: {
    type: String,
    index: true
  },
  
  // Token type (access or refresh)
  type: {
    type: String,
    enum: ['access', 'refresh'],
    default: 'refresh'
  },
  
  // User ID associated with the token
  userId: {
    type: String,
    index: true
  },
  
  // When the token expires (for cleanup)
  expiresAt: {
    type: Date,
    required: true
  },
  
  // When the token was blacklisted
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create TTL index to automatically remove expired tokens
blacklistedTokenSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0,
  name: 'expiresAt_ttl_index'
});

const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistedTokenSchema);

module.exports = BlacklistedToken;