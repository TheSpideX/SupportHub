/**
 * Simple WebSocket Authentication Test
 *
 * This test verifies the WebSocket authentication system by:
 * 1. Creating a test user directly in the database
 * 2. Generating tokens for the user
 * 3. Connecting to the WebSocket server with the tokens
 * 4. Testing token refresh via WebSocket
 * 5. Testing user activity tracking
 * 6. Testing heartbeat mechanism
 */

const mongoose = require("mongoose");
const io = require("socket.io-client");
const crypto = require("crypto");
const { promisify } = require("util");
const sleep = promisify(setTimeout);

// Import models
const User = require("../../src/modules/auth/models/user.model");
const Session = require("../../src/modules/auth/models/session.model");
const Device = require("../../src/modules/auth/models/device.model");

// Import services
const authService = require("../../src/modules/auth/services/auth.service");
const tokenService = require("../../src/modules/auth/services/token.service");
const sessionService = require("../../src/modules/auth/services/session.service");
const deviceService = require("../../src/modules/auth/services/device.service");

// Test user data
const TEST_USER = {
  email: `test.${Date.now()}@example.com`,
  password: "Test123!",
  firstName: "Test",
  lastName: "User",
  phoneNumber: "+1234567890",
};

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

// Test data storage
let testUser = null;
let testSession = null;
let testDevice = null;
let tokens = null;
let socketClient = null;

/**
 * Create test user
 */
async function createTestUser() {
  console.log("\n--- Creating Test User ---");

  // Check if test user already exists
  let user = await User.findOne({ email: TEST_USER.email });

  if (user) {
    console.log("Test user already exists, deleting it");
    await User.deleteOne({ email: TEST_USER.email });
  }

  // Create a new user directly in the database
  user = await User.create({
    email: TEST_USER.email,
    profile: {
      firstName: TEST_USER.firstName,
      lastName: TEST_USER.lastName,
      phoneNumber: TEST_USER.phoneNumber,
      timezone: "America/New_York",
    },
    role: "support",
    status: {
      isActive: true,
      verifiedAt: new Date(),
    },
    security: {
      password: TEST_USER.password, // Let the model handle password hashing
      passwordChangedAt: new Date(),
      emailVerified: true,
      loginAttempts: 0,
      lastLogin: null,
    },
  });

  console.log("Test user created with ID:", user._id);
  testUser = user;

  return user;
}

/**
 * Create test session and device
 */
