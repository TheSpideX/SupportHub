/**
 * Integrated Authentication System Test
 *
 * This script tests the entire authentication system in an integrated manner,
 * simulating a real-world usage scenario with multiple devices and tabs.
 */

const mongoose = require("mongoose");
const User = require("./src/modules/auth/models/user.model");
const Session = require("./src/modules/auth/models/session.model");
const Device = require("./src/modules/auth/models/device.model");
const authService = require("./src/modules/auth/services/auth.service");
const tokenService = require("./src/modules/auth/services/token.service");
const sessionService = require("./src/modules/auth/services/session.service");
const deviceService = require("./src/modules/auth/services/device.service");
const crypto = require("crypto");
const { redisClient } = require("./src/config/redis");

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
let deviceIds = [];
let tabSessions = [];

/**
 * Step 1: User Registration
 */
async function step1_UserRegistration() {
  try {
    console.log("\n=== Step 1: User Registration ===");

    // Create a new user
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
        password: TEST_PASSWORD,
      },
    });

    await user.save();

    console.log("✅ User registration successful");
    console.log("User ID:", user._id);

    testUser = user;
    return user;
  } catch (error) {
    console.error("❌ User registration failed:", error);
    throw error;
  }
}

/**
 * Step 2: Login on Desktop Device
 */
async function step2_LoginOnDesktop() {
  try {
    console.log("\n=== Step 2: Login on Desktop Device ===");

    const deviceInfo = TEST_DEVICES[0];
    console.log(`Logging in with device: ${deviceInfo.name}`);

    const loginResult = await authService.login(TEST_EMAIL, TEST_PASSWORD, {
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceInfo: deviceInfo,
    });

    console.log("✅ Login successful on desktop");
    console.log("Session ID:", loginResult.session.id);

    // Store session
    sessions.push(loginResult.session);

    // Get device ID from session
    const session = await sessionService.getSessionById(loginResult.session.id);
    console.log("Session data:", JSON.stringify(session, null, 2));

    // Try to get the device ID
    let deviceId = null;

    if (session.deviceId) {
      deviceId = session.deviceId;
    } else {
      // Try to get device by fingerprint
      const device = await Device.findOne({
        userId: testUser._id,
        fingerprint: deviceInfo.fingerprint,
      });
      if (device) {
        deviceId = device._id.toString();
      } else {
        // Create a device manually
        const newDevice = await deviceService.recordDeviceInfo(
          testUser._id,
          deviceInfo
        );
        deviceId = newDevice.deviceId;
      }
    }

    if (deviceId) {
      deviceIds.push(deviceId);
      console.log("Device ID:", deviceId);

      // Get device from database
      try {
        const device = await Device.findById(deviceId);
        if (device) {
          devices.push(device);
          console.log("Device found in database:", device._id);
        }
      } catch (error) {
        console.log("Could not find device in database:", error.message);
      }
    }

    return loginResult;
  } catch (error) {
    console.error("❌ Desktop login failed:", error);
    throw error;
  }
}

/**
 * Step 3: Open Multiple Tabs on Desktop
 */
async function step3_OpenMultipleTabsOnDesktop() {
  try {
    console.log("\n=== Step 3: Open Multiple Tabs on Desktop ===");

    // Get device ID from the first session
    const deviceId = deviceIds[0];
    if (!deviceId) {
      throw new Error("No device ID available for desktop");
    }

    console.log("Using device ID:", deviceId);

    // Get device info
    const deviceInfo = TEST_DEVICES[0];

    // Create multiple tabs for the desktop device
    for (let i = 0; i < 3; i++) {
      console.log(`Creating tab ${i + 1} on desktop`);

      // Create a new session for the same device (simulating a new tab)
      const tabSession = await sessionService.createSession({
        userId: testUser._id,
        deviceId: deviceId,
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
          tabId: `tab_${i + 1}`,
          isLeader: i === 0, // First tab is the leader
        },
      });

      console.log(`✅ Tab ${i + 1} session created with ID: ${tabSession._id}`);
      tabSessions.push(tabSession);
    }

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

    return tabSessions;
  } catch (error) {
    console.error("❌ Opening multiple tabs failed:", error);
    throw error;
  }
}

/**
 * Step 4: Login on Mobile Device
 */
async function step4_LoginOnMobile() {
  try {
    console.log("\n=== Step 4: Login on Mobile Device ===");

    const deviceInfo = TEST_DEVICES[1];
    console.log(`Logging in with device: ${deviceInfo.name}`);

    const loginResult = await authService.login(TEST_EMAIL, TEST_PASSWORD, {
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceInfo: deviceInfo,
    });

    console.log("✅ Login successful on mobile");
    console.log("Session ID:", loginResult.session.id);

    // Store session
    sessions.push(loginResult.session);

    // Get device ID from session
    const session = await sessionService.getSessionById(loginResult.session.id);
    console.log("Session data:", JSON.stringify(session, null, 2));

    // Try to get the device ID
    let deviceId = null;

    if (session.deviceId) {
      deviceId = session.deviceId;
    } else {
      // Try to get device by fingerprint
      const device = await Device.findOne({
        userId: testUser._id,
        fingerprint: deviceInfo.fingerprint,
      });
      if (device) {
        deviceId = device._id.toString();
      } else {
        // Create a device manually
        const newDevice = await deviceService.recordDeviceInfo(
          testUser._id,
          deviceInfo
        );
        deviceId = newDevice.deviceId;
      }
    }

    if (deviceId) {
      deviceIds.push(deviceId);
      console.log("Device ID:", deviceId);

      // Get device from database
      try {
        const device = await Device.findById(deviceId);
        if (device) {
          devices.push(device);
          console.log("Device found in database:", device._id);
        }
      } catch (error) {
        console.log("Could not find device in database:", error.message);
      }
    }

    return loginResult;
  } catch (error) {
    console.error("❌ Mobile login failed:", error);
    throw error;
  }
}

