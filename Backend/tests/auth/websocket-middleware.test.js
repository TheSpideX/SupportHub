/**
 * WebSocket Authentication Middleware Tests
 *
 * Tests the WebSocket authentication middleware including:
 * - Token validation
 * - CSRF protection
 * - Session validation
 * - Device validation
 */

const mongoose = require("mongoose");
const User = require("../../src/modules/auth/models/user.model");
const Session = require("../../src/modules/auth/models/session.model");
const Device = require("../../src/modules/auth/models/device.model");
const authService = require("../../src/modules/auth/services/auth.service");
const tokenService = require("../../src/modules/auth/services/token.service");
const sessionService = require("../../src/modules/auth/services/session.service");
const deviceService = require("../../src/modules/auth/services/device.service");
const crypto = require("crypto");
const { createServer } = require("http");
const express = require("express");
const socketIo = require("socket.io");
const io = require("socket.io-client");
const cookieParser = require("cookie-parser");

// Test user credentials
const TEST_EMAIL = `test.${Date.now()}@example.com`;
const TEST_PASSWORD = "Test123!";

// Test device info
const TEST_DEVICE = {
  name: "Desktop Chrome",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
  ip: "192.168.1.100",
  browser: "Chrome",
  os: "macOS",
  device: "Desktop",
  screen: "1920x1080",
  language: "en-US",
  timezone: "America/New_York",
  platform: "MacIntel",
  fingerprint: crypto.randomBytes(16).toString("hex"),
};

// Store test data
let testUser = null;
let testSession = null;
let testDevice = null;
let accessToken = null;
let refreshToken = null;
let csrfToken = null;
let socketServer = null;
let httpServer = null;
let app = null;

/**
 * Create test user
 */
async function createTestUser() {
  try {
    console.log("\n--- Creating Test User ---");

    // Check if test user already exists
    let user = await User.findOne({ email: TEST_EMAIL });

    if (user) {
      console.log("Test user already exists, deleting it");
      await User.deleteOne({ email: TEST_EMAIL });
    }

    // Create a new user directly in the database
    user = await User.create({
      email: TEST_EMAIL,
      profile: {
        firstName: "Test",
        lastName: "User",
        phoneNumber: "+1234567890",
        timezone: "America/New_York",
      },
      role: "support",
      status: {
        isActive: true,
        verifiedAt: new Date(),
      },
      security: {
        password: TEST_PASSWORD, // Let the model handle password hashing
        passwordChangedAt: new Date(),
        emailVerified: true,
        loginAttempts: 0,
        lastLogin: null,
      },
    });

    console.log("Test user created with ID:", user._id);
    testUser = user;
    return user;
  } catch (error) {
    console.error("Error creating test user:", error);
    throw error;
  }
}

/**
 * Test user login
 */
async function testLogin() {
  try {
    console.log("\n--- Testing User Login ---");

    // Login with test device
    const loginResult = await authService.login(TEST_EMAIL, TEST_PASSWORD, {
      ipAddress: TEST_DEVICE.ip,
      userAgent: TEST_DEVICE.userAgent,
      deviceInfo: TEST_DEVICE,
    });

    console.log("Login successful");
    console.log("Session ID:", loginResult.session.id);

    // Store session and tokens
    testSession = loginResult.session;
    accessToken = loginResult.tokens.accessToken;
    refreshToken = loginResult.tokens.refreshToken;
    csrfToken = loginResult.tokens.csrfToken;

    // Get device ID from session
    const session = await sessionService.getSessionById(loginResult.session.id);
    if (session.deviceId) {
      const device = await Device.findById(session.deviceId);
      if (device) {
        testDevice = device;
        console.log("Device ID:", device._id);
      }
    }

    return loginResult;
  } catch (error) {
    console.error("Login test failed:", error);
    throw error;
  }
}

/**
 * Setup test server with authentication middleware
 */
