/**
 * Device Info Model
 * Stores information about user devices for security purposes
 */
const mongoose = require('mongoose');

const deviceInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fingerprint: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: 'Unknown device'
  },
  userAgent: String,
  ipHash: String,
  firstSeen: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isTrusted: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

// Compound index for faster lookups
deviceInfoSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });

const DeviceInfo = mongoose.model('DeviceInfo', deviceInfoSchema);

module.exports = DeviceInfo;