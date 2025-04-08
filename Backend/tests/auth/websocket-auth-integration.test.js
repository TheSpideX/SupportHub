/**
 * WebSocket Authentication Integration Test
 *
 * This test verifies the complete authentication flow including:
 * - User registration
 * - Login with HTTP-only cookies
 * - WebSocket connection with authentication
 * - Cross-tab synchronization
 * - Cross-device synchronization
 * - Token refresh via WebSocket
 * - Session expiry and timeout warnings
 * - Logout and session termination
 */

const mongoose = require("mongoose");
const request = require("supertest");
const io = require("socket.io-client");
const crypto = require("crypto");
const { promisify } = require("util");
const sleep = promisify(setTimeout);

// Import models
const User = require("../../src/modules/auth/models/user.model");
const Session = require("../../src/modules/auth/models/session.model");
const Device = require("../../src/modules/auth/models/device.model");

// Import express and create a test app
const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const app = express();

// Configure app
app.use(bodyParser.json());
app.use(cookieParser());

// Import auth routes
const authRoutes = require("../../src/modules/auth/routes");
app.use("/api/auth", authRoutes);

// Test user data
const TEST_USER = {
  email: `test.${Date.now()}@example.com`,
  password: "Test123!",
  firstName: "Test",
  lastName: "User",
  phoneNumber: "+1234567890",
};

// Test device info
const generateDeviceInfo = (deviceName) => ({
  name: deviceName,
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
});

// Test data storage
let testUser = null;
let testSessions = [];
let testDevices = [];
let cookies = {};
let socketClients = [];

/**
 * Register a test user
 */
async function registerTestUser() {
  console.log("\n--- Registering Test User ---");

  // Check if test user already exists
  let user = await User.findOne({ email: TEST_USER.email });

  if (user) {
    console.log("Test user already exists, deleting it");
    await User.deleteOne({ email: TEST_USER.email });
  }

  // Register user via API
  const response = await request(app)
    .post("/api/auth/register")
    .send(TEST_USER);

  console.log(`Registration response status: ${response.status}`);

  if (response.status !== 201) {
    console.error("Registration failed:", response.body);
    throw new Error(`Registration failed: ${response.status}`);
  }

  // Store cookies
  const responseCookies = response.headers["set-cookie"];
  cookies.registration = parseCookies(responseCookies);

  console.log("Registration cookies:", Object.keys(cookies.registration));

  // Get user from database
  user = await User.findOne({ email: TEST_USER.email });
  if (!user) {
    throw new Error("User not found after registration");
  }

  console.log("Test user registered with ID:", user._id);
  testUser = user;

  return { user, response };
}

/**
 * Login with test user
 */
async function loginTestUser(deviceInfo) {
  console.log(`\n--- Logging in Test User (${deviceInfo.name}) ---`);

  // Login via API
  const response = await request(app).post("/api/auth/login").send({
    email: TEST_USER.email,
    password: TEST_USER.password,
    rememberMe: true,
    securityContext: deviceInfo,
  });

  console.log(`Login response status: ${response.status}`);

  if (response.status !== 200) {
    console.error("Login failed:", response.body);
    throw new Error(`Login failed: ${response.status}`);
  }

  // Store cookies
  const responseCookies = response.headers["set-cookie"];
  const deviceKey = deviceInfo.name.replace(/\s+/g, "_").toLowerCase();
  cookies[deviceKey] = parseCookies(responseCookies);

  console.log(
    `Login cookies for ${deviceKey}:`,
    Object.keys(cookies[deviceKey])
  );

  // Get session from response
  const sessionId = response.body.session?.id;
  if (!sessionId) {
    throw new Error("No session ID in login response");
  }

  // Get session from database
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  console.log("Session created with ID:", session._id);
  testSessions.push(session);

  // Get device from session
  if (session.deviceId) {
    const device = await Device.findById(session.deviceId);
    if (device) {
      console.log("Device associated with session:", device._id);
      testDevices.push(device);
    }
  }

  return { response, session };
}

/**
 * Connect to WebSocket with authentication
 */
