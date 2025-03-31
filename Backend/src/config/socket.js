/**
 * Socket.IO configuration and setup
 */
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const logger = require('../utils/logger');
const corsConfig = require('./cors.config');

/**
 * Sets up Socket.IO with the HTTP server
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} Socket.IO server instance
 */
const setupSocketIO = async (httpServer) => {
  try {
    // Import Redis clients
    const { redisClient, redisPublisher, redisSubscriber, isRedisAvailable } = require('./redis');
    
    // Create Socket.IO server with CORS configuration
    const io = new Server(httpServer, {
      cors: {
        origin: corsConfig.origin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 30000,
      pingInterval: 25000,
      cookie: {
        name: 'io',
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
      }
    });
    
    // Use Redis adapter if available
    if (isRedisAvailable()) {
      try {
        const redisAdapter = createAdapter(redisPublisher, redisSubscriber);
        io.adapter(redisAdapter);
        logger.info('Socket.IO using Redis adapter');
      } catch (error) {
        logger.error('Failed to set up Redis adapter for Socket.IO:', error);
      }
    } else {
      logger.warn('Redis not available, Socket.IO using in-memory adapter');
    }
    
    // Basic connection logging
    io.on('connection', (socket) => {
      logger.debug(`Socket connected: ${socket.id}`);
      
      socket.on('disconnect', (reason) => {
        logger.debug(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      });
    });
    
    logger.info('Socket.IO server initialized');
    return io;
  } catch (error) {
    logger.error('Failed to initialize Socket.IO:', error);
    throw error;
  }
};

module.exports = {
  setupSocketIO
};