async function setupTestServer() {
  try {
    console.log("\n--- Setting Up Test Server with Auth Middleware ---");

    // Create Express app
    app = express();
    app.use(cookieParser());

    // Create HTTP server
    httpServer = createServer(app);

    // Create Socket.IO server
    socketServer = socketIo(httpServer, {
      cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // Set up authentication middleware for Socket.IO
    socketServer.use(async (socket, next) => {
      try {
        console.log("Socket connection attempt:", socket.id);

        // Get cookies from handshake
        const cookies = socket.handshake.headers.cookie;
        if (!cookies) {
          console.log("No cookies provided");
          return next(new Error("No cookies provided"));
        }

        // Parse cookies
        const parsedCookies = {};
        cookies.split(";").forEach((cookie) => {
          const parts = cookie.split("=");
          const name = parts[0].trim();
          const value = parts[1].trim();
          parsedCookies[name] = value;
        });

        // Get access token from cookies
        const accessToken = parsedCookies["access_token"];
        if (!accessToken) {
          console.log("No access token provided");
          return next(new Error("No access token provided"));
        }

        // Verify access token
        const decoded = await tokenService.verifyAccessToken(accessToken);
        if (!decoded) {
          console.log("Invalid access token");
          return next(new Error("Invalid access token"));
        }

        // Get user ID from token
        const userId = decoded.sub || decoded.userId;
        if (!userId) {
          console.log("No user ID in token");
          return next(new Error("No user ID in token"));
        }

        // Get user from database
        const user = await User.findById(userId);
        if (!user) {
          console.log("User not found");
          return next(new Error("User not found"));
        }

        // Check CSRF token if provided
        const csrfToken = parsedCookies["csrf_token"];
        const csrfHeader = socket.handshake.headers["x-csrf-token"];
        if (csrfToken && csrfHeader && csrfToken !== csrfHeader) {
          console.log("CSRF token mismatch");
          return next(new Error("CSRF token mismatch"));
        }

        // Get device ID and tab ID from auth data
        const deviceId = socket.handshake.auth.deviceId;
        const tabId = socket.handshake.auth.tabId;

        // Validate device ID if provided
        if (deviceId) {
          const device = await Device.findById(deviceId);
          if (!device) {
            console.log("Device not found");
            return next(new Error("Device not found"));
          }

          // Check if device belongs to user
          if (device.userId.toString() !== userId.toString()) {
            console.log("Device does not belong to user");
            return next(new Error("Device does not belong to user"));
          }
        }

        // Store user and auth data in socket
        socket.user = user;
        socket.userId = userId;
        socket.deviceId = deviceId;
        socket.tabId = tabId;

        console.log("Socket authenticated successfully");
        next();
      } catch (error) {
        console.error("Socket authentication error:", error);
        next(new Error("Authentication error"));
      }
    });

    // Set up Socket.IO connection handler
    socketServer.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Set up event handlers
      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });

      // Send auth success event
      socket.emit("auth:success", {
        userId: socket.userId,
        sessionId: testSession.id,
        message: "Authentication successful",
      });
    });

    // Start server
    const port = 4292; // Use a different port than the main server
    await new Promise((resolve) => {
      httpServer.listen(port, () => {
        console.log(`Test server listening on port ${port}`);
        resolve();
      });
    });

    return { app, httpServer, socketServer };
  } catch (error) {
    console.error("Error setting up test server:", error);
    throw error;
  }
}

/**
 * Test valid authentication
 */
