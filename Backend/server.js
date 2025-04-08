// Load environment variables at the very beginning
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const EventEmitter = require("events");
EventEmitter.defaultMaxListeners = 15;

// Import custom modules
const { connectDB } = require("./src/config/db");
const logger = require("./src/utils/logger");
const { initializeModules, shutdownModules } = require("./src/modules");
const primusConfig = require("./src/config/primus");
const corsConfig = require("./src/config/cors.config");
const cors = require("cors");
const {
  errorHandler,
  notFoundHandler,
} = require("./src/middleware/errorMiddleware");
const { apiRateLimit } = require("./src/modules/auth/middleware/rate-limit");
const csrfMiddleware = require("./src/modules/auth/middleware/csrf");
const { tokenService, sessionService } = require("./src/modules/auth/services");

// Initialize express app
const app = express();
const httpServer = createServer(app);

// Essential middleware
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || "your-fallback-secret-key"));

// Configure CORS using the centralized config
app.use(cors(corsConfig));

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self';"
    );
  }

  next();
});

// CSRF routes - defined before other routes
app.get("/api/auth/csrf-token", csrfMiddleware.generateToken);
app.get("/api/auth/csrf", csrfMiddleware.generateToken);

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));

  // Debug middleware for development only
  app.use((req, res, next) => {
    if (req.path.includes("/auth/")) {
      logger.debug(
        `${req.method} ${req.url} - Cookies: ${JSON.stringify(req.cookies)}`
      );
    }
    next();
  });

  app.use((req, res, next) => {
    const start = Date.now();
    logger.debug(`${req.method} ${req.url} - Request received`);

    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = Date.now() - start;
      logger.debug(
        `${req.method} ${req.url} - Response: ${res.statusCode} (${duration}ms)`
      );
      return originalEnd.apply(this, args);
    };

    next();
  });
}

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Technical Support CRM API",
      version: "1.0.0",
      description: "API documentation for Technical Support CRM",
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:4290",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "access_token",
        },
        csrfToken: {
          type: "apiKey",
          in: "header",
          name: "X-CSRF-Token",
        },
      },
    },
  },
  apis: ["./src/modules/**/routes/*.js", "./src/modules/**/docs/*.yaml"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health endpoints
const healthCache = {
  data: { status: "ok", timestamp: new Date().toISOString() },
  lastUpdated: Date.now(),
};

app.get("/api/health", apiRateLimit(), (req, res) => {
  if (Date.now() - healthCache.lastUpdated > 5000) {
    healthCache.data.timestamp = new Date().toISOString();
    healthCache.lastUpdated = Date.now();
  }
  res.json(healthCache.data);
});

// Start server
const PORT = process.env.PORT || 4290;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info("MongoDB connected successfully");

    // Import Redis clients and wait for them to initialize
    const {
      redisClient,
      redisPublisher,
      redisSubscriber,
      waitForRedisReady,
    } = require("./src/config/redis");

    // Wait for Redis to be ready or timeout
    try {
      await waitForRedisReady(5000); // Wait up to 5 seconds
      if (require("./src/config/redis").isRedisAvailable()) {
        logger.info("Redis connected successfully");
      } else {
        logger.warn("Redis not available, using in-memory fallback");
      }
    } catch (error) {
      logger.warn(`Redis connection issue: ${error.message}`);
    }

    // Setup Primus
    const primus = await primusConfig.setupPrimus(httpServer);
    app.set("primus", primus);

    // Add Primus client library route
    const primusRoutes = require("./src/routes/primus.routes");
    app.use("/primus-lib", primusRoutes);

    // Serve Primus client library directly
    app.get("/primus/primus.js", (req, res) => {
      try {
        // Set CORS headers to ensure the script can be loaded from different origins
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        // Set content type and caching headers
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 1 day

        // Get the client library
        const library = primus.library();

        // Log success
        logger.debug("Serving Primus client library", {
          size: library.length,
          url: req.originalUrl,
        });

        // Send the library
        res.send(library);
      } catch (error) {
        logger.error("Error serving Primus client library", {
          error,
          url: req.originalUrl,
        });
        res
          .status(500)
          .send(`// Error serving Primus client library: ${error.message}`);
      }
    });

    // Add a health check endpoint for Primus
    app.get("/primus/status", (req, res) => {
      res.json({
        status: "ok",
        timestamp: Date.now(),
        clientLibraryUrl: "/primus/primus.js",
      });
    });

    // Initialize application modules with Primus
    await initializeModules(app, primus, {
      auth: {
        cookieSecret: process.env.COOKIE_SECRET,
        session: {
          timeouts: {
            idle: parseInt(process.env.SESSION_IDLE_TIMEOUT || "1800000", 10),
            absolute: parseInt(
              process.env.SESSION_ABSOLUTE_TIMEOUT || "86400000",
              10
            ),
          },
        },
        websocket: {
          rooms: {
            userPrefix: "user:",
            devicePrefix: "device:",
            sessionPrefix: "session:",
            tabPrefix: "tab:",
          },
          events: {
            tokenExpiring: "token:expiring",
            tokenRefreshed: "token:refreshed",
            sessionTimeout: "session:timeout_warning",
            securityAlert: "security:alert",
          },
        },
        redis: redisClient,
      },
    });

    // Error handling middleware should be last
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
      );
      logger.info(
        `API Documentation available at http://localhost:${PORT}/api-docs`
      );
    });
  } catch (error) {
    logger.error("Server startup failed:", error);
    process.exit(1);
  }
};

// Error handling
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled Rejection:", error);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    logger.info("Initiating graceful shutdown...");

    // Shutdown application modules
    await shutdownModules();

    // Close Redis connections
    const { redisClient, isRedisAvailable } = require("./src/config/redis");

    // Only attempt to close Redis if it's available
    if (isRedisAvailable()) {
      await redisClient
        .quit()
        .catch((err) => logger.warn("Error closing Redis connections:", err));
      logger.info("Redis connections closed");
    }

    // Close HTTP server
    await new Promise((resolve) => httpServer.close(resolve));

    logger.info("Server shut down successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start the server
startServer();

module.exports = app; // For testing purposes
