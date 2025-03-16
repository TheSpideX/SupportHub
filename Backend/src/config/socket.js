const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const logger = require('../utils/logger');

const setupSocketIO = async (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true
        }
    });

    // Set up Redis adapter for Socket.IO
    const { redisPublisher, redisSubscriber } = require('./redis');
    io.adapter(createAdapter(redisPublisher, redisSubscriber));

    // Handle connection
    io.on('connection', (socket) => {
        logger.info(`Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            logger.info(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

module.exports = setupSocketIO;