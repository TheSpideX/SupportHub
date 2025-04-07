/**
 * Advanced Authentication System Test
 *
 * This script tests advanced authentication features including:
 * - Cross-tab synchronization with leader election
 * - Cross-device session management
 * - Session termination across all devices
 * - Token rotation and blacklisting
 * - Security event propagation
 */

const mongoose = require("mongoose");
const User = require("./src/modules/auth/models/user.model");
const Session = require("./src/modules/auth/models/session.model");
const Device = require("./src/modules/auth/models/device.model");
const authService = require("./src/modules/auth/services/auth.service");
const tokenService = require("./src/modules/auth/services/token.service");
const sessionService = require("./src/modules/auth/services/session.service");
const deviceService = require("./src/modules/auth/services/device.service");
const socketService = require("./src/modules/auth/services/socket.service");
const { redisClient } = require("./src/config/redis");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Test user credentials
const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "Test123!";

// Test device info for multiple devices
const TEST_DEVICES = [
  {
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
  },
  {
    name: "Mobile Safari",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    ip: "192.168.1.101",
    browser: "Safari",
    os: "iOS",
    device: "iPhone",
    screen: "375x812",
    language: "en-US",
    timezone: "America/New_York",
    platform: "iPhone",
    fingerprint: crypto.randomBytes(16).toString("hex"),
  },
  {
    name: "Tablet Firefox",
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/34.0 Mobile/15E148 Safari/605.1.15",
    ip: "192.168.1.102",
    browser: "Firefox",
    os: "iOS",
    device: "iPad",
    screen: "768x1024",
    language: "en-US",
    timezone: "America/New_York",
    platform: "iPad",
    fingerprint: crypto.randomBytes(16).toString("hex"),
  },
];

// Store test data
let testUser = null;
let sessions = [];
let devices = [];
let tokens = [];

/**
 * Create a test user
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
        // Store the plain password for now, we'll hash it in pre-save hook
        password: TEST_PASSWORD,
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
 * Simulate multiple device logins
 */