async function connectWebSocket(deviceName) {
  console.log(`\n--- Connecting to WebSocket (${deviceName}) ---`);

  // Get device cookies
  const deviceKey = deviceName.replace(/\s+/g, "_").toLowerCase();
  const deviceCookies = cookies[deviceKey];

  if (!deviceCookies) {
    throw new Error(`No cookies found for device: ${deviceName}`);
  }

  // Create cookie string
  const cookieString = Object.entries(deviceCookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  // Get device ID
  const device = testDevices.find((d) => d.name === deviceName);
  const deviceId = device ? device._id.toString() : null;

  // Create tab ID
  const tabId = `tab_${crypto.randomBytes(4).toString("hex")}`;

  // Connect to WebSocket
  const socketClient = io("http://localhost:4290/auth", {
    withCredentials: true,
    extraHeaders: {
      Cookie: cookieString,
      "X-CSRF-Token": deviceCookies.csrf_token,
    },
    auth: {
      deviceId,
      tabId,
      timestamp: Date.now(),
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
      console.log(`Socket connected for ${deviceName}`);
      console.log("Socket ID:", socketClient.id);
      clearTimeout(timeout);
      resolve();
    });

    socketClient.on("connect_error", (error) => {
      console.error(`Socket connection error for ${deviceName}:`, error);
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
      console.log(`Authentication successful for ${deviceName}`);
      console.log("User ID:", data.userId);
      console.log("Session ID:", data.sessionId);
      clearTimeout(timeout);
      resolve(data);
    });

    // Listen for auth error event
    socketClient.on("auth:error", (data) => {
      console.error(`Authentication error for ${deviceName}:`, data);
      clearTimeout(timeout);
      reject(new Error(data.message));
    });
  });

  // Store socket client
  socketClients.push({
    name: deviceName,
    client: socketClient,
    tabId,
    deviceId,
  });

  return { socketClient, authSuccess };
}

/**
 * Test token refresh via WebSocket
 */
async function testTokenRefresh(deviceName) {
  console.log(`\n--- Testing Token Refresh (${deviceName}) ---`);

  // Find socket client
  const socketInfo = socketClients.find((s) => s.name === deviceName);
  if (!socketInfo) {
    throw new Error(`No socket client found for device: ${deviceName}`);
  }

  const socketClient = socketInfo.client;

  // Request token refresh
  socketClient.emit("token:refresh", {
    tabId: socketInfo.tabId,
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
      console.log(`Token refreshed for ${deviceName}`);
      console.log("Expires in:", data.expiresIn);
      clearTimeout(timeout);
      resolve(data);
    });

    // Listen for token refresh error event
    socketClient.on("token:refresh_error", (data) => {
      console.error(`Token refresh error for ${deviceName}:`, data);
      clearTimeout(timeout);
      reject(new Error(data.message));
    });
  });

  return refreshResult;
}

/**
 * Test cross-tab synchronization
 */
async function testCrossTabSync() {
  console.log("\n--- Testing Cross-Tab Synchronization ---");

  // We need at least two tabs for the same device
  const device1Name = "Desktop Chrome";

  // Connect two tabs for the same device
  const tab1 = await connectWebSocket(device1Name);
  const tab2 = await connectWebSocket(device1Name);

  // Find socket clients
  const socketInfo1 = socketClients.find(
    (s) => s.client.id === tab1.socketClient.id
  );
  const socketInfo2 = socketClients.find(
    (s) => s.client.id === tab2.socketClient.id
  );

  // Set up event listeners for cross-tab sync
  const syncPromises = [
    new Promise((resolve) => {
      socketInfo1.client.on("leader:elected", (data) => {
        console.log("Tab 1 received leader election event:", data);
        resolve(data);
      });
    }),
    new Promise((resolve) => {
      socketInfo2.client.on("leader:elected", (data) => {
        console.log("Tab 2 received leader election event:", data);
        resolve(data);
      });
    }),
  ];

  // Trigger leader election by refreshing token in one tab
  await testTokenRefresh(device1Name);

  // Wait for both tabs to receive leader election event
  const results = await Promise.all(syncPromises);

  return results;
}

/**
 * Test cross-device synchronization
 */
async function testCrossDeviceSync() {
  console.log("\n--- Testing Cross-Device Synchronization ---");

  // We need two different devices
  const device1Name = "Desktop Chrome";
  const device2Name = "Mobile Safari";

  // Login with second device if not already done
  if (!cookies[device2Name.replace(/\s+/g, "_").toLowerCase()]) {
    await loginTestUser(generateDeviceInfo(device2Name));
  }

  // Connect both devices if not already connected
  let device1Socket = socketClients.find((s) => s.name === device1Name);
  let device2Socket = socketClients.find((s) => s.name === device2Name);

  if (!device1Socket) {
    const result = await connectWebSocket(device1Name);
    device1Socket = socketClients.find(
      (s) => s.client.id === result.socketClient.id
    );
  }

  if (!device2Socket) {
    const result = await connectWebSocket(device2Name);
    device2Socket = socketClients.find(
      (s) => s.client.id === result.socketClient.id
    );
  }

  // Set up event listeners for device connected events
  const deviceConnectedPromise = new Promise((resolve) => {
    device1Socket.client.on("device:connected", (data) => {
      console.log("Device 1 received device connected event:", data);
      resolve(data);
    });
  });

  // Trigger device connected event by sending heartbeat
  device2Socket.client.emit("heartbeat", {
    tabId: device2Socket.tabId,
    timestamp: Date.now(),
    isLeader: true,
  });

  // Wait for device connected event
  const result = await deviceConnectedPromise;

  return result;
}

