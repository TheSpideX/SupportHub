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
  hashData: new Map(), // For hash operations
  setData: new Map(), // For set operations
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
  // Hash operations
  hget: async (key, field) => {
    const hash = MemoryStore.hashData.get(key) || new Map();
    return hash.get(field) || null;
  },
  hset: async (key, field, value) => {
    let hash = MemoryStore.hashData.get(key);
    if (!hash) {
      hash = new Map();
      MemoryStore.hashData.set(key, hash);
    }
    hash.set(field, value);
    return 1;
  },
  hgetall: async (key) => {
    const hash = MemoryStore.hashData.get(key) || new Map();
    const result = {};
    for (const [field, value] of hash.entries()) {
      result[field] = value;
    }
    return result;
  },
  hmset: async (key, obj) => {
    let hash = MemoryStore.hashData.get(key);
    if (!hash) {
      hash = new Map();
      MemoryStore.hashData.set(key, hash);
    }
    for (const [field, value] of Object.entries(obj)) {
      hash.set(field, value);
    }
    return "OK";
  },
  // Set operations
  sMembers: async (key) => {
    const set = MemoryStore.setData.get(key);
    if (!set) {
      return [];
    }
    return Array.from(set);
  },
  sAdd: async (key, ...members) => {
    let set = MemoryStore.setData.get(key);
    if (!set) {
      set = new Set();
      MemoryStore.setData.set(key, set);
    }
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  },
  sRem: async (key, ...members) => {
    const set = MemoryStore.setData.get(key);
    if (!set) {
      return 0;
    }
    let removed = 0;
    for (const member of members) {
      if (set.has(member)) {
        set.delete(member);
        removed++;
      }
    }
    return removed;
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
  expire: async (key, seconds) => {
    const item = MemoryStore.data.get(key);
    if (item) {
      item.expiry = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  },
  expireat: async (key, timestamp) => {
    const item = MemoryStore.data.get(key);
    if (item) {
      item.expiry = timestamp * 1000;
      return 1;
    }
    return 0;
  },
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
      if (mode === "EX" && (isNaN(duration) || duration <= 0)) {
        logger.warn(
          `Invalid Redis expiration value: ${duration}, using default`
        );
        duration = 3600; // Default to 1 hour
      }

      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        let result;

        // Handle different Redis set command formats
        if (mode === "EX" && duration) {
          // Use the correct syntax for setting with expiry
          const options = {
            EX: duration,
          };
          result = await redisClient.set(key, value, options);
        } else if (mode && duration) {
          // For other modes like PX, NX, XX
          const options = {};
          options[mode] = duration;
          result = await redisClient.set(key, value, options);
        } else {
          // Simple set without options
          result = await redisClient.set(key, value);
        }

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
  // Add hget method
  hget: async (key, field) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.hget(key, field);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.hget(key, field);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis hget error, using fallback:", error);
      return await MemoryStore.hget(key, field);
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
  // Add hset method
  hset: async (key, field, value) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.hset(key, field, value);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.hset(key, field, value);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis hset error, using fallback:", error);
      return await MemoryStore.hset(key, field, value);
    }
  },
  // Add sMembers method
  sMembers: async (key) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.smembers(key);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.sMembers(key);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis sMembers error, using fallback:", error);
      return await MemoryStore.sMembers(key);
    }
  },
  // Add sAdd method
  sAdd: async (key, ...members) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.sadd(key, ...members);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.sAdd(key, ...members);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis sAdd error, using fallback:", error);
      return await MemoryStore.sAdd(key, ...members);
    }
  },
  // Add sRem method
  sRem: async (key, ...members) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.srem(key, ...members);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.sRem(key, ...members);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis sRem error, using fallback:", error);
      return await MemoryStore.sRem(key, ...members);
    }
  },
  // For EXPIRE command (sets TTL in seconds)
  expire: async (key, seconds) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.expire(key, seconds);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.expire(key, seconds);
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis expire error, using fallback:", error);
      return await MemoryStore.expire(key, seconds);
    }
  },
  // For EXPIREAT command (sets expiration to absolute Unix timestamp)
  expireat: async (key, timestamp) => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        const result = await redisClient.expireat(key, timestamp);
        redisCircuitBreaker.recordSuccess();
        return result;
      }
      return await MemoryStore.expire(
        key,
        Math.max(1, Math.floor(timestamp - Date.now() / 1000))
      );
    } catch (error) {
      redisCircuitBreaker.recordFailure();
      logger.error("Redis expireat error, using fallback:", error);
      return await MemoryStore.expire(
        key,
        Math.max(1, Math.floor(timestamp - Date.now() / 1000))
      );
    }
  },
  quit: async () => {
    try {
      if (redisAvailable && redisCircuitBreaker.isAllowed()) {
        // Get the actual Redis client instances
        const actualRedisClient = redisClient;
        const actualRedisPublisher = redisPublisher;
        const actualRedisSubscriber = redisSubscriber;

        // Close connections
        if (actualRedisClient) await actualRedisClient.quit().catch(() => {});
        if (actualRedisPublisher)
          await actualRedisPublisher.quit().catch(() => {});
        if (actualRedisSubscriber)
          await actualRedisSubscriber.quit().catch(() => {});

        return true;
      }
      return true; // Memory store doesn't need to be closed
    } catch (error) {
      logger.error("Redis quit error:", error);
      return false;
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
    redisClient.on("connect", onConnect);
    redisClient.on("error", onError);

    // Cleanup function to remove listeners
    function cleanup() {
      clearTimeout(timeout);
      redisClient.removeListener("connect", onConnect);
      redisClient.removeListener("error", onError);
    }
  });
};

// Export the wrapper instead of direct clients
module.exports = {
  redisClient: redisWrapper,
  redisPublisher,
  redisSubscriber,
  isRedisAvailable: () => redisAvailable && redisCircuitBreaker.isAllowed(),
  waitForRedisReady,
  // Expose the actual clients for shutdown purposes
  _redisClient: redisClient,
  _redisPublisher: redisPublisher,
  _redisSubscriber: redisSubscriber,
};
