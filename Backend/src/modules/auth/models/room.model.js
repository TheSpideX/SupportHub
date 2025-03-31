const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    roomType: {
      type: String,
      required: true,
      enum: ['user', 'device', 'session', 'tab'],
      index: true
    },
    parentRoom: {
      type: String,
      index: true
    },
    childRooms: [String],
    members: [String], // Socket IDs in this room
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400 // Auto-expire after 24 hours of inactivity
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  }
);

// Add compound index for room hierarchy navigation
RoomSchema.index({ parentRoom: 1, roomType: 1 });

// Add compound index for room activity tracking
RoomSchema.index({ lastActivity: -1, roomType: 1 });

// Add compound index for member lookup
RoomSchema.index({ 'members': 1, roomType: 1 });

// Validate room ID format based on room type
RoomSchema.path('roomId').validate(function(value) {
  if (!value) return false;
  
  const prefix = this.roomType + ':';
  return value.startsWith(prefix) && value.length > prefix.length;
}, 'Room ID must start with the room type prefix (user:/device:/session:/tab:)');

// Add validation middleware to ensure hierarchy integrity
RoomSchema.pre('save', async function(next) {
  // Skip validation for root-level rooms (user rooms)
  if (this.roomType === 'user') {
    return next();
  }
  
  // Validate parent room exists and is of correct type
  if (!this.parentRoom) {
    return next(new Error(`Parent room is required for ${this.roomType} rooms`));
  }
  
  // Validate parent-child relationship based on hierarchy
  const validParentTypes = {
    'device': ['user'],
    'session': ['device'],
    'tab': ['session']
  };
  
  const parentType = this.parentRoom.split(':')[0];
  if (!validParentTypes[this.roomType].includes(parentType)) {
    return next(new Error(`Invalid parent type ${parentType} for ${this.roomType} room`));
  }
  
  next();
});

// Add method to get full hierarchy path
RoomSchema.methods.getHierarchyPath = async function() {
  let path = [this.roomId];
  let currentRoom = this;
  
  while (currentRoom.parentRoom) {
    const parent = await this.constructor.findOne({ roomId: currentRoom.parentRoom });
    if (!parent) break;
    
    path.unshift(parent.roomId);
    currentRoom = parent;
  }
  
  return path.join('/');
};

// Add method to update last activity
RoomSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Adds a socket to this room's members
 * 
 * When a socket joins a room, it's added to the members array to track
 * which sockets are in which rooms for event propagation.
 * 
 * @param {string} socketId - Socket.IO socket identifier
 * @returns {Promise<Room>} The updated room document
 */
RoomSchema.methods.addMember = function(socketId) {
  if (!this.members.includes(socketId)) {
    this.members.push(socketId);
    this.lastActivity = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Add method to remove a member
RoomSchema.methods.removeMember = function(socketId) {
  this.members = this.members.filter(id => id !== socketId);
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Propagates an event to all members of this room
 * 
 * @param {string} eventType - Type of event to propagate
 * @param {Object} eventData - Data to include with the event
 * @param {string} originSocketId - Socket that originated the event (will be excluded)
 * @returns {Promise<SecurityEvent>} The created security event
 */
RoomSchema.methods.propagateEvent = function(eventType, eventData, originSocketId) {
  // Implementation details...
};

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;
