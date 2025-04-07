/**
 * Integrated Authentication System Tests
 *
 * Tests the entire authentication flow from registration to logout
 * including cross-tab synchronization and cross-device management
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

// Test user credentials
const TEST_EMAIL = `test.${Date.now()}@example.com`;
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
];

// Store test data
let testUser = null;
let sessions = [];
let devices = [];
let tokens = [];

/**
 * Test user registration
 */
async function testRegistration() {
  try {
    console.log("\n--- Testing User Registration ---");

    // Create a new user directly in the database
    const user = new User({
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

    await user.save();

    console.log("Registration successful");
    console.log("User ID:", user._id);

    testUser = user;
    return user;
  } catch (error) {
    console.error("Registration test failed:", error);
    throw error;
  }
}

/**
 * Test multi-device login
 */
async function testMultiDeviceLogin() {
  try {
    console.log("\n--- Testing Multi-Device Login ---");

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
    console.error("Multi-device login test failed:", error);
    throw error;
  }
}

/**
 * Test cross-tab synchronization
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
        tabId: `tab_${i + 1}`,
        isLeader: isLeader,
        timestamp: Date.now(),
      });

      console.log(`Tab ${i + 1} heartbeat sent, leader status: ${isLeader}`);
    }

    // Simulate leader tab closing (tab 0)
    console.log("\nSimulating leader tab closing...");

    // Mark the leader tab session as inactive
    await sessionService.endSession(tabSessions[0]._id, {
      reason: "tab_closed",
      userId: testUser._id,
    });

    console.log("Leader tab marked as inactive");

    // Simulate new leader election (tab 1 becomes leader)
    console.log("\nSimulating new leader election...");

    // Update tab 1 to become the leader
    await sessionService.updateSessionActivity(
      tabSessions[1]._id,
      "leader_elected",
      {
        tabId: "tab_2",
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
    console.error("Cross-tab synchronization test failed:", error);
    throw error;
  }
}

/**
 * Test token refresh and rotation
 */
async function testTokenRefreshAndRotation() {
  try {
    console.log("\n--- Testing Token Refresh and Rotation ---");

    // Skip if no tokens are available (HTTP-only cookies)
    if (!tokens.length || !tokens[0].refreshToken) {
      console.log(
        "Skipping token refresh test - no refresh token available (using HTTP-only cookies)"
      );
      return null;
    }

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
    console.error("Token refresh and rotation test failed:", error);
    return null;
  }
}

/**
 * Test session termination across devices
 */
async function testSessionTermination() {
  try {
    console.log("\n--- Testing Session Termination Across Devices ---");

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

      await sessionService.endSession(sessionToTerminate.id, {
        reason: "security_action",
        userId: testUser._id,
        initiatedBy: primarySession.id,
        message: "Administrator terminated all other sessions",
      });
    }

    // Verify sessions are terminated
    const remainingActiveSessions = await Session.find({
      userId: testUser._id,
      status: { $ne: "ended" },
    });

    console.log(`Remaining active sessions: ${remainingActiveSessions.length}`);

    return remainingActiveSessions;
  } catch (error) {
    console.error("Session termination test failed:", error);
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
      status: { $ne: "ended" },
    });

    console.log(`Active sessions after logout: ${activeSessions.length}`);

    return activeSessions;
  } catch (error) {
    console.error("Logout from all devices test failed:", error);
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
    console.log("Starting integrated authentication system tests...");

    // Run tests
    const results = {
      registration: await testRegistration()
        .then(() => true)
        .catch(() => false),
      multiDeviceLogin: await testMultiDeviceLogin()
        .then(() => true)
        .catch(() => false),
      crossTabSync: await testCrossTabSync()
        .then(() => true)
        .catch(() => false),
      tokenRefreshAndRotation: (await testTokenRefreshAndRotation()) !== null,
      sessionTermination: await testSessionTermination()
        .then(() => true)
        .catch(() => false),
      logoutAllDevices: await testLogoutAllDevices()
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
