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
    },
    // WebSocket-specific fields
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
      ref: 'Device'
    },
    tabs: [{
      tabId: {
        type: String,
        required: true
      },
      lastActivity: {
        type: Date,
        default: Date.now
      },
      isActive: {
        type: Boolean,
        default: true
      },
      socketId: String
    }],
    socketIds: [String], // Track socket connections for this session
    // Store hierarchy components separately for better querying
    hierarchy: {
      userRoom: {
        type: String,
        required: true,
        index: true
      },
      deviceRoom: {
        type: String,
        required: true,
        index: true
      }
    },
    roomSubscriptions: [{
      roomId: String,
      joinedAt: {
        type: Date,
        default: Date.now
      }
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    // Activity tracking
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true
    },
    activityHistory: [{
      timestamp: { type: Date, default: Date.now },
      action: String,
      metadata: mongoose.Schema.Types.Mixed
    }],
    idleTimeout: {
      type: Number,
      default: 30 * 60 * 1000 // 30 minutes in ms
    },
    absoluteTimeout: {
      type: Number,
      default: 24 * 60 * 60 * 1000 // 24 hours in ms
    },
  },
  {
    timestamps: true
  }
);

// Add these methods to the schema properly
// Methods to update activity
SessionSchema.methods.updateActivity = function(action, metadata) {
  this.lastActivity = new Date();
  
  // Only keep last 10 activities
  if (this.activityHistory.length >= 10) {
    this.activityHistory.shift();
  }
  
  this.activityHistory.push({
    timestamp: this.lastActivity,
    action,
    metadata
  });
  
  return this.save();
};

// Check if session is idle
SessionSchema.methods.isIdle = function() {
  const now = new Date();
  const idleTime = now - this.lastActivity;
  return idleTime > this.idleTimeout;
};

// Check if session has expired
SessionSchema.methods.isExpired = function() {
  const now = new Date();
  const sessionAge = now - this.createdAt;
  return sessionAge > this.absoluteTimeout;
};

// Add compound indices for efficient querying
SessionSchema.index({ userId: 1, deviceId: 1 });
SessionSchema.index({ 'hierarchy.userRoom': 1, 'hierarchy.deviceRoom': 1 });

// Add compound index for active sessions by device
SessionSchema.index({ deviceId: 1, isActive: 1, lastActivity: -1 });

// Add compound index for user's sessions across devices
SessionSchema.index({ userId: 1, isActive: 1, lastActivity: -1 });

// Add compound index for tab management
SessionSchema.index({ 'tabs.tabId': 1, isActive: 1 });

// Add validation for tabs array
SessionSchema.path('tabs').validate(function(tabs) {
  // Ensure each tab has a unique tabId within this session
  if (!tabs || tabs.length === 0) return true;
  
  const tabIds = tabs.map(tab => tab.tabId);
  return tabIds.length === new Set(tabIds).size;
}, 'Each tab must have a unique tabId within a session');

// Validate hierarchical integrity
SessionSchema.pre('save', function(next) {
  // Ensure the session has both userId and deviceId
  if (!this.userId || !this.deviceId) {
    return next(new Error('Session must have both userId and deviceId for proper hierarchy'));
  }
  
  // Ensure hierarchyPath is properly set
  if (this.isNew || !this.hierarchyPath) {
    this.hierarchyPath = {
      userRoom: `user:${this.userId}`,
      deviceRoom: `device:${this.deviceId}`
    };
  }
  
  next();
});

/**
 * Gets the room identifier for this session in the WebSocket hierarchy
 * 
 * The session room is a child of the device room and parent to tab rooms.
 * Format: session:{sessionId}
 * 
 * @returns {string} The room identifier for this session
 */
SessionSchema.methods.getRoomId = function() {
  return `session:${this._id}`;
};

/**
 * Adds a new tab to this session
 * 
 * Tabs represent individual browser tabs or windows that share the same session.
 * Each tab has its own socket connection but shares authentication state.
 * 
 * @param {string} tabId - Unique identifier for the tab
 * @param {string} socketId - Socket.IO socket identifier
 * @returns {Promise<Session>} The updated session document
 */
SessionSchema.methods.addTab = async function(tabId, socketId) {
  // Check if tab already exists
  const existingTabIndex = this.tabs.findIndex(tab => tab.tabId === tabId);
  
  if (existingTabIndex === -1) {
    // Add new tab
    this.tabs.push({
      tabId,
      lastActivity: new Date(),
      isActive: true,
      socketId
    });
  } else {
    // Update existing tab
    this.tabs[existingTabIndex].lastActivity = new Date();
    this.tabs[existingTabIndex].isActive = true;
    this.tabs[existingTabIndex].socketId = socketId;
  }
  
  // Add socket ID if not already in the list
  if (socketId && !this.socketIds.includes(socketId)) {
    this.socketIds.push(socketId);
  }
  
  this.lastActivity = new Date();
  await this.save();
  
  // Create tab room if it doesn't exist
  const Room = mongoose.model('Room');
  const tabRoomId = `tab:${tabId}`;
  
  let tabRoom = await Room.findOne({ roomId: tabRoomId });
  
  if (!tabRoom) {
    tabRoom = new Room({
      roomId: tabRoomId,
      roomType: 'tab',
      parentRoom: this.getRoomId(),
      members: socketId ? [socketId] : []
    });
    
    await tabRoom.save();
    
    // Update session room to include this tab as a child
    const sessionRoom = await Room.findOne({ roomId: this.getRoomId() });
    if (sessionRoom) {
      sessionRoom.childRooms.push(tabRoomId);
      await sessionRoom.save();
    }
  } else if (socketId && !tabRoom.members.includes(socketId)) {
    tabRoom.members.push(socketId);
    tabRoom.lastActivity = new Date();
    await tabRoom.save();
  }
  
  return tabRoom;
};

