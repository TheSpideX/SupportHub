/**
 * Room registry configuration for WebSocket authentication system
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const roomRegistryConfig = {
  // Redis storage configuration
  storage: {
    keyPrefix: 'room:',
    metadataPrefix: 'room:meta:',
    eventPrefix: 'room:event:',
    
    // TTL settings for room data
    roomTTL: 604800, // 7 days (matches session TTL)
    metadataTTL: 604800, // 7 days (matches session TTL)
    eventTTL: 6 * 60 * 60, // 6 hours for event history
    
    // Cleanup settings
    cleanupInterval: 60 * 60 * 1000, // Run cleanup every hour
    orphanedRoomCheck: true // Check for and clean orphaned rooms
  },
  
  // Room hierarchy settings
  hierarchy: {
    maxDepth: 4, // Maximum depth of room hierarchy (user->device->session->tab)
    enforceHierarchy: true, // Enforce parent-child relationships
    cascadeEvents: true, // Allow events to cascade through hierarchy
    validateRoomNames: true // Validate room names against patterns
  },
  
  // Room types and naming patterns
  roomTypes: {
    user: {
      pattern: 'user:[a-f0-9]{24}', // MongoDB ObjectId format
      maxChildren: 10 // Maximum devices per user
    },
    device: {
      pattern: 'device:[a-f0-9]{32}', // 32-char hex device ID
      maxChildren: 5 // Maximum sessions per device
    },
    session: {
      pattern: 'session:[a-f0-9]{64}', // 64-char hex session ID
      maxChildren: 20 // Maximum tabs per session
    },
    tab: {
      pattern: 'tab:[a-f0-9]{32}', // 32-char hex tab ID
      maxChildren: 0 // Tabs don't have children
    }
  },
  
  // Performance settings
  performance: {
    cacheSize: isDevelopment ? 100 : 1000, // Number of rooms to cache in memory
    batchSize: 50, // Batch size for room operations
    concurrentOperations: 5 // Maximum concurrent room operations
  }
};

module.exports = roomRegistryConfig;
