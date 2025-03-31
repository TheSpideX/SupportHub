/**
 * Offline Event Model
 */
const mongoose = require('mongoose');

const offlineEventSchema = new mongoose.Schema({
  roomType: {
    type: String,
    required: true,
    enum: ['user', 'device', 'session', 'tab']
  },
  roomId: {
    type: String,
    required: true
  },
  eventName: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date
  }
}, { timestamps: false });

// Add TTL index for automatic cleanup
offlineEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Add index for faster queries
offlineEventSchema.index({ roomType: 1, roomId: 1, createdAt: 1 });

module.exports = mongoose.model('OfflineEvent', offlineEventSchema);