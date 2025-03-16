const Redis = require('ioredis');
const logger = require('../utils/logger');

// Create Redis clients
let redisClient = null;
let redisPublisher = null;
let redisSubscriber = null;

// Create a Redis client with the given configuration
const createRedisClient = (db = 0) => {
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
  });

  client.on('connect', () => {
    logger.info(`Redis connected to ${config.host}:${config.port} DB:${db}`);
  });

  return client;
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

// Export the clients
module.exports = clients;
