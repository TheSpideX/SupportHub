/**
 * Reset Rate Limit Script
 * 
 * This script resets rate limiting for registration attempts.
 * Run with: node scripts/reset-rate-limit.js [ip-address]
 */

require('dotenv').config();
const { redisClient, waitForRedisReady } = require('../src/config/redis');
const logger = require('../src/utils/logger');

async function resetRateLimit() {
  try {
    // Wait for Redis to be ready
    await waitForRedisReady(5000);
    
    // Get IP address from command line arguments or use all
    const ipAddress = process.argv[2];
    let pattern;
    
    if (ipAddress) {
      pattern = `ratelimit:register:${ipAddress}`;
      logger.info(`Resetting rate limit for IP: ${ipAddress}`);
    } else {
      pattern = 'ratelimit:register:*';
      logger.info('Resetting rate limit for all IPs');
    }
    
    // Find all keys matching the pattern
    const keys = await redisClient.keys(pattern);
    
    if (keys.length === 0) {
      logger.info('No rate limit keys found');
      process.exit(0);
    }
    
    logger.info(`Found ${keys.length} rate limit keys`);
    
    // Delete all found keys
    for (const key of keys) {
      await redisClient.del(key);
      logger.info(`Deleted key: ${key}`);
    }
    
    logger.info('Rate limit reset successful');
    process.exit(0);
  } catch (error) {
    logger.error('Error resetting rate limit:', error);
    process.exit(1);
  }
}

// Run the script
resetRateLimit();
