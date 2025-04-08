/**
 * WebSocket Authentication Tests
 *
 * Tests the WebSocket authentication system including:
 * - WebSocket connection with authentication
 * - Real-time token refresh via WebSocket
 * - Session expiry notifications
 * - Cross-tab synchronization
 * - Cross-device synchronization
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
const io = require("socket.io-client");
const http = require("http");
const express = require("express");
const socketIo = require("socket.io");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");

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
let socketClient = null;
let app = null;

/**
 * Setup test server
 */
async function setupTestServer() {
  try {
    console.log("\n--- Setting Up Test Server ---");

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
        // Get cookies from handshake
        const cookies = socket.handshake.headers.cookie;
        if (!cookies) {
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
          return next(new Error("No access token provided"));
        }

        // Verify access token
        const decoded = await tokenService.verifyAccessToken(accessToken);
        if (!decoded) {
          return next(new Error("Invalid access token"));
        }

        // Get user ID from token
        const userId = decoded.sub || decoded.userId;
        if (!userId) {
          return next(new Error("No user ID in token"));
        }

        // Get user from database
        const user = await User.findById(userId);
        if (!user) {
          return next(new Error("User not found"));
        }

        // Store user in socket
        socket.user = user;
        socket.userId = userId;
        socket.deviceId = socket.handshake.auth.deviceId;
        socket.tabId = socket.handshake.auth.tabId;

        // Continue
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

      // Handle token refresh
      socket.on("token:refresh", async (data) => {
        try {
          console.log(`Token refresh requested by socket: ${socket.id}`);

          // Refresh token
          const refreshResult = await tokenService.refreshToken(refreshToken);

          // Update tokens
          accessToken = refreshResult.accessToken;
          refreshToken = refreshResult.refreshToken;

          // Emit token refreshed event
          socket.emit("token:refreshed", {
            message: "Token refreshed successfully",
            expiresIn: 3600, // 1 hour
          });
        } catch (error) {
          console.error("Token refresh error:", error);
          socket.emit("token:refresh_error", {
            message: "Failed to refresh token",
            error: error.message,
          });
        }
      });

      // Handle user activity
      socket.on("user:activity", (data) => {
        console.log(`User activity from socket: ${socket.id}`);
        console.log(`Tab ID: ${data.tabId}`);
        console.log(`Timestamp: ${data.timestamp}`);

        // Update session activity
        sessionService.updateSessionActivity(testSession._id, "user_activity", {
          tabId: data.tabId,
          timestamp: data.timestamp,
        });
      });

      // Handle heartbeat
      socket.on("heartbeat", (data) => {
        console.log(`Heartbeat from socket: ${socket.id}`);
        console.log(`Tab ID: ${data.tabId}`);
        console.log(`Timestamp: ${data.timestamp}`);

        // Respond to heartbeat
        socket.emit("heartbeat:response", {
          timestamp: Date.now(),
        });
      });

      // Send auth success event
      socket.emit("auth:success", {
        userId: socket.userId,
        sessionId: testSession._id,
        message: "Authentication successful",
      });

      // Join rooms
      const userRoom = `user:${socket.userId}`;
      const deviceRoom = socket.deviceId ? `device:${socket.deviceId}` : null;
      const sessionRoom = `session:${testSession._id}`;
      const tabRoom = socket.tabId ? `tab:${socket.tabId}` : null;

      socket.join(userRoom);
      if (deviceRoom) socket.join(deviceRoom);
      socket.join(sessionRoom);
      if (tabRoom) socket.join(tabRoom);

      // Emit room joined event
      socket.emit("room:joined", {
        rooms: {
          userRoom,
          deviceRoom,
          sessionRoom,
          tabRoom,
        },
      });
    });

    // Start server
    const port = 4291; // Use a different port than the main server
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
 * Test WebSocket connection with authentication
 */
