const Redis = require("ioredis");
const logger = require("../utils/logger");
const CircuitBreaker = require("../utils/CircuitBreaker");

// Create Redis clients
let redisClient = null;
let redisPublisher = null;
let redisSubscriber = null;

// Track Redis availability
let redisAvailable = false;

// Circuit breaker for Redis operations
const redisCircuitBreaker = new CircuitBreaker("redis", {
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  monitorInterval: 10000, // 10 seconds
});

// Add fallback storage mechanism
const MemoryStore = {
  data: new Map(),
  get: async (key) => MemoryStore.data.get(key),
  set: async (key, value, mode, duration) => {
    MemoryStore.data.set(key, value);
    if (duration) {
      setTimeout(() => MemoryStore.data.delete(key), duration * 1000);
    }
    return "OK";
  },
  del: async (key) => MemoryStore.data.delete(key),
  keys: async (pattern) => {
    // Simple pattern matching for in-memory keys
    const matchingKeys = [];
    const regex = new RegExp(pattern.replace("*", ".*"));

    for (const key of MemoryStore.data.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }

    return matchingKeys;
  },
  scan: async (cursor, match, count) => {
    // Simple implementation of scan for in-memory
    const keys = [];
    const regex = new RegExp(match.replace("*", ".*"));

    // Get up to 'count' matching keys
    let matchCount = 0;
    for (const key of MemoryStore.data.keys()) {
      if (regex.test(key) && matchCount < (count || 10)) {
        keys.push(key);
        matchCount++;
      }
    }

    // Always return "0" as next cursor to indicate completion
    return ["0", keys];
  },
  hgetall: async (key) => {
    const value = MemoryStore.data.get(key);
    return value && typeof value === "object" ? value : {};
  },
  hmset: async (key, obj) => {
    MemoryStore.data.set(key, obj);
    return "OK";
  },
  flushall: async () => MemoryStore.data.clear(),
};

// Create Redis client with fallback and health monitoring
const createRedisClient = (db = 0) => {
  try {
    const config = {
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: db,
      retryStrategy: (times) => {
        if (times > 10) {
          // After 10 retries, stop attempting and use memory fallback
          redisAvailable = false;
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      // Add connection timeout
      connectTimeout: 5000,
      // Add command timeout
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
    };

    const client = new Redis(config);

    client.on("error", (error) => {
      logger.error("Redis connection error:", error);
      redisAvailable = false;
      redisCircuitBreaker.recordFailure();
    });

    client.on("connect", () => {
      logger.info(`Redis connected to ${config.host}:${config.port} DB:${db}`);
      redisAvailable = true;
      redisCircuitBreaker.recordSuccess();
    });

    client.on("reconnecting", (timeToReconnect) => {
      logger.info(`Redis reconnecting in ${timeToReconnect}ms`);
    });

    // Add periodic health check
    const healthCheckInterval = setInterval(async () => {
      try {
        if (client.status === "ready") {
          await client.ping();
          redisAvailable = true;
          redisCircuitBreaker.recordSuccess();
        }
      } catch (error) {
        logger.warn("Redis health check failed:", error);
        redisAvailable = false;
        redisCircuitBreaker.recordFailure();
      }
    }, 30000); // Check every 30 seconds

    // Clean up interval on client close
    client.on("end", () => {
      clearInterval(healthCheckInterval);
    });

    return client;
  } catch (error) {
    logger.error("Failed to create Redis client:", error);
    logger.warn("Using in-memory fallback storage");
    redisAvailable = false;
    return MemoryStore;
  }
};

// Wrapper for Redis operations with improved error handling
const redisWrapper = {
  ping: async () => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        return await redisClient.ping();
      }
      return "PONG"; // Memory store always responds
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis ping error, using fallback:", error);
      return "PONG"; // Return PONG from fallback
    }
  },
  get: async (key) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.get(key);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.get(key);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis get error, using fallback:", error);
      return await MemoryStore.get(key);
    }
  },
  set: async (key, value, mode, duration) => {
    try {
      // Validate duration if EX mode is used
      if (mode === 'EX' && (isNaN(duration) || duration <= 0)) {
        logger.warn(`Invalid Redis expiration value: ${duration}, using default`);
        duration = 3600; // Default to 1 hour
      }
      
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.set(key, value, mode, duration);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.set(key, value, mode, duration);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis set error, using fallback:", error);
      return await MemoryStore.set(key, value, mode, duration);
    }
  },
  scan: async (cursor, ...args) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.scan(cursor, ...args);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      // Memory store fallback for scan
      return await MemoryStore.scan(cursor, args[1], args[3]);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis scan error, using fallback:", error);
      return await MemoryStore.scan(cursor, args[1], args[3]);
    }
  },
  keys: async (pattern) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.keys(pattern);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.keys(pattern);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis keys error, using fallback:", error);
      return await MemoryStore.keys(pattern);
    }
  },
  del: async (key) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.del(key);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.del(key);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis del error, using fallback:", error);
      return await MemoryStore.del(key);
    }
  },
  hgetall: async (key) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.hgetall(key);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.hgetall(key);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis hgetall error, using fallback:", error);
      return await MemoryStore.hgetall(key);
    }
  },
  hmset: async (key, obj) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.hmset(key, obj);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.hmset(key, obj);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis hmset error, using fallback:", error);
      return await MemoryStore.hmset(key, obj);
    }
  },
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
    redisSubscriber,
  };
};

// Initialize the clients immediately
const clients = initializeRedisClients();

// Clean up Redis connections on app shutdown
process.on("SIGINT", async () => {
  if (redisClient) await redisClient.quit().catch(() => {});
  if (redisPublisher) await redisPublisher.quit().catch(() => {});
  if (redisSubscriber) await redisSubscriber.quit().catch(() => {});
});

// Add a function to wait for Redis to be ready
const waitForRedisReady = (timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    // If Redis is already available, resolve immediately
    if (redisAvailable) {
      return resolve(true);
    }
    
    // Set a timeout
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Redis connection timeout"));
    }, timeoutMs);
    
    // Set up event listeners
    const onConnect = () => {
      cleanup();
      resolve(true);
    };
    
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    
    // Add temporary listeners
    redisClient.on('connect', onConnect);
    redisClient.on('error', onError);
    
    // Cleanup function to remove listeners
    function cleanup() {
      clearTimeout(timeout);
      redisClient.removeListener('connect', onConnect);
      redisClient.removeListener('error', onError);
    }
  });
};

// Export the wrapper instead of direct clients
module.exports = {
  redisClient: redisWrapper,
  redisPublisher,
  redisSubscriber,
  isRedisAvailable: () => redisAvailable && redisCircuitBreaker.isAllowed(),
  waitForRedisReady
};