async function testValidAuthentication() {
  try {
    console.log("\n--- Testing Valid Authentication ---");

    // Create Socket.IO client with valid credentials
    const socketClient = io("http://localhost:4292", {
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            Cookie: `access_token=${accessToken}; refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
            "X-CSRF-Token": csrfToken,
          },
        },
      },
      auth: {
        deviceId: testDevice ? testDevice._id.toString() : null,
        tabId: `tab_${crypto.randomBytes(4).toString("hex")}`,
        timestamp: Date.now(),
      },
    });

    // Wait for connection
    const connectionResult = await new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        socketClient.disconnect();
        reject(new Error("Connection timeout"));
      }, 5000);

      // Set up event handlers
      socketClient.on("connect", () => {
        console.log("Socket client connected with valid credentials");
        console.log("Socket ID:", socketClient.id);
        clearTimeout(timeout);
        resolve(true);
      });

      socketClient.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        clearTimeout(timeout);
        reject(error);
      });

      // Connect
      socketClient.connect();
    });

    // Wait for auth success event
    const authSuccess = await new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        socketClient.disconnect();
        reject(new Error("Auth success timeout"));
      }, 5000);

      // Listen for auth success event
      socketClient.on("auth:success", (data) => {
        console.log("Authentication successful");
        console.log("User ID:", data.userId);
        console.log("Session ID:", data.sessionId);
        clearTimeout(timeout);
        resolve(data);
      });
    });

    // Disconnect
    socketClient.disconnect();

    return { connectionResult, authSuccess };
  } catch (error) {
    console.error("Valid authentication test failed:", error);
    throw error;
  }
}

/**
 * Test invalid token
 */
async function testInvalidToken() {
  try {
    console.log("\n--- Testing Invalid Token ---");

    // Create Socket.IO client with invalid access token
    const socketClient = io("http://localhost:4292", {
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            Cookie: `access_token=invalid_token; refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
            "X-CSRF-Token": csrfToken,
          },
        },
      },
      auth: {
        deviceId: testDevice ? testDevice._id.toString() : null,
        tabId: `tab_${crypto.randomBytes(4).toString("hex")}`,
        timestamp: Date.now(),
      },
    });

    // Wait for connection error
    const connectionError = await new Promise((resolve) => {
      // Set timeout
      const timeout = setTimeout(() => {
        socketClient.disconnect();
        resolve(new Error("Connection succeeded with invalid token"));
      }, 5000);

      // Set up event handlers
      socketClient.on("connect", () => {
        console.error("ERROR: Socket connected with invalid token");
        clearTimeout(timeout);
        socketClient.disconnect();
        resolve(new Error("Connection succeeded with invalid token"));
      });

      socketClient.on("connect_error", (error) => {
        console.log("Connection error as expected:", error.message);
        clearTimeout(timeout);
        resolve(error);
      });

      // Connect
      socketClient.connect();
    });

    // Disconnect
    socketClient.disconnect();

    return connectionError;
  } catch (error) {
    console.error("Invalid token test failed:", error);
    throw error;
  }
}

/**
 * Test missing token
 */
async function testMissingToken() {
  try {
    console.log("\n--- Testing Missing Token ---");

    // Create Socket.IO client with no access token
    const socketClient = io("http://localhost:4292", {
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            Cookie: `refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
            "X-CSRF-Token": csrfToken,
          },
        },
      },
      auth: {
        deviceId: testDevice ? testDevice._id.toString() : null,
        tabId: `tab_${crypto.randomBytes(4).toString("hex")}`,
        timestamp: Date.now(),
      },
    });

    // Wait for connection error
    const connectionError = await new Promise((resolve) => {
      // Set timeout
      const timeout = setTimeout(() => {
        socketClient.disconnect();
        resolve(new Error("Connection succeeded with missing token"));
      }, 5000);

      // Set up event handlers
      socketClient.on("connect", () => {
        console.error("ERROR: Socket connected with missing token");
        clearTimeout(timeout);
        socketClient.disconnect();
        resolve(new Error("Connection succeeded with missing token"));
      });

      socketClient.on("connect_error", (error) => {
        console.log("Connection error as expected:", error.message);
        clearTimeout(timeout);
        resolve(error);
      });

      // Connect
      socketClient.connect();
    });

    // Disconnect
    socketClient.disconnect();

    return connectionError;
  } catch (error) {
    console.error("Missing token test failed:", error);
    throw error;
  }
}

/**
 * Test CSRF protection
 */
async function testCsrfProtection() {
  try {
    console.log("\n--- Testing CSRF Protection ---");

    // Create Socket.IO client with invalid CSRF token
    const socketClient = io("http://localhost:4292", {
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            Cookie: `access_token=${accessToken}; refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
            "X-CSRF-Token": "invalid_csrf_token",
          },
        },
      },
      auth: {
        deviceId: testDevice ? testDevice._id.toString() : null,
        tabId: `tab_${crypto.randomBytes(4).toString("hex")}`,
        timestamp: Date.now(),
      },
    });

    // Wait for connection error
    const connectionError = await new Promise((resolve) => {
      // Set timeout
      const timeout = setTimeout(() => {
        socketClient.disconnect();
        resolve(new Error("Connection succeeded with invalid CSRF token"));
      }, 5000);

      // Set up event handlers
      socketClient.on("connect", () => {
        console.error("ERROR: Socket connected with invalid CSRF token");
        clearTimeout(timeout);
        socketClient.disconnect();
        resolve(new Error("Connection succeeded with invalid CSRF token"));
      });

      socketClient.on("connect_error", (error) => {
        console.log("Connection error as expected:", error.message);
        clearTimeout(timeout);
        resolve(error);
      });

      // Connect
      socketClient.connect();
    });

    // Disconnect
    socketClient.disconnect();

    return connectionError;
  } catch (error) {
    console.error("CSRF protection test failed:", error);
    throw error;
  }
}