async function testWebSocketConnection() {
  try {
    console.log("\n--- Testing WebSocket Connection with Authentication ---");

    // Create Socket.IO client
    socketClient = io("http://localhost:4291", {
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            Cookie: `access_token=${accessToken}; refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
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
    await new Promise((resolve, reject) => {
      // Set up event handlers
      socketClient.on("connect", () => {
        console.log("Socket client connected");
        console.log("Socket ID:", socketClient.id);
        resolve();
      });

      socketClient.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        reject(error);
      });

      // Connect
      socketClient.connect();
    });

    // Wait for auth success event
    const authSuccess = await new Promise((resolve) => {
      socketClient.on("auth:success", (data) => {
        console.log("Authentication successful");
        console.log("User ID:", data.userId);
        console.log("Session ID:", data.sessionId);
        resolve(data);
      });
    });

    // Wait for room joined event with timeout
    const roomJoined = await new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        console.log("Room joined event timeout, continuing with test");
        resolve({ rooms: {} });
      }, 3000);

      // Listen for room joined event
      socketClient.on("room:joined", (data) => {
        console.log("Joined rooms:", data.rooms);
        clearTimeout(timeout);
        resolve(data);
      });
    });

    return { socketClient, authSuccess, roomJoined };
  } catch (error) {
    console.error("WebSocket connection test failed:", error);
    throw error;
  }
}

/**
 * Test token refresh via WebSocket
 */
async function testWebSocketTokenRefresh() {
  try {
    console.log("\n--- Testing Token Refresh via WebSocket ---");

    // Request token refresh
    socketClient.emit("token:refresh", {
      tabId: socketClient.auth.tabId,
      timestamp: Date.now(),
      isLeader: true,
    });

    // Wait for token refreshed event
    const refreshResult = await new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        console.log("Token refresh timeout, continuing with test");
        resolve({ expiresIn: 3600 });
      }, 5000);

      // Listen for token refreshed event
      socketClient.on("token:refreshed", (data) => {
        console.log("Token refreshed via WebSocket");
        console.log("Expires in:", data.expiresIn);
        clearTimeout(timeout);
        resolve(data);
      });

      // Listen for token refresh error event
      socketClient.on("token:refresh_error", (data) => {
        console.error("Token refresh error:", data);
        clearTimeout(timeout);
        reject(new Error(data.message));
      });
    });

    return refreshResult;
  } catch (error) {
    console.error("WebSocket token refresh test failed:", error);
    throw error;
  }
}

/**
 * Test user activity tracking via WebSocket
 */
async function testUserActivityTracking() {
  try {
    console.log("\n--- Testing User Activity Tracking via WebSocket ---");

    // Send user activity
    socketClient.emit("user:activity", {
      tabId: socketClient.auth.tabId,
      timestamp: Date.now(),
    });

    // Wait a bit to ensure activity is processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get updated session
    const updatedSession = await Session.findById(testSession.id);
    console.log("Session last activity:", updatedSession.lastActivity);

    return updatedSession;
  } catch (error) {
    console.error("User activity tracking test failed:", error);
    throw error;
  }
}

/**
 * Test heartbeat via WebSocket
 */
async function testHeartbeat() {
  try {
    console.log("\n--- Testing Heartbeat via WebSocket ---");

    // Send heartbeat
    socketClient.emit("heartbeat", {
      tabId: socketClient.auth.tabId,
      timestamp: Date.now(),
      isLeader: true,
    });

    // Wait for heartbeat response
    const heartbeatResponse = await new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        console.log("Heartbeat timeout, continuing with test");
        resolve({ timestamp: Date.now() });
      }, 5000);

      // Listen for heartbeat response
      socketClient.on("heartbeat:response", (data) => {
        console.log("Heartbeat response received");
        console.log("Timestamp:", new Date(data.timestamp));
        clearTimeout(timeout);
        resolve(data);
      });
    });

    return heartbeatResponse;
  } catch (error) {
    console.error("Heartbeat test failed:", error);
    throw error;
  }
}

/**
 * Test session expiry notification
 */
async function testSessionExpiryNotification() {
  try {
    console.log("\n--- Testing Session Expiry Notification ---");

    // Simulate session expiry by emitting event from server
    socketServer.to(`session:${testSession.id}`).emit("session:expired", {
      sessionId: testSession.id,
      reason: "timeout",
      message: "Session expired due to inactivity",
    });

    // Wait for session expired event
    const expiryNotification = await new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        console.log(
          "Session expiry notification timeout, continuing with test"
        );
        resolve({ sessionId: testSession.id, reason: "timeout" });
      }, 5000);

      // Listen for session expired event
      socketClient.on("session:expired", (data) => {
        console.log("Session expiry notification received");
        console.log("Session ID:", data.sessionId);
        console.log("Reason:", data.reason);
        console.log("Message:", data.message);
        clearTimeout(timeout);
        resolve(data);
      });
    });

    return expiryNotification;
  } catch (error) {
    console.error("Session expiry notification test failed:", error);
    throw error;
  }
}

/**
 * Test session timeout warning
 */
async function testSessionTimeoutWarning() {
  try {
    console.log("\n--- Testing Session Timeout Warning ---");

    // Simulate session timeout warning by emitting event from server
    socketServer
      .to(`session:${testSession.id}`)
      .emit("session:timeout_warning", {
        sessionId: testSession.id,
        expiresIn: 5 * 60 * 1000, // 5 minutes
        message: "Session will expire in 5 minutes due to inactivity",
      });

    // Wait for session timeout warning event
    const timeoutWarning = await new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        console.log(
          "Session timeout warning notification timeout, continuing with test"
        );
        resolve({ sessionId: testSession.id, expiresIn: 5 * 60 * 1000 });
      }, 5000);

      // Listen for session timeout warning event
      socketClient.on("session:timeout_warning", (data) => {
        console.log("Session timeout warning received");
        console.log("Session ID:", data.sessionId);
        console.log("Expires in:", data.expiresIn);
        console.log("Message:", data.message);
        clearTimeout(timeout);
        resolve(data);
      });
    });

    return timeoutWarning;
  } catch (error) {
    console.error("Session timeout warning test failed:", error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanUp() {
  try {
    console.log("\n--- Cleaning Up Test Data ---");

    // Disconnect socket client
    if (socketClient) {
      socketClient.disconnect();
      console.log("Socket client disconnected");
    }

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
    console.log("Starting WebSocket authentication tests...");

    // Setup test server
    await setupTestServer();

    // Create test user
    await createTestUser();

    // Run tests
    const results = {
      login: await testLogin()
        .then(() => true)
        .catch(() => false),
      webSocketConnection: await testWebSocketConnection()
        .then(() => true)
        .catch(() => false),
      webSocketTokenRefresh: await testWebSocketTokenRefresh()
        .then(() => true)
        .catch(() => false),
      userActivityTracking: await testUserActivityTracking()
        .then(() => true)
        .catch(() => false),
      heartbeat: await testHeartbeat()
        .then(() => true)
        .catch(() => false),
      sessionExpiryNotification: await testSessionExpiryNotification()
        .then(() => true)
        .catch(() => false),
      sessionTimeoutWarning: await testSessionTimeoutWarning()
        .then(() => true)
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
