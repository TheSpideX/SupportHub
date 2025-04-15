/**
 * Admin Controller
 * Provides administrative functions for system management
 */

const { asyncHandler } = require('../../../utils/errorHandlers');
const logger = require('../../../utils/logger');
const { redisClient } = require('../../../config/redis');

/**
 * Reset rate limit for a specific IP or type
 */
exports.resetRateLimit = asyncHandler(async (req, res) => {
  const { type, ip } = req.body;
  
  if (!type) {
    return res.status(400).json({
      status: 'error',
      message: 'Rate limit type is required'
    });
  }
  
  let pattern;
  if (ip) {
    pattern = `ratelimit:${type}:${ip}`;
  } else {
    pattern = `ratelimit:${type}:*`;
  }
  
  try {
    // Find all keys matching the pattern
    const keys = await redisClient.keys(pattern);
    
    if (keys.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No rate limit keys found'
      });
    }
    
    // Delete all found keys
    for (const key of keys) {
      await redisClient.del(key);
      logger.info(`Admin deleted rate limit key: ${key}`);
    }
    
    return res.status(200).json({
      status: 'success',
      message: `Reset ${keys.length} rate limit keys for ${type}${ip ? ` (IP: ${ip})` : ''}`,
      count: keys.length
    });
  } catch (error) {
    logger.error('Error resetting rate limit:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to reset rate limit'
    });
  }
});
