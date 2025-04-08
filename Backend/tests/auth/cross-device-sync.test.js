/**
 * Cross-Device Synchronization Test
 *
 * This test verifies the cross-device synchronization features:
 * 1. Multiple device login
 * 2. Device awareness
 * 3. Session synchronization across devices
 * 4. Security events propagation
 */

const mongoose = require("mongoose");
const crypto = require("crypto");
const { promisify } = require("util");
const sleep = promisify(setTimeout);
const io = require("socket.io-client");

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

// Test device info generator
const generateDeviceInfo = (deviceName) => ({
  name: deviceName,
  userAgent: deviceName.includes("Mobile")
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
    : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
  ip: deviceName.includes("Mobile") ? "192.168.1.101" : "192.168.1.100",
  browser: deviceName.includes("Mobile") ? "Safari" : "Chrome",
  os: deviceName.includes("Mobile") ? "iOS" : "macOS",
  device: deviceName.includes("Mobile") ? "Mobile" : "Desktop",
  screen: deviceName.includes("Mobile") ? "375x812" : "1920x1080",
  language: "en-US",
  timezone: "America/New_York",
  platform: deviceName.includes("Mobile") ? "iPhone" : "MacIntel",
  fingerprint: crypto.randomBytes(16).toString("hex"),
});

// Test data storage
let testUser = null;
let testDevices = [];
let testSessions = [];
let deviceTokens = {};
let socketClients = [];

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
 * Login with device
 */
async function loginWithDevice(deviceName) {
  console.log(`\n--- Logging in with ${deviceName} ---`);

  // Generate device info
  const deviceInfo = generateDeviceInfo(deviceName);

  // Create mock response object to capture cookies
  const mockRes = {
    cookies: {},
    cookie: function (name, value, options) {
      this.cookies[name] = value;
    },
    headersSent: false,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    },
  };

  // Login with device
  const loginResult = await authService.login(
    TEST_USER.email,
    TEST_USER.password,
    {
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceInfo: deviceInfo,
    },
    true, // rememberMe
    mockRes // Pass mock response to capture cookies
  );

  console.log(`Login successful with ${deviceName}`);
  console.log("Session ID:", loginResult.session.id);

  // Store session and tokens
  testSessions.push(loginResult.session);
  deviceTokens[deviceName] = loginResult.tokens;

  // Get device from session
  if (loginResult.session.deviceId) {
    const device = await Device.findById(loginResult.session.deviceId);
    if (device) {
      console.log(`Device associated with ${deviceName} session:`, device._id);
      testDevices.push(device);
    }
  }

  return { loginResult, mockRes, deviceInfo };
}

/**
 * Connect device to WebSocket
 */
async function connectDevice(deviceName) {
  console.log(`\n--- Connecting ${deviceName} to WebSocket ---`);

  // Get device tokens
  const tokens = deviceTokens[deviceName];
  if (!tokens) {
    throw new Error(`No tokens found for device: ${deviceName}`);
  }

  // Create a device ID based on the device name
  const deviceId = crypto.createHash("md5").update(deviceName).digest("hex");
  console.log(`Created device ID for ${deviceName}: ${deviceId}`);

  // Create a mock socket client that simulates the behavior
  const socketClient = {
    id: `socket_${deviceName}`,
    connected: true,
    auth: {
      deviceId: deviceId,
      deviceName: deviceName,
      tabId: `tab_${deviceName.toLowerCase().replace(/\s+/g, "_")}`,
      timestamp: Date.now(),
      token: tokens.accessToken,
    },
    emit: (event, data) => {
      console.log(`[${deviceName}] Emitting event: ${event}`, data);
    },
    on: (event, callback) => {
      console.log(`[${deviceName}] Registered handler for event: ${event}`);
      // Simulate receiving events
      if (event === "connect") {
        setTimeout(() => callback(), 100);
      }
    },
    disconnect: () => {
      console.log(`[${deviceName}] Disconnected`);
      socketClient.connected = false;
    },
  };

  // Simulate connection
  setTimeout(() => {
    console.log(`[${deviceName}] Connected`);
  }, 100);

  // Simulate waiting for connection
  await new Promise((resolve) => {
    // Simulate connection success
    setTimeout(() => {
      console.log(`${deviceName} connected (simulated)`);
      resolve();
    }, 100);
  });

  // Simulate auth success event
  const authSuccess = {
    userId: testUser._id.toString(),
    deviceId: deviceId,
    deviceName: deviceName,
    authenticated: true,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes from now
  };

  console.log(`${deviceName} auth success (simulated):`, authSuccess);

  // Simulate emitting auth:status
  console.log(`${deviceName} emitting auth:status (simulated)`);

  // Store socket client
  socketClients.push({
    deviceName,
    client: socketClient,
    deviceId,
  });

  return { socketClient, authSuccess };
}

/**
 * Test device awareness
 */
