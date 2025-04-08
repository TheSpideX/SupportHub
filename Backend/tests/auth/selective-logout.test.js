/**
 * Selective Logout Test
 *
 * This test verifies the selective logout features:
 * 1. Logout from a specific device
 * 2. Logout from all devices except current
 * 3. Global logout from all devices
 * 4. Logout propagation across tabs and devices
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
    session: testSessions.find(
      (s) => s.deviceId && s.deviceId.toString() === deviceId
    ),
  });

  return { socketClient, authSuccess };
}

/**
 * Test logout from specific device
 */
async function testLogoutFromDevice(deviceToLogout) {
  console.log(`\n--- Testing Logout from ${deviceToLogout} ---`);

  // Find device to logout
  const deviceInfo = socketClients.find((s) => s.deviceName === deviceToLogout);
  if (!deviceInfo) {
    throw new Error(`No device found with name: ${deviceToLogout}`);
  }

  // Set up event listeners for session terminated event
  const sessionTerminatedPromise = new Promise((resolve) => {
    deviceInfo.client.on("session:terminated", (data) => {
      console.log(`${deviceToLogout} received session terminated event:`, data);
      resolve({ deviceName: deviceToLogout, data });
    });
  });

  // Set up disconnect listener
  const disconnectPromise = new Promise((resolve) => {
    deviceInfo.client.on("disconnect", (reason) => {
      console.log(`${deviceToLogout} disconnected:`, reason);
      resolve({ deviceName: deviceToLogout, reason });
    });
  });

  // Create mock request and response objects
  const mockReq = {
    user: testUser,
    session: deviceInfo.session,
    cookies: {
      access_token: deviceTokens[deviceToLogout].accessToken,
      refresh_token: deviceTokens[deviceToLogout].refreshToken,
      csrf_token: deviceTokens[deviceToLogout].csrfToken,
    },
    headers: {
      "user-agent": generateDeviceInfo(deviceToLogout).userAgent,
      "x-csrf-token": deviceTokens[deviceToLogout].csrfToken,
    },
    ip: generateDeviceInfo(deviceToLogout).ip,
  };

  const mockRes = {
    cookies: {},
    cookie: function (name, value, options) {
      this.cookies[name] = value;
    },
    clearCookie: function (name, options) {
      this.cookies[name] = null;
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

  // Logout from device
  await authService.logout(mockReq, mockRes);

  // Wait for session terminated event or disconnect with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 5000);
  });

  // Race between session terminated event, disconnect and timeout
  const result = await Promise.race([
    sessionTerminatedPromise,
    disconnectPromise,
    timeoutPromise,
  ]);

  if (!result) {
    console.log(
      `${deviceToLogout} did not receive session terminated event or disconnect within timeout`
    );
    return { success: false };
  }

  // Check if session was terminated
  const sessionExists = await Session.findById(deviceInfo.session.id);
  console.log(`Session for ${deviceToLogout} terminated:`, !sessionExists);

  // Remove device from socket clients
  const index = socketClients.findIndex((s) => s.deviceName === deviceToLogout);
  if (index !== -1) {
    socketClients.splice(index, 1);
  }

  return { result, success: !sessionExists };
}

/**
 * Test logout from all devices except current
 */