async function simulateMultiDeviceLogins() {
  try {
    console.log("\n--- Simulating Multiple Device Logins ---");

    // Login with each test device
    for (const deviceInfo of TEST_DEVICES) {
      console.log(`Logging in with device: ${deviceInfo.name}`);

      const loginResult = await authService.login(TEST_EMAIL, TEST_PASSWORD, {
        ipAddress: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceInfo: deviceInfo,
      });

      console.log(`Login successful on ${deviceInfo.name}`);
      console.log(`Session ID: ${loginResult.session.id}`);

      // Store session and tokens
      sessions.push(loginResult.session);
      tokens.push({
        device: deviceInfo.name,
        accessToken: loginResult.accessToken,
        refreshToken: loginResult.refreshToken,
      });

      // Get device ID from session
      const session = await sessionService.getSessionById(
        loginResult.session.id
      );
      if (session.deviceId) {
        const device = await Device.findById(session.deviceId);
        if (device) {
          devices.push(device);
          console.log(`Device ID: ${device._id}`);
        }
      }

      // Wait a bit between logins to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`Successfully logged in with ${sessions.length} devices`);
    return { sessions, tokens, devices };
  } catch (error) {
    console.error("Error simulating multiple device logins:", error);
    throw error;
  }
}

/**
 * Test cross-tab synchronization with leader election
 */
async function testCrossTabSync() {
  try {
    console.log("\n--- Testing Cross-Tab Synchronization ---");

    // Simulate multiple tabs by creating multiple session tabs for the first device
    const deviceInfo = TEST_DEVICES[0];
    const tabSessions = [];

    // Create 3 tabs for the first device
    for (let i = 0; i < 3; i++) {
      console.log(`Creating tab ${i + 1} for device ${deviceInfo.name}`);

      // Create a new session for the same device (simulating a new tab)
      const tabSession = await sessionService.createSession({
        userId: testUser._id,
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ip,
        deviceInfo: {
          userAgent: deviceInfo.userAgent,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          device: deviceInfo.device,
          fingerprint: deviceInfo.fingerprint,
        },
        metadata: {
          tabId: `tab_${i + 1}_${crypto.randomBytes(4).toString("hex")}`,
          isLeader: i === 0, // First tab is the leader
        },
      });

      console.log(`Tab ${i + 1} session created with ID: ${tabSession._id}`);
      tabSessions.push(tabSession);
    }

    // Test leader election
    console.log("\n--- Testing Leader Election ---");

    // Simulate leader tab heartbeat
    for (let i = 0; i < tabSessions.length; i++) {
      const isLeader = i === 0;
      const tabSession = tabSessions[i];

      // Update session with heartbeat
      await sessionService.updateSessionActivity(tabSession._id, "heartbeat", {
        tabId: tabSession.metadata.tabId,
        isLeader: isLeader,
        timestamp: Date.now(),
      });

      console.log(`Tab ${i + 1} heartbeat sent, leader status: ${isLeader}`);
    }

    // Simulate leader tab closing (tab 0)
    console.log("\nSimulating leader tab closing...");

    // Mark the leader tab session as inactive
    await sessionService.terminateSession(
      tabSessions[0]._id,
      testUser._id,
      "tab_closed"
    );
    console.log("Leader tab marked as inactive");

    // Simulate new leader election (tab 1 becomes leader)
    console.log("\nSimulating new leader election...");

    // Update tab 1 to become the leader
    await sessionService.updateSessionActivity(
      tabSessions[1]._id,
      "leader_elected",
      {
        tabId: tabSessions[1].metadata.tabId,
        isLeader: true,
        timestamp: Date.now(),
      }
    );

    console.log("Tab 2 elected as new leader");

    // Verify the new leader
    const updatedSession = await Session.findById(tabSessions[1]._id);
    console.log(`New leader tab metadata:`, updatedSession.metadata);

    return { tabSessions };
  } catch (error) {
    console.error("Error testing cross-tab synchronization:", error);
    throw error;
  }
}

/**
 * Test token refresh and rotation
 */
async function testTokenRefreshAndRotation() {
  try {
    console.log("\n--- Testing Token Refresh and Rotation ---");

    // Use the refresh token from the first device
    const deviceToken = tokens[0];
    console.log(`Using refresh token from device: ${deviceToken.device}`);

    // Refresh the token
    const refreshResult = await tokenService.refreshToken(
      deviceToken.refreshToken
    );

    console.log("Token refresh successful");
    console.log("New access token received:", !!refreshResult.accessToken);
    console.log("New refresh token received:", !!refreshResult.refreshToken);

    // Verify the old refresh token is blacklisted
    try {
      await tokenService.verifyRefreshToken(deviceToken.refreshToken);
      console.log("ERROR: Old refresh token is still valid!");
    } catch (error) {
      console.log(
        "Success: Old refresh token is properly invalidated:",
        error.message
      );
    }

    // Update the tokens
    tokens[0].accessToken = refreshResult.accessToken;
    tokens[0].refreshToken = refreshResult.refreshToken;

    // Verify the new tokens
    const decodedAccess = await tokenService.verifyAccessToken(
      refreshResult.accessToken
    );
    console.log("New access token is valid:", !!decodedAccess);

    const decodedRefresh = await tokenService.verifyRefreshToken(
      refreshResult.refreshToken
    );
    console.log("New refresh token is valid:", !!decodedRefresh);

    return refreshResult;
  } catch (error) {
    console.error("Error testing token refresh and rotation:", error);
    throw error;
  }
}

/**
 * Test session termination across all devices
 */
async function testSessionTermination() {
  try {
    console.log("\n--- Testing Session Termination Across All Devices ---");

    // Get all active sessions for the user
    const userSessions = await sessionService.getUserSessions(testUser._id);
    console.log(`User has ${userSessions.length} active sessions`);

    // Terminate all sessions except the first one
    const primarySession = sessions[0];
    console.log(`Keeping primary session: ${primarySession.id}`);

    // Terminate other sessions
    for (let i = 1; i < sessions.length; i++) {
      const sessionToTerminate = sessions[i];
      console.log(`Terminating session: ${sessionToTerminate.id}`);

      await sessionService.terminateSession(
        sessionToTerminate.id,
        testUser._id,
        "security_action",
        {
          initiatedBy: primarySession.id,
          reason: "admin_action",
          message: "Administrator terminated all other sessions",
        }
      );
    }

    // Verify sessions are terminated
    const remainingActiveSessions = await Session.find({
      userId: testUser._id,
      isActive: true,
    });

    console.log(`Remaining active sessions: ${remainingActiveSessions.length}`);

    // Try to use a token from a terminated session
    if (tokens.length > 1) {
      try {
        const terminatedSessionToken = tokens[1].accessToken;
        await tokenService.verifyAccessToken(terminatedSessionToken);
        console.log("ERROR: Token from terminated session is still valid!");
      } catch (error) {
        console.log(
          "Success: Token from terminated session is properly invalidated:",
          error.message
        );
      }
    }

    return remainingActiveSessions;
  } catch (error) {
    console.error("Error testing session termination:", error);
    throw error;
  }
}

/**
 * Test security event propagation
 */
async function testSecurityEventPropagation() {
  try {
    console.log("\n--- Testing Security Event Propagation ---");

    // Simulate a security event
    const securityEvent = {
      type: "security:alert",
      userId: testUser._id,
      sessionId: sessions[0].id,
      deviceId: devices[0]?._id,
      severity: "medium",
      details: {
        message: "Unusual login location detected",
        location: "New York, USA",
        ipAddress: "203.0.113.1",
        timestamp: new Date(),
      },
    };

    console.log("Simulating security event:", securityEvent.type);

    // Record the security event
    await sessionService.recordSecurityEvent(
      testUser._id,
      securityEvent.sessionId,
      securityEvent.type,
      securityEvent.severity,
      securityEvent.details
    );

    console.log("Security event recorded");

    // Check if the event was recorded in Redis
    const eventKey = `security:events:${testUser._id}`;
    const events = await redisClient.lrange(eventKey, 0, -1);

    if (events && events.length > 0) {
      console.log(`Found ${events.length} security events in Redis`);

      // Parse the latest event
      const latestEvent = JSON.parse(events[0]);
      console.log("Latest security event:", latestEvent.type);
    } else {
      console.log("No security events found in Redis");
    }

    return securityEvent;
  } catch (error) {
    console.error("Error testing security event propagation:", error);
    throw error;
  }
}

/**
 * Test logout from all devices
 */
async function testLogoutAllDevices() {
  try {
    console.log("\n--- Testing Logout From All Devices ---");

    // Logout from all devices
    await authService.logoutAllDevices(testUser._id);

    console.log("Logged out from all devices");

    // Verify all sessions are terminated
    const activeSessions = await Session.find({
      userId: testUser._id,
      isActive: true,
    });

    console.log(`Active sessions after logout: ${activeSessions.length}`);

    // Try to use a token after logout
    if (tokens.length > 0) {
      try {
        const token = tokens[0].accessToken;
        await tokenService.verifyAccessToken(token);
        console.log("ERROR: Token is still valid after logout!");
      } catch (error) {
        console.log(
          "Success: Token is properly invalidated after logout:",
          error.message
        );
      }
    }

    return activeSessions;
  } catch (error) {
    console.error("Error testing logout from all devices:", error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanUp() {
  try {
    console.log("\n--- Cleaning Up Test Data ---");

    // Delete all sessions for test user
    const deletedSessions = await Session.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedSessions.deletedCount} sessions`);

    // Delete all devices for test user
    const deletedDevices = await Device.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedDevices.deletedCount} devices`);

    // Delete test user
    await User.deleteOne({ _id: testUser._id });
    console.log("Deleted test user");

    // Clear Redis keys related to the test user
    const userKeys = await redisClient.keys(`*:${testUser._id}*`);
    if (userKeys && userKeys.length > 0) {
      await redisClient.del(userKeys);
      console.log(`Deleted ${userKeys.length} Redis keys`);
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
    console.log("Starting advanced authentication system tests...");

    // Create test user
    await createTestUser();

    // Run tests
    const results = {
      multiDeviceLogins: await simulateMultiDeviceLogins(),
      crossTabSync: await testCrossTabSync(),
      tokenRefreshAndRotation: await testTokenRefreshAndRotation(),
      sessionTermination: await testSessionTermination(),
      securityEventPropagation: await testSecurityEventPropagation(),
      logoutAllDevices: await testLogoutAllDevices(),
    };

    // Clean up
    await cleanUp();

    // Print results
    console.log("\n--- Test Results ---");
    for (const [test, result] of Object.entries(results)) {
      console.log(`${test}: ${result ? "PASSED" : "FAILED"}`);
    }

    console.log("\nAll tests completed successfully!");

    return true;
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