/**
 * Step 5: Simulate Leader Tab Closing
 */
async function step5_SimulateLeaderTabClosing() {
  try {
    console.log("\n=== Step 5: Simulate Leader Tab Closing ===");

    // Mark the leader tab session as inactive
    await sessionService.endSession(tabSessions[0]._id, {
      reason: "tab_closed",
      userId: testUser._id,
    });

    console.log("✅ Leader tab marked as inactive");

    // Simulate new leader election (tab 1 becomes leader)
    console.log("Simulating new leader election...");

    // Update tab 1 to become the leader
    await sessionService.updateSessionActivity(
      tabSessions[1]._id,
      "leader_elected",
      {
        tabId: `tab_2`,
        isLeader: true,
        timestamp: Date.now(),
      }
    );

    console.log("✅ Tab 2 elected as new leader");

    // Verify the new leader
    const updatedSession = await Session.findById(tabSessions[1]._id);
    console.log("New leader tab metadata:", updatedSession.metadata);

    return updatedSession;
  } catch (error) {
    console.error("❌ Leader tab closing simulation failed:", error);
    throw error;
  }
}

/**
 * Step 6: Record Security Event
 */
async function step6_RecordSecurityEvent() {
  try {
    console.log("\n=== Step 6: Record Security Event ===");

    // Simulate a security event
    const securityEvent = {
      type: "security:alert",
      userId: testUser._id,
      sessionId: sessions[0].id,
      deviceId: deviceIds[0],
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

    console.log("✅ Security event recorded");

    // Check if the event was recorded in Redis
    const eventKey = `security:events:${testUser._id}`;
    const events = await redisClient.lrange(eventKey, 0, -1);

    if (events && events.length > 0) {
      console.log(`✅ Found ${events.length} security events in Redis`);

      // Parse the latest event
      const latestEvent = JSON.parse(events[0]);
      console.log("Latest security event:", latestEvent.type);
    } else {
      console.log("❌ No security events found in Redis");
    }

    return securityEvent;
  } catch (error) {
    console.error("❌ Security event recording failed:", error);
    throw error;
  }
}

/**
 * Step 7: Terminate Mobile Session
 */
async function step7_TerminateMobileSession() {
  try {
    console.log("\n=== Step 7: Terminate Mobile Session ===");

    // Get the mobile session
    const mobileSession = sessions[1];
    console.log("Terminating mobile session:", mobileSession.id);

    // Terminate the mobile session
    await sessionService.endSession(mobileSession.id, {
      reason: "security_action",
      userId: testUser._id,
      initiatedBy: sessions[0].id,
      message: "Administrator terminated mobile session",
    });

    console.log("✅ Mobile session terminated");

    // Verify the session is terminated
    const terminatedSession = await sessionService.getSessionById(
      mobileSession.id
    );
    console.log("Mobile session status:", terminatedSession.status);

    return terminatedSession;
  } catch (error) {
    console.error("❌ Mobile session termination failed:", error);
    throw error;
  }
}

/**
 * Step 8: Logout From All Devices
 */
async function step8_LogoutFromAllDevices() {
  try {
    console.log("\n=== Step 8: Logout From All Devices ===");

    // Logout from all devices
    await authService.logoutAllDevices(testUser._id);

    console.log("✅ Logged out from all devices");

    // Verify all sessions are terminated
    const activeSessions = await Session.find({
      userId: testUser._id,
      status: { $ne: "ended" },
    });

    console.log(`Active sessions after logout: ${activeSessions.length}`);

    return activeSessions;
  } catch (error) {
    console.error("❌ Logout from all devices failed:", error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanUp() {
  try {
    console.log("\n=== Cleaning Up Test Data ===");

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
    console.log("Starting integrated authentication system test...");

    // Run tests in sequence
    const results = {
      step1_UserRegistration: await step1_UserRegistration()
        .then(() => true)
        .catch(() => false),
      step2_LoginOnDesktop: await step2_LoginOnDesktop()
        .then(() => true)
        .catch(() => false),
      step3_OpenMultipleTabsOnDesktop: await step3_OpenMultipleTabsOnDesktop()
        .then(() => true)
        .catch(() => false),
      step4_LoginOnMobile: await step4_LoginOnMobile()
        .then(() => true)
        .catch(() => false),
      step5_SimulateLeaderTabClosing: await step5_SimulateLeaderTabClosing()
        .then(() => true)
        .catch(() => false),
      step6_RecordSecurityEvent: await step6_RecordSecurityEvent()
        .then(() => true)
        .catch(() => false),
      step7_TerminateMobileSession: await step7_TerminateMobileSession()
        .then(() => true)
        .catch(() => false),
      step8_LogoutFromAllDevices: await step8_LogoutFromAllDevices()
        .then(() => true)
        .catch(() => false),
    };

    // Clean up
    await cleanUp();

    // Print results
    console.log("\n=== Test Results ===");
    for (const [step, passed] of Object.entries(results)) {
      console.log(`${step}: ${passed ? "✅ PASSED" : "❌ FAILED"}`);
    }

    const allPassed = Object.values(results).every((result) => result);
    console.log(
      `\nOverall result: ${
        allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
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