// Add method to remove a tab
SessionSchema.methods.removeTab = async function(tabId) {
  // Find the tab
  const tabIndex = this.tabs.findIndex(tab => tab.tabId === tabId);
  
  if (tabIndex === -1) return null;
  
  // Get socket ID before removing
  const socketId = this.tabs[tabIndex].socketId;
  
  // Remove tab
  this.tabs.splice(tabIndex, 1);
  
  // Remove socket ID if no other tabs are using it
  if (socketId) {
    const isSocketUsed = this.tabs.some(tab => tab.socketId === socketId);
    if (!isSocketUsed) {
      this.socketIds = this.socketIds.filter(id => id !== socketId);
    }
  }
  
  this.lastActivity = new Date();
  await this.save();
  
  // Remove tab room
  const Room = mongoose.model('Room');
  const tabRoomId = `tab:${tabId}`;
  
  await Room.deleteOne({ roomId: tabRoomId });
  
  // Update session room to remove this tab as a child
  const sessionRoom = await Room.findOne({ roomId: this.getRoomId() });
  if (sessionRoom) {
    sessionRoom.childRooms = sessionRoom.childRooms.filter(id => id !== tabRoomId);
    await sessionRoom.save();
  }
  
  return true;
};

// Add method to propagate events up or down the hierarchy
SessionSchema.methods.propagateEvent = async function(eventType, eventData, direction = 'down') {
  const Room = mongoose.model('Room');
  const sessionRoom = await Room.findOne({ roomId: this.getRoomId() });
  
  if (!sessionRoom) return null;
  
  // Create security event
  const SecurityEvent = mongoose.model('SecurityEvent');
  const event = new SecurityEvent({
    userId: this.userId,
    sessionId: this._id,
    deviceId: this.deviceId,
    eventType,
    metadata: eventData,
    roomId: sessionRoom.roomId,
    propagationPath: [sessionRoom.roomId]
  });
  
  await event.save();
  
  // Propagate event based on direction
  if (direction === 'up') {
    // Propagate to device and user rooms
    const deviceRoom = await Room.findOne({ roomId: this.hierarchy.deviceRoom });
    const userRoom = await Room.findOne({ roomId: this.hierarchy.userRoom });
    
    if (deviceRoom) {
      event.propagationPath.push(deviceRoom.roomId);
    }
    
    if (userRoom) {
      event.propagationPath.push(userRoom.roomId);
    }
  } else if (direction === 'down') {
    // Propagate to tab rooms
    for (const tab of this.tabs) {
      const tabRoom = await Room.findOne({ roomId: `tab:${tab.tabId}` });
      if (tabRoom) {
        event.propagationPath.push(tabRoom.roomId);
      }
    }
  }
  
  await event.save();
  return event;
};

// Add method to subscribe to a room
SessionSchema.methods.subscribeToRoom = async function(roomId) {
  // Check if already subscribed
  const isSubscribed = this.roomSubscriptions.some(sub => sub.roomId === roomId);
  
  if (!isSubscribed) {
    this.roomSubscriptions.push({
      roomId,
      joinedAt: new Date()
    });
    
    await this.save();
    
    // Add session's socket IDs to room members
    const Room = mongoose.model('Room');
    const room = await Room.findOne({ roomId });
    
    if (room && this.socketIds.length > 0) {
      for (const socketId of this.socketIds) {
        if (!room.members.includes(socketId)) {
          room.members.push(socketId);
        }
      }
      
      room.lastActivity = new Date();
      await room.save();
    }
    
    return true;
  }
  
  return false;
};

// Add method to unsubscribe from a room
SessionSchema.methods.unsubscribeFromRoom = async function(roomId) {
  // Check if subscribed
  const subscriptionIndex = this.roomSubscriptions.findIndex(sub => sub.roomId === roomId);
  
  if (subscriptionIndex !== -1) {
    this.roomSubscriptions.splice(subscriptionIndex, 1);
    
    await this.save();
    
    // Remove session's socket IDs from room members
    const Room = mongoose.model('Room');
    const room = await Room.findOne({ roomId });
    
    if (room && this.socketIds.length > 0) {
      room.members = room.members.filter(member => !this.socketIds.includes(member));
      
      room.lastActivity = new Date();
      await room.save();
    }
    
    return true;
  }
  
  return false;
};

const Session = mongoose.model('Session', SessionSchema);

module.exports = Session;