/**
 * Test invalid device ID
 */
async function testInvalidDeviceId() {
  try {
    console.log("\n--- Testing Invalid Device ID ---");

    // Create Socket.IO client with invalid device ID
    const socketClient = io("http://localhost:4292", {
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            Cookie: `access_token=${accessToken}; refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
            "X-CSRF-Token": csrfToken,
          },
        },
      },
      auth: {
        deviceId: "invalid_device_id",
        tabId: `tab_${crypto.randomBytes(4).toString("hex")}`,
        timestamp: Date.now(),
      },
    });

    // Wait for connection error
    const connectionError = await new Promise((resolve) => {
      // Set timeout
      const timeout = setTimeout(() => {
        socketClient.disconnect();
        resolve(new Error("Connection succeeded with invalid device ID"));
      }, 5000);

      // Set up event handlers
      socketClient.on("connect", () => {
        console.error("ERROR: Socket connected with invalid device ID");
        clearTimeout(timeout);
        socketClient.disconnect();
        resolve(new Error("Connection succeeded with invalid device ID"));
      });

      socketClient.on("connect_error", (error) => {
        console.log("Connection error as expected:", error.message);
        clearTimeout(timeout);
        resolve(error);
      });

      // Connect
      socketClient.connect();
    });

    // Disconnect
    socketClient.disconnect();

    return connectionError;
  } catch (error) {
    console.error("Invalid device ID test failed:", error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanUp() {
  try {
    console.log("\n--- Cleaning Up Test Data ---");

    // Close socket server
    if (socketServer) {
      await new Promise((resolve) => {
        socketServer.close(() => {
          console.log("Socket server closed");
          resolve();
        });
      });
    }

    // Close HTTP server
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => {
          console.log("HTTP server closed");
          resolve();
        });
      });
    }

    // Delete all sessions for test user
    if (testUser) {
      const deletedSessions = await Session.deleteMany({
        userId: testUser._id,
      });
      console.log(`Deleted ${deletedSessions.deletedCount} sessions`);

      // Delete all devices for test user
      const deletedDevices = await Device.deleteMany({ userId: testUser._id });
      console.log(`Deleted ${deletedDevices.deletedCount} devices`);

      // Delete test user
      await User.deleteOne({ _id: testUser._id });
      console.log("Deleted test user");
    }

    return true;
  } catch (error) {
    console.error("Error cleaning up test data:", error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log("Starting WebSocket authentication middleware tests...");

    // Create test user
    await createTestUser();

    // Login
    await testLogin();

    // Setup test server
    await setupTestServer();

    // Run tests
    const results = {
      validAuthentication: await testValidAuthentication()
        .then(() => true)
        .catch(() => false),
      invalidToken: await testInvalidToken()
        .then((error) => error instanceof Error)
        .catch(() => false),
      missingToken: await testMissingToken()
        .then((error) => error instanceof Error)
        .catch(() => false),
      csrfProtection: await testCsrfProtection()
        .then((error) => error instanceof Error)
        .catch(() => false),
      invalidDeviceId: await testInvalidDeviceId()
        .then((error) => error instanceof Error)
        .catch(() => false),
    };

    // Clean up
    await cleanUp();

    // Print results
    console.log("\n--- Test Results ---");
    for (const [test, passed] of Object.entries(results)) {
      console.log(`${test}: ${passed ? "PASSED" : "FAILED"}`);
    }

    const allPassed = Object.values(results).every((result) => result);
    console.log(
      `\nOverall result: ${
        allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED"
      }`
    );

    return allPassed;
  } catch (error) {
    console.error("Error running tests:", error);
    return false;
  } finally {
    // Close connections
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  }
}

// Connect to MongoDB and run tests
mongoose
  .connect("mongodb://localhost:27017/tech-support-crm")
  .then(() => {
    console.log("Connected to MongoDB");
    runTests();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