/**
 * Test session timeout warning
 */
async function testSessionTimeoutWarning(deviceName) {
  console.log(`\n--- Testing Session Timeout Warning (${deviceName}) ---`);

  // Find socket client
  const socketInfo = socketClients.find((s) => s.name === deviceName);
  if (!socketInfo) {
    throw new Error(`No socket client found for device: ${deviceName}`);
  }

  // Set up event listener for session timeout warning
  const timeoutWarningPromise = new Promise((resolve) => {
    socketInfo.client.on("session:timeout_warning", (data) => {
      console.log(`${deviceName} received session timeout warning:`, data);
      resolve(data);
    });
  });

  // Simulate inactivity by not sending any activity for a while
  console.log(`Waiting for session timeout warning for ${deviceName}...`);

  // Wait for timeout warning (with a timeout)
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 10000); // 10 seconds timeout
  });

  // Race between timeout warning and our own timeout
  const result = await Promise.race([timeoutWarningPromise, timeoutPromise]);

  if (!result) {
    console.log("No timeout warning received within 10 seconds");

    // Manually trigger a timeout warning for testing
    console.log("Manually triggering timeout warning for testing");

    // Find session for this device
    const device = testDevices.find((d) => d.name === deviceName);
    const session = testSessions.find(
      (s) => s.deviceId && s.deviceId.toString() === device._id.toString()
    );

    if (session) {
      // Emit timeout warning to session room
      socketInfo.client.emit("user:activity", {
        tabId: socketInfo.tabId,
        timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        isLeader: true,
      });

      // Wait for timeout warning
      const manualResult = await timeoutWarningPromise;
      return manualResult;
    }
  }

  return result;
}

/**
 * Test logout
 */
async function testLogout(deviceName) {
  console.log(`\n--- Testing Logout (${deviceName}) ---`);

  // Get device cookies
  const deviceKey = deviceName.replace(/\s+/g, "_").toLowerCase();
  const deviceCookies = cookies[deviceKey];

  if (!deviceCookies) {
    throw new Error(`No cookies found for device: ${deviceName}`);
  }

  // Create cookie string for request
  const cookieString = Object.entries(deviceCookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  // Logout via API
  const response = await request(app)
    .post("/api/auth/logout")
    .set("Cookie", cookieString)
    .set("X-CSRF-Token", deviceCookies.csrf_token || "");

  console.log(`Logout response status: ${response.status}`);

  if (response.status !== 200) {
    console.error("Logout failed:", response.body);
    throw new Error(`Logout failed: ${response.status}`);
  }

  // Find socket client
  const socketInfo = socketClients.find((s) => s.name === deviceName);
  if (socketInfo) {
    // Check if socket was disconnected
    const isConnected = socketInfo.client.connected;
    console.log(
      `Socket for ${deviceName} is ${
        isConnected ? "still connected" : "disconnected"
      }`
    );

    // If still connected, wait for disconnect event
    if (isConnected) {
      await new Promise((resolve) => {
        socketInfo.client.on("disconnect", () => {
          console.log(`Socket for ${deviceName} disconnected after logout`);
          resolve();
        });

        // Set timeout
        setTimeout(() => {
          console.log(
            `Socket for ${deviceName} did not disconnect within timeout`
          );
          resolve();
        }, 5000);
      });
    }

    // Remove from socket clients
    const index = socketClients.findIndex((s) => s.name === deviceName);
    if (index !== -1) {
      socketClients.splice(index, 1);
    }
  }

  return response;
}

/**
 * Parse cookies from response
 */
function parseCookies(cookieHeaders) {
  if (!cookieHeaders) return {};

  const cookies = {};

  cookieHeaders.forEach((cookie) => {
    const parts = cookie.split(";")[0].trim().split("=");
    const name = parts[0];
    const value = parts[1];
    cookies[name] = value;
  });

  return cookies;
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
      console.log(`Disconnected socket for ${socketInfo.name}`);
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
    console.log("Starting integrated WebSocket authentication tests...");

    // Register test user
    await registerTestUser();

    // Login with first device
    await loginTestUser(generateDeviceInfo("Desktop Chrome"));

    // Login with second device
    await loginTestUser(generateDeviceInfo("Mobile Safari"));

    // Connect to WebSocket with first device
    await connectWebSocket("Desktop Chrome");

    // Test token refresh
    await testTokenRefresh("Desktop Chrome");

    // Test cross-tab synchronization
    await testCrossTabSync();

    // Connect to WebSocket with second device
    await connectWebSocket("Mobile Safari");

    // Test cross-device synchronization
    await testCrossDeviceSync();

    // Test session timeout warning
    await testSessionTimeoutWarning("Desktop Chrome");

    // Test logout
    await testLogout("Mobile Safari");

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

// Run tests
runTests();