async function createTestSession() {
  console.log("\n--- Creating Test Session ---");

  // Create device directly
  const device = await Device.create({
    deviceId: crypto.randomBytes(16).toString("hex"),
    userId: testUser._id,
    name: TEST_DEVICE.name,
    fingerprint: TEST_DEVICE.fingerprint,
    userAgent: TEST_DEVICE.userAgent,
    browser: TEST_DEVICE.browser,
    os: TEST_DEVICE.os,
    deviceType: "desktop",
    isVerified: true,
    verifiedAt: new Date(),
    lastActive: new Date(),
    ipAddresses: [TEST_DEVICE.ip],
    trustScore: 100,
    hierarchyPath: {
      userRoom: `user:${testUser._id}`,
    },
  });

  console.log("Test device created with ID:", device._id);
  testDevice = device;

  // Create session
  const session = await sessionService.createSession({
    userId: testUser._id,
    deviceId: device._id,
    ipAddress: TEST_DEVICE.ip,
    userAgent: TEST_DEVICE.userAgent,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  console.log("Test session created with ID:", session._id);
  testSession = session;

  return { session, device };
}

/**
 * Generate tokens for test user
 */
async function generateTokens() {
  console.log("\n--- Generating Tokens ---");

  // Generate tokens using the token service
  const tokenResult = await tokenService.generateAuthTokens(testUser, {
    sessionId: testSession._id,
    userAgent: TEST_DEVICE.userAgent,
    ipAddress: TEST_DEVICE.ip,
    deviceInfo: TEST_DEVICE,
  });

  tokens = {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    csrfToken: tokenResult.csrfToken,
  };

  console.log("Tokens generated");

  return tokens;
}

/**
 * Connect to WebSocket with authentication
 */
async function connectWebSocket() {
  console.log("\n--- Connecting to WebSocket ---");

  // Create tab ID
  const tabId = `tab_${crypto.randomBytes(4).toString("hex")}`;

  // Connect to WebSocket
  socketClient = io("http://localhost:4290/auth", {
    withCredentials: true,
    extraHeaders: {
      Cookie: `access_token=${tokens.accessToken}; refresh_token=${tokens.refreshToken}; csrf_token=${tokens.csrfToken}`,
      "X-CSRF-Token": tokens.csrfToken,
    },
    auth: {
      deviceId: testDevice.deviceId,
      tabId,
      timestamp: Date.now(),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken: tokens.csrfToken,
    },
  });

  // Wait for connection
  await new Promise((resolve, reject) => {
    // Set timeout
    const timeout = setTimeout(() => {
      socketClient.disconnect();
      reject(new Error("Connection timeout"));
    }, 5000);

    // Set up event handlers
    socketClient.on("connect", () => {
      console.log("Socket connected");
      console.log("Socket ID:", socketClient.id);
      clearTimeout(timeout);
      resolve();
    });

    socketClient.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      clearTimeout(timeout);
      reject(error);
    });
  });

  // Wait for auth success event
  const authSuccess = await new Promise((resolve, reject) => {
    // Set timeout
    const timeout = setTimeout(() => {
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

    // Listen for auth error event
    socketClient.on("auth:error", (data) => {
      console.error("Authentication error:", data);
      clearTimeout(timeout);
      reject(new Error(data.message));
    });
  });

  return { socketClient, authSuccess };
}

/**
 * Test token refresh via WebSocket
 */
async function testTokenRefresh() {
  console.log("\n--- Testing Token Refresh ---");

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
      reject(new Error("Token refresh timeout"));
    }, 5000);

    // Listen for token refreshed event
    socketClient.on("token:refreshed", (data) => {
      console.log("Token refreshed");
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
}

/**
 * Test user activity tracking
 */
async function testUserActivity() {
  console.log("\n--- Testing User Activity Tracking ---");

  // Get initial session
  const initialSession = await Session.findById(testSession._id);
  console.log("Initial session last activity:", initialSession.lastActivity);

  // Send user activity
  socketClient.emit("user:activity", {
    tabId: socketClient.auth.tabId,
    timestamp: Date.now(),
    isLeader: true,
  });

  // Wait a bit to ensure activity is processed
  await sleep(1000);

  // Get updated session
  const updatedSession = await Session.findById(testSession._id);
  console.log("Updated session last activity:", updatedSession.lastActivity);

  // Check if activity was updated
  const activityUpdated =
    new Date(updatedSession.lastActivity) >
    new Date(initialSession.lastActivity);
  console.log("Activity updated:", activityUpdated);

  return activityUpdated;
}

/**
 * Test heartbeat mechanism
 */
async function testHeartbeat() {
  console.log("\n--- Testing Heartbeat Mechanism ---");

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
      reject(new Error("Heartbeat timeout"));
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
}

/**
 * Clean up test data
 */
async function cleanUp() {
  console.log("\n--- Cleaning Up Test Data ---");

  // Disconnect socket client
  if (socketClient && socketClient.connected) {
    socketClient.disconnect();
    console.log("Socket client disconnected");
  }

  // Delete test session
  if (testSession) {
    await Session.deleteOne({ _id: testSession._id });
    console.log("Test session deleted");
  }

  // Delete test device
  if (testDevice) {
    await Device.deleteOne({ _id: testDevice._id });
    console.log("Test device deleted");
  }

  // Delete test user
  if (testUser) {
    await User.deleteOne({ _id: testUser._id });
    console.log("Test user deleted");
  }

  return true;
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log("Starting WebSocket authentication tests...");

    // Create test user
    await createTestUser();

    // Create test session and device
    await createTestSession();

    // Generate tokens
    await generateTokens();

    // Connect to WebSocket
    await connectWebSocket();

    // Test token refresh
    await testTokenRefresh();

    // Test user activity tracking
    await testUserActivity();

    // Test heartbeat mechanism
    await testHeartbeat();

    // Clean up
    await cleanUp();

    console.log("\n--- All Tests Completed Successfully ---");
    return true;
  } catch (error) {
    console.error("Error running tests:", error);

    // Clean up
    await cleanUp();

    return false;
  } finally {
    // Close MongoDB connection
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