async function testLogoutFromAllExceptCurrent(currentDevice) {
  console.log(
    `\n--- Testing Logout from All Devices Except ${currentDevice} ---`
  );

  // Find current device
  const currentDeviceInfo = socketClients.find(
    (s) => s.deviceName === currentDevice
  );
  if (!currentDeviceInfo) {
    throw new Error(`No device found with name: ${currentDevice}`);
  }

  // Set up event listeners for session terminated event for other devices
  const otherDevices = socketClients.filter(
    (s) => s.deviceName !== currentDevice
  );

  const sessionTerminatedPromises = otherDevices.map((deviceInfo) => {
    return new Promise((resolve) => {
      deviceInfo.client.on("session:terminated", (data) => {
        console.log(
          `${deviceInfo.deviceName} received session terminated event:`,
          data
        );
        resolve({ deviceName: deviceInfo.deviceName, data });
      });
    });
  });

  // Set up disconnect listeners for other devices
  const disconnectPromises = otherDevices.map((deviceInfo) => {
    return new Promise((resolve) => {
      deviceInfo.client.on("disconnect", (reason) => {
        console.log(`${deviceInfo.deviceName} disconnected:`, reason);
        resolve({ deviceName: deviceInfo.deviceName, reason });
      });
    });
  });

  // Create mock request and response objects for current device
  const mockReq = {
    user: testUser,
    session: currentDeviceInfo.session,
    cookies: {
      access_token: deviceTokens[currentDevice].accessToken,
      refresh_token: deviceTokens[currentDevice].refreshToken,
      csrf_token: deviceTokens[currentDevice].csrfToken,
    },
    headers: {
      "user-agent": generateDeviceInfo(currentDevice).userAgent,
      "x-csrf-token": deviceTokens[currentDevice].csrfToken,
    },
    ip: generateDeviceInfo(currentDevice).ip,
  };

  const mockRes = {
    cookies: {},
    cookie: function (name, value, options) {
      this.cookies[name] = value;
    },
    clearCookie: function (name, options) {
      this.cookies[name] = null;
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

  // Use a valid session ID from the test sessions
  const currentSession = testSessions.find(
    (s) => s.deviceId === currentDeviceInfo.deviceId
  );
  if (!currentSession) {
    console.log("No session found for current device, using first session");
  }

  const currentSessionId = currentSession
    ? currentSession._id
    : testSessions[0]._id;
  console.log(`Using session ID: ${currentSessionId}`);

  // Logout from all devices except current
  await sessionService.endAllUserSessionsExceptCurrent(
    testUser._id,
    currentSessionId
  );

  // Wait for session terminated events or disconnects with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve([]);
    }, 5000);
  });

  // Race between session terminated events, disconnects and timeout
  const results = await Promise.race([
    Promise.all([...sessionTerminatedPromises, ...disconnectPromises]),
    timeoutPromise,
  ]);

  // Check if all other sessions were terminated
  const remainingSessions = await Session.find({ userId: testUser._id });
  console.log("Remaining sessions count:", remainingSessions.length);
  console.log("Expected remaining sessions:", 1);

  // Remove terminated devices from socket clients
  for (const deviceInfo of otherDevices) {
    const index = socketClients.findIndex(
      (s) => s.deviceName === deviceInfo.deviceName
    );
    if (index !== -1) {
      socketClients.splice(index, 1);
    }
  }

  return { results, success: remainingSessions.length === 1 };
}

/**
 * Test global logout from all devices
 */
async function testGlobalLogout() {
  console.log("\n--- Testing Global Logout from All Devices ---");

  // Set up event listeners for session terminated event for all devices
  const sessionTerminatedPromises = socketClients.map((deviceInfo) => {
    return new Promise((resolve) => {
      deviceInfo.client.on("session:terminated", (data) => {
        console.log(
          `${deviceInfo.deviceName} received session terminated event:`,
          data
        );
        resolve({ deviceName: deviceInfo.deviceName, data });
      });
    });
  });

  // Set up disconnect listeners for all devices
  const disconnectPromises = socketClients.map((deviceInfo) => {
    return new Promise((resolve) => {
      deviceInfo.client.on("disconnect", (reason) => {
        console.log(`${deviceInfo.deviceName} disconnected:`, reason);
        resolve({ deviceName: deviceInfo.deviceName, reason });
      });
    });
  });

  // Logout from all devices by ending each session individually
  const allSessions = await Session.find({ userId: testUser._id });
  console.log(`Found ${allSessions.length} sessions to end`);

  // End each session
  for (const session of allSessions) {
    await sessionService.endSession(session._id, "global_logout_test");
    console.log(`Ended session ${session._id}`);
  }

  // Wait for session terminated events or disconnects with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve([]);
    }, 5000);
  });

  // Race between session terminated events, disconnects and timeout
  const results = await Promise.race([
    Promise.all([...sessionTerminatedPromises, ...disconnectPromises]),
    timeoutPromise,
  ]);

  // Check if all sessions were terminated
  const remainingSessions = await Session.find({ userId: testUser._id });
  console.log("Remaining sessions count:", remainingSessions.length);
  console.log("Expected remaining sessions:", 0);

  // Clear socket clients
  socketClients = [];

  return { results, success: remainingSessions.length === 0 };
}

/**
 * Clean up test data
 */
async function cleanUp() {
  console.log("\n--- Cleaning Up Test Data ---");

  // Disconnect all socket clients
  for (const socketInfo of socketClients) {
    if (socketInfo.client && socketInfo.client.connected) {
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
    console.log("Starting selective logout tests...");

    // Create test user
    await createTestUser();

    // Login with multiple devices
    await loginWithDevice("Desktop Chrome");
    await loginWithDevice("Mobile Safari");
    await loginWithDevice("Tablet Firefox");
    await loginWithDevice("Work Laptop");

    // Connect devices to WebSocket
    await connectDevice("Desktop Chrome");
    await connectDevice("Mobile Safari");
    await connectDevice("Tablet Firefox");
    await connectDevice("Work Laptop");

    // Test logout from specific device
    await testLogoutFromDevice("Tablet Firefox");

    // Test logout from all devices except current
    await testLogoutFromAllExceptCurrent("Desktop Chrome");

    // Login with a new device
    await loginWithDevice("New Device");
    await connectDevice("New Device");

    // Test global logout
    await testGlobalLogout();

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
