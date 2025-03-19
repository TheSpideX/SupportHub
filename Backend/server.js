// Load environment variables at the very beginning
require('dotenv').config();

const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const EventEmitter = require('events');
const session = require('express-session');
EventEmitter.defaultMaxListeners = 15;

// Import custom modules
const { connectDB } = require("./src/config/db");
const logger = require("./src/utils/logger");
const { auth } = require("./src/modules");
const setupSocketIO = require("./src/config/socket");
const corsConfig = require("./src/config/cors.config");
const cors = require("cors");
const {
  errorHandler,
  notFoundHandler,
} = require("./src/middleware/errorMiddleware");
const { apiRateLimit } = require("./src/modules/auth/middleware/rate-limit");
const csrfMiddleware = require('./src/modules/auth/middleware/csrf');

// Initialize express app
const app = express();
const httpServer = createServer(app);

// Essential middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'your-fallback-secret-key'));

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-fallback-secret-key',
  name: 'app_session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  }
}));

// Configure CORS using the centralized config
app.use(cors(corsConfig));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self';"
    );
  }
  
  next();
});

// CSRF routes - defined before other routes
app.get('/api/auth/csrf-token', csrfMiddleware.generateToken);
app.get('/api/auth/csrf', csrfMiddleware.generateToken);

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  
  // Debug middleware for development only
  app.use((req, res, next) => {
    if (req.path.includes('/auth/')) {
      logger.debug(`${req.method} ${req.url} - Cookies: ${JSON.stringify(req.cookies)}`);
    }
    next();
  });
  
  app.use((req, res, next) => {
    const start = Date.now();
    logger.debug(`${req.method} ${req.url} - Request received`);
    
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - start;
      logger.debug(`${req.method} ${req.url} - Response: ${res.statusCode} (${duration}ms)`);
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
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
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
  data: { status: 'ok', timestamp: new Date().toISOString() },
  lastUpdated: Date.now()
};

app.get('/api/health', apiRateLimit(), (req, res) => {
  if (Date.now() - healthCache.lastUpdated > 5000) {
    healthCache.data.timestamp = new Date().toISOString();
    healthCache.lastUpdated = Date.now();
  }
  res.json(healthCache.data);
});

// Initialize modules
auth.initializeAuthModule(app);

// Error handling middleware should be last
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 4290;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info("MongoDB connected successfully");

    // Import Redis clients
    const {
      redisClient,
      redisPublisher,
      redisSubscriber,
    } = require("./src/config/redis");

    // Check Redis connections
    try {
      await Promise.all([
        redisClient.ping(),
        redisPublisher.ping(),
        redisSubscriber.ping()
      ]);
      logger.info("Redis connected successfully");
    } catch (error) {
      throw new Error(`Redis connection failed: ${error.message}`);
    }

    // Setup Socket.IO
    const io = await setupSocketIO(httpServer);
    app.set('io', io);

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
    const { redisClient, redisPublisher, redisSubscriber } = require("./src/config/redis");
    await redisClient.quit();
    await redisPublisher.quit();
    await redisSubscriber.quit();
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
