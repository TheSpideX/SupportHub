const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      default: 'Unknown Device'
    },
    fingerprint: {
      type: String,
      required: true,
      index: true
    },
    userAgent: String,
    browser: String,
    os: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    lastActive: {
      type: Date,
      default: Date.now
    },
    activeSessions: [{
      type: String,
      ref: 'Session'
    }],
    ipAddresses: [String],
    trustScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    // WebSocket-specific fields
    socketIds: [String],
    hierarchyPath: {
      userRoom: {
        type: String,
        required: true
      }
    }
  },
  {
    timestamps: true
  }
);

// Add compound index for user's devices
DeviceSchema.index({ userId: 1, isVerified: 1 });

// Add compound index for device lookup by fingerprint and verification status
DeviceSchema.index({ fingerprint: 1, isVerified: 1 });

// Add compound index for active devices by last activity
DeviceSchema.index({ userId: 1, lastActive: -1 });

// Add compound index for socket management
DeviceSchema.index({ socketIds: 1, userId: 1 });

// Add validation for hierarchyPath
DeviceSchema.path('hierarchyPath.userRoom').validate(function(value) {
  // Ensure userRoom follows the expected format: user:{userId}
  return value && value.startsWith('user:') && value.split(':')[1] === this.userId.toString();
}, 'Device hierarchyPath.userRoom must follow format "user:{userId}"');

// Validate device fingerprint format
DeviceSchema.path('fingerprint').validate(function(value) {
  // Basic validation for fingerprint format
  return value && value.length >= 8;
}, 'Device fingerprint must be at least 8 characters');

// Initialize hierarchy on creation
DeviceSchema.pre('save', function(next) {
  if (this.isNew) {
    this.hierarchyPath = {
      userRoom: `user:${this.userId}`
    };
  }
  next();
});

/**
 * Gets the room identifier for this device in the WebSocket hierarchy
 * 
 * The device room is a child of the user room and parent to session rooms.
 * Format: device:{deviceId}
 * 
 * @returns {string} The room identifier for this device
 */
DeviceSchema.methods.getRoomId = function() {
  return `device:${this.deviceId}`;
};

/**
 * Updates the last activity timestamp for this device
 * 
 * Called whenever there is any activity from this device to keep
 * track of active devices and enable timeout functionality.
 * 
 * @returns {Promise<Device>} The updated device document
 */
DeviceSchema.methods.updateActivity = function() {
  this.lastActive = new Date();
  return this.save();
};

// Add method to add a session
DeviceSchema.methods.addSession = async function(sessionId) {
  if (!this.activeSessions.includes(sessionId)) {
    this.activeSessions.push(sessionId);
    this.lastActive = new Date();
    await this.save();
    
    // Create or update room relationship
    const Room = mongoose.model('Room');
    const deviceRoom = await Room.findOne({ roomId: this.getRoomId() });
    
    if (deviceRoom) {
      // Add session room as child
      const sessionRoomId = `session:${sessionId}`;
      if (!deviceRoom.childRooms.includes(sessionRoomId)) {
        deviceRoom.childRooms.push(sessionRoomId);
        await deviceRoom.save();
      }
    }
  }
  return this;
};

// Add method to remove a session
DeviceSchema.methods.removeSession = async function(sessionId) {
  this.activeSessions = this.activeSessions.filter(id => id !== sessionId);
  this.lastActive = new Date();
  await this.save();
  
  // Update room relationship
  const Room = mongoose.model('Room');
  const deviceRoom = await Room.findOne({ roomId: this.getRoomId() });
  
  if (deviceRoom) {
    // Remove session room as child
    const sessionRoomId = `session:${sessionId}`;
    deviceRoom.childRooms = deviceRoom.childRooms.filter(id => id !== sessionRoomId);
    await deviceRoom.save();
  }
  
  return this;
};

// Add method to propagate events up or down the hierarchy
DeviceSchema.methods.propagateEvent = async function(eventType, eventData, direction = 'down') {
  const Room = mongoose.model('Room');
  const deviceRoom = await Room.findOne({ roomId: this.getRoomId() });
  
  if (!deviceRoom) return null;
  
  // Create security event
  const SecurityEvent = mongoose.model('SecurityEvent');
  const event = new SecurityEvent({
    userId: this.userId,
    deviceId: this.deviceId,
    eventType,
    metadata: eventData,
    roomId: deviceRoom.roomId,
    propagationPath: [deviceRoom.roomId]
  });
  
  await event.save();
  
  // Propagate event based on direction
  if (direction === 'up') {
    // Propagate to user room
    const userRoom = await Room.findOne({ roomId: this.hierarchyPath.userRoom });
    
    if (userRoom) {
      event.propagationPath.push(userRoom.roomId);
    }
  } else if (direction === 'down') {
    // Propagate to session rooms
    const Session = mongoose.model('Session');
    for (const sessionId of this.activeSessions) {
      const session = await Session.findById(sessionId);
      if (session) {
        const sessionRoom = await Room.findOne({ roomId: session.getRoomId() });
        if (sessionRoom) {
          event.propagationPath.push(sessionRoom.roomId);
        }
      }
    }
  }
  
  await event.save();
  return event;
};

// Add method to verify device
DeviceSchema.methods.verify = async function() {
  this.isVerified = true;
  this.verifiedAt = new Date();
  await this.save();
  
  // Propagate device verification event
  return this.propagateEvent('device:verified', {
    deviceId: this.deviceId,
    verifiedAt: this.verifiedAt
  }, 'both');
};

const Device = mongoose.model('Device', DeviceSchema);

module.exports = Device;
