const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const logger = require("../utils/logger");
const { sessionService } = require("../modules/auth/services");

// Store IO instance for access from other modules
let io = null;

const setupSocketIO = async (httpServer) => {
  try {
    // Configure Socket.IO with Redis adapter
    io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
      },
      // Add performance and security configuration
      connectTimeout: 10000,
      pingTimeout: 30000,        // Increased to detect broken connections
      pingInterval: 25000,       // Increased for better reliability
      maxHttpBufferSize: 1e6,    // 1MB
      transports: ["websocket"],
      allowUpgrades: true,       // Allow transport upgrades
      perMessageDeflate: {       // Enable compression
        threshold: 1024          // Only compress data > 1KB
      },
      cookie: {
        name: "io",
        httpOnly: true,          // HTTP-only cookie for security
        path: "/"
      }
    });

    // Set up Redis adapter for Socket.IO
    try {
      const { redisPublisher, redisSubscriber } = require("./redis");
      io.adapter(createAdapter(redisPublisher, redisSubscriber));
      logger.info("Socket.IO Redis adapter configured");
    } catch (error) {
      logger.warn(
        "Failed to set up Redis adapter for Socket.IO, using in-memory adapter",
        error
      );
    }

    // Set up session namespace and handlers
    const sessionNamespace = sessionService.setupSessionWebSockets(io);
    if (sessionNamespace) {
      logger.info("Session WebSocket namespace initialized");
    }

    // Handle connection to main namespace (mostly for debugging)
    io.on("connection", (socket) => {
      logger.info(`Client connected to main namespace: ${socket.id}`);
      
      // Mark socket as alive for heartbeat
      socket.isAlive = true;
      
      // Reset isAlive flag when pong is received
      socket.on("pong", () => {
        socket.isAlive = true;
      });

      socket.on("disconnect", () => {
        logger.info(`Client disconnected from main namespace: ${socket.id}`);
      });
    });
    
    // Implement heartbeat interval to detect broken connections
    const heartbeatInterval = setInterval(() => {
      // Check main namespace
      io.sockets.sockets.forEach((socket) => {
        if (socket.isAlive === false) {
          logger.warn(`Terminating inactive socket: ${socket.id}`);
          return socket.disconnect(true);
        }
        
        socket.isAlive = false;
        socket.emit("ping");
      });
      
      // Check session namespace
      if (io.of('/session')) {
        io.of('/session').sockets.forEach((socket) => {
          if (socket.isAlive === false) {
            logger.warn(`Terminating inactive session socket: ${socket.id}`);
            return socket.disconnect(true);
          }
          
          socket.isAlive = false;
          socket.emit("ping");
        });
      }
    }, 30000);
    
    // Clean up interval on server close
    io.on("close", () => {
      clearInterval(heartbeatInterval);
    });

    return io;
  } catch (error) {
    logger.error("Error setting up Socket.IO:", error);
    throw error;
  }
};

// Get the IO instance for use in other modules
const getIO = () => {
  return io;
};

module.exports = {
  setupSocketIO,
  getIO,
};
