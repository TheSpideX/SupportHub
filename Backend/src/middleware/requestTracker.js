/**
 * Request Tracker Middleware
 * Tracks request metrics for system monitoring
 */

const systemService = require('../modules/system/services/system.service');

/**
 * Middleware to track request metrics
 */
const requestTracker = (req, res, next) => {
  // Record start time
  const startTime = Date.now();
  
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to capture response time
  res.end = function(...args) {
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Check if response is an error
    const isError = res.statusCode >= 400;
    
    // Track the request in the system service
    systemService.trackRequest(responseTime, isError);
    
    // Call the original end method
    return originalEnd.apply(this, args);
  };
  
  next();
};

module.exports = requestTracker;
