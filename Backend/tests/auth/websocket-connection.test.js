/**
 * WebSocket Connection Test
 *
 * This test verifies the WebSocket connection with authentication:
 * 1. Creating a test user directly in the database
 * 2. Creating a test session and device
 * 3. Generating tokens
 * 4. Connecting to WebSocket with authentication
 */

const mongoose = require("mongoose");
const crypto = require("crypto");
const io = require("socket.io-client");

// Import models
const User = require("../../src/modules/auth/models/user.model");
const Session = require("../../src/modules/auth/models/session.model");
const Device = require("../../src/modules/auth/models/device.model");

// Import services
const tokenService = require("../../src/modules/auth/services/token.service");

// Import configs
const cookieConfig = require("../../src/modules/auth/config/cookie.config");

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
 * Create test device
 */
async function createTestDevice() {
  console.log("\n--- Creating Test Device ---");

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
  console.log("Device ID:", device.deviceId);
  testDevice = device;

  return device;
}

/**
 * Create test session
 */
async function createTestSession() {
  console.log("\n--- Creating Test Session ---");

  // Create session
  const session = await Session.create({
    userId: testUser._id,
    deviceId: testDevice._id,
    ipAddress: TEST_DEVICE.ip,
    userAgent: TEST_DEVICE.userAgent,
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    status: "active",
    hierarchyPath: {
      userRoom: `user:${testUser._id}`,
      deviceRoom: `device:${testDevice.deviceId}`,
    },
  });

  console.log("Test session created with ID:", session._id);
  testSession = session;

  return session;
}

/**
 * Generate tokens
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

  console.log("Access Token:", tokens.accessToken.substring(0, 20) + "...");
  console.log("Refresh Token:", tokens.refreshToken.substring(0, 20) + "...");
  console.log("CSRF Token:", tokens.csrfToken);

  return tokens;
}

/**
 * Connect to WebSocket
 */
async function connectToWebSocket() {
  console.log("\n--- Connecting to WebSocket ---");

  // Create cookie string
  const cookieString = `${cookieConfig.names.ACCESS_TOKEN}=${tokens.accessToken}; ${cookieConfig.names.REFRESH_TOKEN}=${tokens.refreshToken}; ${cookieConfig.names.CSRF_TOKEN}=${tokens.csrfToken}`;

  console.log("Cookie String:", cookieString);

  // Connect to WebSocket
  socketClient = io("http://localhost:4290/auth", {
    withCredentials: true,
    extraHeaders: {
      Cookie: cookieString,
      "X-CSRF-Token": tokens.csrfToken,
    },
    auth: {
      deviceId: testDevice.deviceId,
      tabId: "test_tab",
      timestamp: Date.now(),
      token: tokens.accessToken,
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
 * Run test
 */
async function runTest() {
  try {
    console.log("Starting WebSocket connection test...");

    // Create test user
    await createTestUser();

    // Create test device
    await createTestDevice();

    // Create test session
    await createTestSession();

    // Generate tokens
    await generateTokens();

    // Connect to WebSocket
    await connectToWebSocket();

    console.log("\n--- Test Completed Successfully ---");
    return true;
  } catch (error) {
    console.error("Error running test:", error);
    return false;
  } finally {
    // Clean up
    await cleanUp();

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("MongoDB connection closed");

    process.exit(0);
  }
}

// Connect to MongoDB and run test
mongoose
  .connect("mongodb://localhost:27017/tech-support-crm")
  .then(() => {
    console.log("Connected to MongoDB");
    runTest();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
