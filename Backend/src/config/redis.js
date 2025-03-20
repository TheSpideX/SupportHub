const Redis = require('ioredis');
const logger = require('../utils/logger');

// Create Redis clients
let redisClient = null;
let redisPublisher = null;
let redisSubscriber = null;

// Add fallback storage mechanism
const MemoryStore = {
  data: new Map(),
  get: async (key) => MemoryStore.data.get(key),
  set: async (key, value, mode, duration) => {
    MemoryStore.data.set(key, value);
    if (duration) {
      setTimeout(() => MemoryStore.data.delete(key), duration * 1000);
    }
    return 'OK';
  },
  del: async (key) => MemoryStore.data.delete(key),
  keys: async (pattern) => {
    // Simple pattern matching for in-memory keys
    const matchingKeys = [];
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    // Fix: Use MemoryStore.data.keys() instead of Object.keys(memoryData)
    for (const key of MemoryStore.data.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }
    
    return matchingKeys;
  },
  flushall: async () => MemoryStore.data.clear()
};

// Create Redis client with fallback
const createRedisClient = (db = 0) => {
  try {
    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };

    const client = new Redis(config);
    
    client.on('error', (error) => {
      logger.error('Redis connection error:', error);
      if (!redisAvailable) {
        logger.warn('Using in-memory fallback storage');
      }
      redisAvailable = false;
    });

    client.on('connect', () => {
      logger.info(`Redis connected to ${config.host}:${config.port} DB:${db}`);
      redisAvailable = true;
    });

    return client;
  } catch (error) {
    logger.error('Failed to create Redis client:', error);
    logger.warn('Using in-memory fallback storage');
    redisAvailable = false;
    return MemoryStore;
  }
};

// Track Redis availability
let redisAvailable = false;

// Wrapper for Redis operations with fallback
const redisWrapper = {
  ping: async () => {
    try {
      if (redisAvailable) {
        return await redisClient.ping();
      }
      return "PONG"; // Memory store always responds
    } catch (error) {
      logger.error('Redis ping error, using fallback:', error);
      return "PONG"; // Return PONG from fallback
    }
  },
  get: async (key) => {
    try {
      if (redisAvailable) {
        return await redisClient.get(key);
      }
      return await MemoryStore.get(key);
    } catch (error) {
      logger.error('Redis get error, using fallback:', error);
      return await MemoryStore.get(key);
    }
  },
  set: async (key, value, mode, duration) => {
    try {
      if (redisAvailable) {
        return await redisClient.set(key, value, mode, duration);
      }
      return await MemoryStore.set(key, value, mode, duration);
    } catch (error) {
      logger.error('Redis set error, using fallback:', error);
      return await MemoryStore.set(key, value, mode, duration);
    }
  },
  scan: async (cursor, ...args) => {
    try {
      if (redisAvailable) {
        return await redisClient.scan(cursor, ...args);
      }
      // Memory store fallback for scan (simplified)
      return ['0', []]; // Return empty result with cursor 0
    } catch (error) {
      logger.error('Redis scan error, using fallback:', error);
      return ['0', []]; // Return empty result with cursor 0
    }
  },
  keys: async (pattern) => {
    try {
      if (redisAvailable) {
        return await redisClient.keys(pattern);
      }
      return await MemoryStore.keys(pattern);
    } catch (error) {
      logger.error('Redis keys error, using fallback:', error);
      return await MemoryStore.keys(pattern);
    }
  },
  // Add other methods as needed
};

// Initialize the Redis clients
const initializeRedisClients = () => {
  if (!redisClient) {
    redisClient = createRedisClient(0);
  }
  
  if (!redisPublisher) {
    redisPublisher = createRedisClient(0);
  }
  
  if (!redisSubscriber) {
    redisSubscriber = createRedisClient(0);
  }
  
  return {
    redisClient,
    redisPublisher,
    redisSubscriber
  };
};

// Initialize the clients immediately
const clients = initializeRedisClients();

// Clean up Redis connections on app shutdown
process.on('SIGINT', async () => {
  if (redisClient) await redisClient.quit();
  if (redisPublisher) await redisPublisher.quit();
  if (redisSubscriber) await redisSubscriber.quit();
});

// Export the wrapper instead of direct clients
module.exports = {
  redisClient: redisWrapper,
  redisPublisher,
  redisSubscriber,
  isRedisAvailable: () => redisAvailable
};
