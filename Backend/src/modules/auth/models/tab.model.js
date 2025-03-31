const mongoose = require('mongoose');

/**
 * Tab Schema
 * Represents a browser tab connected to the system
 */
const TabSchema = new mongoose.Schema(
  {
    tabId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    deviceId: {
      type: String,
      required: true,
      index: true
    },
    socketId: {
      type: String,
      sparse: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isLeader: {
      type: Boolean,
      default: false
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Create compound index for session and tab
TabSchema.index({ sessionId: 1, tabId: 1 }, { unique: true });

// Methods
TabSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

TabSchema.methods.setActive = function(isActive) {
  this.isActive = isActive;
  this.lastActivity = new Date();
  return this.save();
};

TabSchema.methods.setLeader = function(isLeader) {
  this.isLeader = isLeader;
  return this.save();
};

TabSchema.methods.updateSocketId = function(socketId) {
  this.socketId = socketId;
  return this.save();
};

const Tab = mongoose.model('Tab', TabSchema);

module.exports = Tab;