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
      pingTimeout: 30000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6, // 1MB
      transports: ["websocket", "polling"], // Support both but prefer websocket
      allowUpgrades: true,
      perMessageDeflate: {
        threshold: 1024,
      },
      cookie: {
        name: "io",
        httpOnly: true,
        path: "/",
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      },
    });

    // Set up Redis adapter for Socket.IO with better error handling
    try {
      const { redisPublisher, redisSubscriber } = require("./redis");

      if (redisPublisher && redisSubscriber) {
        // Add a small delay to ensure Redis clients are ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check that Redis clients are actually available
        if (
          redisPublisher.status === "ready" &&
          redisSubscriber.status === "ready"
        ) {
          io.adapter(createAdapter(redisPublisher, redisSubscriber));
          logger.info("Socket.IO Redis adapter configured successfully");

          // Listen for adapter errors
          const adapter = io.of("/").adapter;
          adapter.on("error", (error) => {
            logger.error("Socket.IO Redis adapter error:", error);
          });
        } else {
          throw new Error("Redis clients not ready");
        }
      } else {
        throw new Error("Redis clients not available");
      }
    } catch (error) {
      logger.warn(
        "Failed to set up Redis adapter for Socket.IO, using in-memory adapter",
        error
      );
      logger.info("Socket.IO using default in-memory adapter");
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

    // Implement adaptive heartbeat interval to detect broken connections
    const heartbeatInterval = setInterval(() => {
      // Check main namespace
      const mainSockets = Array.from(io.sockets.sockets.values());
      let activeCount = 0;
      let terminatedCount = 0;

      mainSockets.forEach((socket) => {
        if (socket.isAlive === false) {
          logger.warn(`Terminating inactive socket: ${socket.id}`);
          socket.disconnect(true);
          terminatedCount++;
        } else {
          socket.isAlive = false;
          socket.emit("ping");
          activeCount++;
        }
      });

      // Log heartbeat statistics if there are connections
      if (activeCount > 0 || terminatedCount > 0) {
        logger.debug(
          `Heartbeat: ${activeCount} active, ${terminatedCount} terminated in main namespace`
        );
      }

      // Check session namespace
      if (io.of("/session")) {
        const sessionSockets = Array.from(io.of("/session").sockets.values());
        let sessionActiveCount = 0;
        let sessionTerminatedCount = 0;

        sessionSockets.forEach((socket) => {
          if (socket.isAlive === false) {
            logger.warn(`Terminating inactive session socket: ${socket.id}`);
            socket.disconnect(true);
            sessionTerminatedCount++;
          } else {
            socket.isAlive = false;
            socket.emit("ping");
            sessionActiveCount++;
          }
        });

        // Log heartbeat statistics if there are connections
        if (sessionActiveCount > 0 || sessionTerminatedCount > 0) {
          logger.debug(
            `Heartbeat: ${sessionActiveCount} active, ${sessionTerminatedCount} terminated in session namespace`
          );
        }
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

// Get the IO instance
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};

module.exports = {
  setupSocketIO,
  getIO,
};
