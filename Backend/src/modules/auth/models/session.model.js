const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    deviceInfo: {
      fingerprint: {
        type: String,
        required: true,
        index: true
      },
      userAgent: String,
      ip: String,
      location: {
        city: String,
        country: String,
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      }
    },
    refreshToken: {
      type: String,
      required: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    endedAt: {
      type: Date,
      default: null
    },
    endReason: {
      type: String,
      enum: ['logout', 'expired', 'terminated', 'security_concern'],
      default: null
    },
    securityContext: {
      ipAddress: String,
      userAgent: String,
      createdAt: Date,
      rememberMe: Boolean
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

// Add compound index for active sessions by user
SessionSchema.index({ user: 1, isActive: 1 });

// Add compound index for device fingerprint and user
SessionSchema.index({ user: 1, 'deviceInfo.fingerprint': 1 });

// Add TTL index to automatically remove expired sessions
// Make sure this is defined only once
SessionSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0,
  name: 'expiresAt_ttl_index'
});

// Static method to find active sessions for a user
SessionSchema.statics.findActiveSessions = async function(userId) {
  return this.find({
    user: userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).select('-refreshToken');
};

// Static method to terminate a session
SessionSchema.statics.terminateSession = async function(sessionId, reason = 'logout') {
  return this.findByIdAndUpdate(
    sessionId,
    {
      isActive: false,
      endedAt: new Date(),
      endReason: reason
    },
    { new: true }
  );
};

// Static method to update last activity
SessionSchema.statics.updateLastActivity = async function(sessionId) {
  return this.findByIdAndUpdate(
    sessionId,
    {
      lastActivity: new Date()
    },
    { new: true }
  );
};

// Static method to check if a session is valid
SessionSchema.statics.isSessionValid = async function(sessionId, deviceInfo = null) {
  const session = await this.findById(sessionId);
  
  if (!session) {
    return { isValid: false, reason: 'SESSION_NOT_FOUND' };
  }
  
  if (!session.isActive) {
    return { isValid: false, reason: 'SESSION_TERMINATED' };
  }
  
  if (new Date() > session.expiresAt) {
    // Auto-terminate expired session
    await this.terminateSession(sessionId, 'expired');
    return { isValid: false, reason: 'SESSION_EXPIRED' };
  }
  
  // Check device fingerprint if provided and enforced
  if (deviceInfo?.fingerprint && 
      session.deviceInfo.fingerprint !== deviceInfo.fingerprint) {
    return { isValid: false, reason: 'DEVICE_MISMATCH' };
  }
  
  return { 
    isValid: true, 
    session: {
      id: session._id,
      user: session.user,
      expiresAt: session.expiresAt,
      deviceInfo: session.deviceInfo,
      metadata: session.metadata
    }
  };
};

// Method to extend session expiry
SessionSchema.statics.extendSession = async function(sessionId, expiryDate) {
  return this.findByIdAndUpdate(
    sessionId,
    { expiresAt: expiryDate },
    { new: true }
  );
};

// Method to find session by refresh token
SessionSchema.statics.findByRefreshToken = async function(refreshToken) {
  return this.findOne({
    refreshToken,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).populate('user', 'email username role lastLogin');
};

// Method to find session by device fingerprint
SessionSchema.statics.findByDeviceFingerprint = async function(userId, fingerprint) {
  return this.findOne({
    user: userId,
    'deviceInfo.fingerprint': fingerprint,
    isActive: true
  });
};

// Method to terminate all sessions for a user except current one
SessionSchema.statics.terminateOtherSessions = async function(userId, currentSessionId) {
  const result = await this.updateMany(
    { 
      user: userId, 
      _id: { $ne: currentSessionId },
      isActive: true 
    },
    {
      isActive: false,
      endedAt: new Date(),
      endReason: 'terminated'
    }
  );
  
  return result.modifiedCount;
};

// Method to clean up expired sessions
SessionSchema.statics.cleanupExpiredSessions = async function() {
  const result = await this.updateMany(
    { 
      isActive: true, 
      expiresAt: { $lt: new Date() } 
    },
    {
      isActive: false,
      endedAt: new Date(),
      endReason: 'expired'
    }
  );
  
  return result.modifiedCount;
};

const Session = mongoose.model('Session', SessionSchema);

module.exports = Session;