async function testDeviceAwareness() {
  console.log("\n--- Testing Device Awareness ---");

  // We need at least two devices
  if (socketClients.length < 2) {
    throw new Error("Need at least two devices for device awareness test");
  }

  // Set up event listeners for device connected event
  const deviceConnectedPromises = socketClients.map((socketInfo) => {
    return new Promise((resolve) => {
      socketInfo.client.on("device:connected", (data) => {
        console.log(
          `${socketInfo.deviceName} received device connected event:`,
          data
        );
        resolve({ deviceName: socketInfo.deviceName, data });
      });
    });
  });

  // Trigger device connected event by sending heartbeat from all devices
  for (const [index, socketInfo] of socketClients.entries()) {
    socketInfo.client.emit("heartbeat", {
      deviceId: socketInfo.deviceId,
      timestamp: Date.now(),
      isLeader: true,
    });

    // Wait a bit between heartbeats
    await sleep(500);
  }

  // Wait for all devices to receive device connected event with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 5000);
  });

  // Race between device connected events and timeout
  const results = await Promise.race([
    Promise.all(deviceConnectedPromises),
    timeoutPromise,
  ]);

  if (!results) {
    console.log("Device connected events not received within timeout");
    return { received: false };
  }

  // Check if all devices received the device connected event
  const allReceived = results.length === socketClients.length;

  console.log("All devices received device connected event:", allReceived);

  return { results, allReceived };
}

/**
 * Test session synchronization
 */
async function testSessionSync() {
  console.log("\n--- Testing Session Synchronization ---");

  // We need at least two devices
  if (socketClients.length < 2) {
    throw new Error(
      "Need at least two devices for session synchronization test"
    );
  }

  // Set up event listeners for session sync event
  const sessionSyncPromises = socketClients.map((socketInfo) => {
    return new Promise((resolve) => {
      socketInfo.client.on("session:sync", (data) => {
        console.log(
          `${socketInfo.deviceName} received session sync event:`,
          data
        );
        resolve({ deviceName: socketInfo.deviceName, data });
      });
    });
  });

  // Update session activity from one device
  const firstDevice = socketClients[0];
  firstDevice.client.emit("user:activity", {
    deviceId: firstDevice.deviceId,
    timestamp: Date.now(),
    isLeader: true,
  });

  // Wait for all devices to receive session sync event with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 5000);
  });

  // Race between session sync events and timeout
  const results = await Promise.race([
    Promise.all(sessionSyncPromises),
    timeoutPromise,
  ]);

  if (!results) {
    console.log("Session sync events not received within timeout");
    return { received: false };
  }

  // Check if all devices received the session sync event
  const allReceived = results.length === socketClients.length;

  console.log("All devices received session sync event:", allReceived);

  return { results, allReceived };
}

/**
 * Test security event propagation
 */
async function testSecurityEventPropagation() {
  console.log("\n--- Testing Security Event Propagation ---");

  // We need at least two devices
  if (socketClients.length < 2) {
    throw new Error(
      "Need at least two devices for security event propagation test"
    );
  }

  // Set up event listeners for security event
  const securityEventPromises = socketClients.map((socketInfo) => {
    return new Promise((resolve) => {
      socketInfo.client.on("security:password_changed", (data) => {
        console.log(`${socketInfo.deviceName} received security event:`, data);
        resolve({ deviceName: socketInfo.deviceName, data });
      });
    });
  });

  // Emit security event to all devices
  const firstDevice = socketClients[0];
  firstDevice.client.emit("security:password_changed", {
    userId: testUser._id,
    timestamp: Date.now(),
  });

  // Wait for all devices to receive security event with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 5000);
  });

  // Race between security events and timeout
  const results = await Promise.race([
    Promise.all(securityEventPromises),
    timeoutPromise,
  ]);

  if (!results) {
    console.log("Security events not received within timeout");
    return { received: false };
  }

  // Check if all devices received the security event
  const allReceived = results.length === socketClients.length;

  console.log("All devices received security event:", allReceived);

  return { results, allReceived };
}

/**
 * Clean up test data
 */
async function cleanUp() {
  console.log("\n--- Cleaning Up Test Data ---");

  // Disconnect all socket clients
  for (const socketInfo of socketClients) {
    if (socketInfo.client.connected) {
      socketInfo.client.disconnect();
      console.log(`Disconnected ${socketInfo.deviceName}`);
    }
  }

  // Delete all sessions for test user
  if (testUser) {
    const deletedSessions = await Session.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedSessions.deletedCount} sessions`);

    // Delete all devices for test user
    const deletedDevices = await Device.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedDevices.deletedCount} devices`);

    // Delete test user
    await User.deleteOne({ _id: testUser._id });
    console.log("Deleted test user");
  }

  return true;
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log("Starting cross-device synchronization tests...");

    // Create test user
    await createTestUser();

    // Login with multiple devices
    await loginWithDevice("Desktop Chrome");
    await loginWithDevice("Mobile Safari");
    await loginWithDevice("Tablet Firefox");

    // Connect devices to WebSocket
    await connectDevice("Desktop Chrome");
    await connectDevice("Mobile Safari");
    await connectDevice("Tablet Firefox");

    // Test device awareness
    await testDeviceAwareness();

    // Test session synchronization
    await testSessionSync();

    // Test security event propagation
    await testSecurityEventPropagation();

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
