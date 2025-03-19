require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 15; // Increase from default 10

// Import custom modules
const { connectDB } = require("./src/config/db");
const logger = require("./src/utils/logger");
const { auth } = require("./src/modules");
const setupSocketIO = require("./src/config/socket");
const {
  errorHandler,
  notFoundHandler,
} = require("./src/middleware/errorMiddleware");

// Fix the import path for the rate limiter
const { apiRateLimit } = require("./src/modules/auth/middleware/rateLimit.middleware");

// Initialize express app
const app = express();
const httpServer = createServer(app);

// Add or update session middleware configuration
const session = require('express-session');
const csrfMiddleware = require('./src/modules/auth/middleware/csrf.middleware');

// Make sure these are added before routes
app.use(cookieParser(process.env.COOKIE_SECRET || 'your-fallback-secret-key')); // Required for parsing cookies

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-fallback-secret-key',
  name: 'app_session', // Custom name for the session cookie
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', // Changed from strict to lax for better UX
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/' // Ensure cookie is sent with all requests
  }
}));

// Make sure CSRF middleware is applied after session middleware
app.use('/api/auth/csrf-token', csrfMiddleware.generateToken);
app.use('/api/auth/csrf', csrfMiddleware.generateToken);

// Configure CORS properly for cookies
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:4290'],
  credentials: true, // Critical for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-CSRF-Token', 
    'X-XSRF-Token',
    'X-Requested-With',
    'Accept',
    'Cache-Control'
  ],
  exposedHeaders: ['X-CSRF-Token']
}));

// Add a specific route for CSRF token that doesn't require authentication
app.get('/api/auth/csrf-token', csrfMiddleware.generateToken);
app.get('/api/auth/csrf', csrfMiddleware.generateToken);

// Remove duplicate routes
// app.use('/api/auth/csrf-token', csrfMiddleware.generateToken);
// app.use('/api/auth/csrf', csrfMiddleware.generateToken);

// Add security headers
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Only set CSP in production to avoid development issues
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self';"
    );
  }
  
  next();
});

// Add a health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Remove duplicate CORS configuration
// app.use(cors({
//   origin: process.env.NODE_ENV === 'production' 
//     ? process.env.FRONTEND_URL 
//     : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:4290'],
//   credentials: true, // Allow credentials (cookies)
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: [
//     'Content-Type', 
//     'Authorization', 
//     'X-CSRF-Token', 
//     'X-Requested-With',
//     'Accept',
//     'Cache-Control'
//   ],
//   exposedHeaders: ['X-CSRF-Token']
// }));

// Add a debug middleware to log cookies
app.use((req, res, next) => {
  if (req.path.includes('/auth/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Cookies:`, req.cookies);
  }
  next();
});

// Add a debug middleware to log all requests and responses
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Request received`);
  
  // Capture the original end method
  const originalEnd = res.end;
  
  // Override the end method
  res.end = function(...args) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Response sent: ${res.statusCode} (${duration}ms)`);
    return originalEnd.apply(this, args);
  };
  
  next();
});

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Initialize modules
auth.initialize(app);

// Health endpoints with correct rate limiter
app.get('/health', apiRateLimit(), (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple in-memory cache for health endpoint
let healthCache = {
  data: { status: 'ok', timestamp: new Date().toISOString() },
  lastUpdated: Date.now()
};

// Health endpoint with caching
app.get('/api/health', apiRateLimit(), (req, res) => {
  // Update cache every 5 seconds
  if (Date.now() - healthCache.lastUpdated > 5000) {
    healthCache.data.timestamp = new Date().toISOString();
    healthCache.lastUpdated = Date.now();
  }
  res.json(healthCache.data);
});

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

    // Check if Redis clients are properly initialized
    if (!redisClient || !redisPublisher || !redisSubscriber) {
      throw new Error("Failed to initialize Redis clients");
    }

    // Wait for Redis connections to be ready
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

    // Setup Socket.IO using the dedicated configuration
    const io = await setupSocketIO(httpServer);
    
    // Make io available globally for other modules
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

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled Rejection:", error);
  process.exit(1);
});

// Handle graceful shutdown
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
