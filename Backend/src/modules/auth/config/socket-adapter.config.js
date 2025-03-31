/**
 * Socket.IO Redis adapter configuration
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const socketAdapterConfig = {
  // Redis adapter configuration
  redis: {
    // Prefix for Redis keys to avoid collisions
    prefix: 'socket:',
    
    // Adapter options
    requestsTimeout: 5000, // ms to wait for adapter requests
    publishOnSpecificResponseChannel: true, // Optimize for large deployments
    
    // Retry strategy for Redis connection issues
    retryInterval: 1000, // Initial retry interval in ms
    maxRetries: 10, // Maximum number of retries
    
    // Adapter performance tuning
    pingInterval: 25000, // How often to ping Redis
    pingTimeout: 5000, // How long to wait for Redis ping response
    
    // Horizontal scaling settings
    clusterMode: false, // Enable for Redis cluster
    shardingEnabled: isDevelopment ? false : true, // Enable for production
    
    // Adapter health monitoring
    healthCheckInterval: 30000, // Check adapter health every 30s
    logLevel: isDevelopment ? 'debug' : 'error' // Logging level
  }
};

module.exports = socketAdapterConfig;