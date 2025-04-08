/**
 * Complete Authentication Flow Test
 *
 * This test verifies the complete authentication flow with multiple devices and tabs:
 * 1. User registration
 * 2. Login with multiple devices
 * 3. Cross-tab synchronization
 * 4. Cross-device synchronization
 * 5. Token refresh
 * 6. Session timeout warnings
 * 7. Selective logout
 * 8. Global logout
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
 * Register test user
 */
async function registerTestUser() {
  console.log("\n--- Registering Test User ---");

  // Check if test user already exists
  let user = await User.findOne({ email: TEST_USER.email });

  if (user) {
    console.log("Test user already exists, deleting it");
    await User.deleteOne({ email: TEST_USER.email });
  }

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

  // Register user
  const createdUser = await User.create({
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

  console.log("Test user registered with ID:", createdUser._id);
  testUser = createdUser;

  return { user: createdUser, mockRes };
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
 * Connect device to WebSocket with multiple tabs
 */
async function connectDeviceWithTabs(deviceName, tabCount) {
  console.log(`\n--- Connecting ${deviceName} with ${tabCount} tabs ---`);

  // Get device tokens
  const tokens = deviceTokens[deviceName];
  if (!tokens) {
    throw new Error(`No tokens found for device: ${deviceName}`);
  }

  // Find device
  const device = testDevices.find((d) => d.name === deviceName);
  if (!device) {
    throw new Error(`No device found with name: ${deviceName}`);
  }

  // Connect tabs
  const tabResults = [];

  for (let i = 1; i <= tabCount; i++) {
    console.log(`Connecting tab ${i} for ${deviceName}`);

    // Find device ID
    const deviceId = device ? device.deviceId || device._id.toString() : null;
    if (!deviceId) {
      throw new Error("No device ID found");
    }

    // Connect to WebSocket
    const socketClient = io("http://localhost:4290/auth", {
      withCredentials: true,
      extraHeaders: {
        Cookie: `access_token=${tokens.accessToken}; refresh_token=${tokens.refreshToken}; csrf_token=${tokens.csrfToken}`,
        "X-CSRF-Token": tokens.csrfToken,
      },
      auth: {
        deviceId: deviceId,
        tabId: `tab_${deviceName.toLowerCase().replace(/\s+/g, "_")}_${i}`,
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
        console.log(`${deviceName} tab ${i} connected`);
        console.log("Socket ID:", socketClient.id);
        clearTimeout(timeout);
        resolve();
      });

      socketClient.on("connect_error", (error) => {
        console.error(`${deviceName} tab ${i} connection error:`, error);
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
        console.log(`${deviceName} tab ${i} authenticated successfully`);
        console.log("User ID:", data.userId);
        console.log("Session ID:", data.sessionId);
        clearTimeout(timeout);
        resolve(data);
      });

      // Listen for auth error event
      socketClient.on("auth:error", (data) => {
        console.error(`${deviceName} tab ${i} authentication error:`, data);
        clearTimeout(timeout);
        reject(new Error(data.message));
      });
    });

    // Store socket client
    socketClients.push({
      deviceName,
      tabId: `tab_${deviceName.toLowerCase().replace(/\s+/g, "_")}_${i}`,
      tabIndex: i,
      client: socketClient,
      device,
      session: testSessions.find(
        (s) => s.deviceId && s.deviceId.toString() === device._id.toString()
      ),
    });

    tabResults.push({ socketClient, authSuccess });
  }

  return tabResults;
}

/**
 * Test cross-tab synchronization
 */
async function testCrossTabSync(deviceName) {
  console.log(`\n--- Testing Cross-Tab Synchronization for ${deviceName} ---`);

  // Find tabs for this device
  const deviceTabs = socketClients.filter((s) => s.deviceName === deviceName);
  if (deviceTabs.length < 2) {
    throw new Error(
      `Need at least two tabs for ${deviceName} to test cross-tab synchronization`
    );
  }

  // Set up event listeners for leader election
  const leaderElectionPromises = deviceTabs.map((tabInfo) => {
    return new Promise((resolve) => {
      tabInfo.client.on("leader:elected", (data) => {
        console.log(
          `${deviceName} tab ${tabInfo.tabIndex} received leader election event:`,
          data
        );
        resolve({ tabId: tabInfo.tabId, data });
      });
    });
  });

  // Trigger leader election by sending heartbeat from all tabs
  for (const [index, tabInfo] of deviceTabs.entries()) {
    tabInfo.client.emit("heartbeat", {
      tabId: tabInfo.tabId,
      timestamp: Date.now(),
      isLeader: index === 0, // First tab claims to be leader
    });

    // Wait a bit between heartbeats
    await sleep(500);
  }

  // Wait for all tabs to receive leader election event
  const results = await Promise.all(leaderElectionPromises);

  // Check if all tabs agree on the leader
  const leaderTabId = results[0].data.tabId;
  const allAgree = results.every((result) => result.data.tabId === leaderTabId);

  console.log("All tabs agree on leader:", allAgree);
  console.log("Elected leader tab ID:", leaderTabId);

  return { results, allAgree, leaderTabId };
}

/**
 * Test cross-device synchronization
 */
async function testCrossDeviceSync() {
  console.log("\n--- Testing Cross-Device Synchronization ---");

  // Group tabs by device
  const deviceGroups = {};
  for (const socketInfo of socketClients) {
    if (!deviceGroups[socketInfo.deviceName]) {
      deviceGroups[socketInfo.deviceName] = [];
    }
    deviceGroups[socketInfo.deviceName].push(socketInfo);
  }

  // We need at least two devices
  if (Object.keys(deviceGroups).length < 2) {
    throw new Error(
      "Need at least two devices for cross-device synchronization test"
    );
  }

  // Set up event listeners for device connected event
  const deviceConnectedPromises = [];

  for (const deviceName in deviceGroups) {
    // Use the first tab of each device
    const firstTab = deviceGroups[deviceName][0];

    deviceConnectedPromises.push(
      new Promise((resolve) => {
        firstTab.client.on("device:connected", (data) => {
          console.log(`${deviceName} received device connected event:`, data);
          resolve({ deviceName, data });
        });
      })
    );
  }

  // Trigger device connected event by sending heartbeat from all devices
  for (const deviceName in deviceGroups) {
    // Use the first tab of each device
    const firstTab = deviceGroups[deviceName][0];

    firstTab.client.emit("heartbeat", {
      deviceId: firstTab.device.deviceId,
      tabId: firstTab.tabId,
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
  const allReceived = results.length === Object.keys(deviceGroups).length;

  console.log("All devices received device connected event:", allReceived);

  return { results, allReceived };
}

/**
 * Test token refresh
 */
async function testTokenRefresh(deviceName) {
  console.log(`\n--- Testing Token Refresh for ${deviceName} ---`);

  // Find tabs for this device
  const deviceTabs = socketClients.filter((s) => s.deviceName === deviceName);
  if (deviceTabs.length === 0) {
    throw new Error(`No tabs found for ${deviceName}`);
  }

  // Use the first tab as the leader
  const leaderTab = deviceTabs[0];

  // Set up event listeners for token refreshed event
  const tokenRefreshedPromises = deviceTabs.map((tabInfo) => {
    return new Promise((resolve) => {
      tabInfo.client.on("token:refreshed", (data) => {
        console.log(
          `${deviceName} tab ${tabInfo.tabIndex} received token refreshed event:`,
          data
        );
        resolve({ tabId: tabInfo.tabId, data });
      });
    });
  });

  // Trigger token refresh from leader tab
  leaderTab.client.emit("token:refresh", {
    tabId: leaderTab.tabId,
    timestamp: Date.now(),
    isLeader: true,
  });

  // Wait for all tabs to receive token refreshed event
  const results = await Promise.all(tokenRefreshedPromises);

  // Check if all tabs received the token refreshed event
  const allReceived = results.length === deviceTabs.length;

  console.log("All tabs received token refreshed event:", allReceived);

  // Update tokens for this device
  if (results.length > 0 && results[0].data) {
    deviceTokens[deviceName] = {
      ...deviceTokens[deviceName],
      accessToken:
        results[0].data.accessToken || deviceTokens[deviceName].accessToken,
      refreshToken:
        results[0].data.refreshToken || deviceTokens[deviceName].refreshToken,
    };
  }

  return { results, allReceived };
}

/**
 * Test session timeout warning
 */
async function testSessionTimeoutWarning(deviceName) {
  console.log(`\n--- Testing Session Timeout Warning for ${deviceName} ---`);

  // Find tabs for this device
  const deviceTabs = socketClients.filter((s) => s.deviceName === deviceName);
  if (deviceTabs.length === 0) {
    throw new Error(`No tabs found for ${deviceName}`);
  }

  // Set up event listeners for session timeout warning
  const timeoutWarningPromises = deviceTabs.map((tabInfo) => {
    return new Promise((resolve) => {
      tabInfo.client.on("session:timeout_warning", (data) => {
        console.log(
          `${deviceName} tab ${tabInfo.tabIndex} received session timeout warning:`,
          data
        );
        resolve({ tabId: tabInfo.tabId, data });
      });
    });
  });

  // Find session for this device
  const session = testSessions.find(
    (s) =>
      s.deviceId &&
      s.deviceId.toString() === deviceTabs[0].device._id.toString()
  );
  if (!session) {
    throw new Error(`No session found for ${deviceName}`);
  }

  // Update session last activity to simulate inactivity
  await Session.updateOne(
    { _id: session.id },
    { $set: { lastActivity: new Date(Date.now() - 25 * 60 * 1000) } } // 25 minutes ago
  );

  // Trigger activity check
  deviceTabs[0].client.emit("user:activity", {
    tabId: deviceTabs[0].tabId,
    timestamp: Date.now(),
    isLeader: true,
  });

  // Wait for all tabs to receive timeout warning with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 5000);
  });

  // Race between timeout warnings and timeout
  const results = await Promise.race([
    Promise.all(timeoutWarningPromises),
    timeoutPromise,
  ]);

  if (!results) {
    console.log("Session timeout warnings not received within timeout");
    return { received: false };
  }

  // Check if all tabs received the timeout warning
  const allReceived = results.length === deviceTabs.length;

  console.log("All tabs received session timeout warning:", allReceived);

  return { results, allReceived };
}

/**
 * Test selective logout
 */
async function testSelectiveLogout(deviceToLogout) {
  console.log(`\n--- Testing Selective Logout for ${deviceToLogout} ---`);

  // Find tabs for this device
  const deviceTabs = socketClients.filter(
    (s) => s.deviceName === deviceToLogout
  );
  if (deviceTabs.length === 0) {
    throw new Error(`No tabs found for ${deviceToLogout}`);
  }

  // Set up event listeners for session terminated event
  const sessionTerminatedPromises = deviceTabs.map((tabInfo) => {
    return new Promise((resolve) => {
      tabInfo.client.on("session:terminated", (data) => {
        console.log(
          `${deviceToLogout} tab ${tabInfo.tabIndex} received session terminated event:`,
          data
        );
        resolve({ tabId: tabInfo.tabId, data });
      });
    });
  });

  // Set up disconnect listeners
  const disconnectPromises = deviceTabs.map((tabInfo) => {
    return new Promise((resolve) => {
      tabInfo.client.on("disconnect", (reason) => {
        console.log(
          `${deviceToLogout} tab ${tabInfo.tabIndex} disconnected:`,
          reason
        );
        resolve({ tabId: tabInfo.tabId, reason });
      });
    });
  });

  // Find session for this device
  const session = testSessions.find(
    (s) =>
      s.deviceId &&
      s.deviceId.toString() === deviceTabs[0].device._id.toString()
  );
  if (!session) {
    throw new Error(`No session found for ${deviceToLogout}`);
  }

  // Terminate session
  await sessionService.terminateSession(session.id);

  // Wait for session terminated events or disconnects with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 5000);
  });

  // Race between session terminated events, disconnects and timeout
  const results = await Promise.race([
    Promise.all([...sessionTerminatedPromises, ...disconnectPromises]),
    timeoutPromise,
  ]);

  if (!results) {
    console.log(
      "Session terminated events or disconnects not received within timeout"
    );
    return { received: false };
  }

  // Check if session was terminated
  const sessionExists = await Session.findById(session.id);
  console.log(`Session for ${deviceToLogout} terminated:`, !sessionExists);

  // Remove device tabs from socket clients
  socketClients = socketClients.filter((s) => s.deviceName !== deviceToLogout);

  return { results, success: !sessionExists };
}

/**
 * Test global logout
 */
async function testGlobalLogout() {
  console.log("\n--- Testing Global Logout ---");

  // Set up event listeners for session terminated event for all tabs
  const sessionTerminatedPromises = socketClients.map((tabInfo) => {
    return new Promise((resolve) => {
      tabInfo.client.on("session:terminated", (data) => {
        console.log(
          `${tabInfo.deviceName} tab ${tabInfo.tabIndex} received session terminated event:`,
          data
        );
        resolve({ deviceName: tabInfo.deviceName, tabId: tabInfo.tabId, data });
      });
    });
  });

  // Set up disconnect listeners for all tabs
  const disconnectPromises = socketClients.map((tabInfo) => {
    return new Promise((resolve) => {
      tabInfo.client.on("disconnect", (reason) => {
        console.log(
          `${tabInfo.deviceName} tab ${tabInfo.tabIndex} disconnected:`,
          reason
        );
        resolve({
          deviceName: tabInfo.deviceName,
          tabId: tabInfo.tabId,
          reason,
        });
      });
    });
  });

  // Logout from all devices
  await sessionService.terminateAllUserSessions(testUser._id);

  // Wait for session terminated events or disconnects with a timeout
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 5000);
  });

  // Race between session terminated events, disconnects and timeout
  const results = await Promise.race([
    Promise.all([...sessionTerminatedPromises, ...disconnectPromises]),
    timeoutPromise,
  ]);

  if (!results) {
    console.log(
      "Session terminated events or disconnects not received within timeout"
    );
    return { received: false };
  }

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
      console.log(
        `Disconnected ${socketInfo.deviceName} tab ${socketInfo.tabIndex}`
      );
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
    console.log("Starting complete authentication flow tests...");

    // Register test user
    await registerTestUser();

    // Login with multiple devices
    await loginWithDevice("Desktop Chrome");
    await loginWithDevice("Mobile Safari");
    await loginWithDevice("Tablet Firefox");

    // Connect devices with multiple tabs
    await connectDeviceWithTabs("Desktop Chrome", 3);
    await connectDeviceWithTabs("Mobile Safari", 2);
    await connectDeviceWithTabs("Tablet Firefox", 1);

    // Test cross-tab synchronization
    await testCrossTabSync("Desktop Chrome");

    // Test cross-device synchronization
    await testCrossDeviceSync();

    // Test token refresh
    await testTokenRefresh("Desktop Chrome");
    await testTokenRefresh("Mobile Safari");

    // Test session timeout warning
    await testSessionTimeoutWarning("Desktop Chrome");

    // Test selective logout
    await testSelectiveLogout("Tablet Firefox");

    // Login with a new device
    await loginWithDevice("Work Laptop");
    await connectDeviceWithTabs("Work Laptop", 2);

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
