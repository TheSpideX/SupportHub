/**
 * Session Management Tests
 *
 * Tests for session creation, retrieval, activity tracking, and termination
 */

const mongoose = require("mongoose");
const User = require("../../src/modules/auth/models/user.model");
const Session = require("../../src/modules/auth/models/session.model");
const sessionService = require("../../src/modules/auth/services/session.service");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Test user credentials
const TEST_EMAIL = `test.${Date.now()}@example.com`;
const TEST_PASSWORD = "Test123!";

// Test device info
const TEST_DEVICE_INFO = {
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
  ip: "127.0.0.1",
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
 * Test session creation
 */
async function testSessionCreation() {
  try {
    console.log("\n--- Testing Session Creation ---");

    // Create a session
    const session = await sessionService.createSession({
      userId: testUser._id,
      userAgent: TEST_DEVICE_INFO.userAgent,
      ipAddress: TEST_DEVICE_INFO.ip,
      deviceInfo: TEST_DEVICE_INFO,
    });

    console.log("Session creation successful:", !!session);
    console.log("Session ID:", session._id);

    // Store session for later tests
    testSession = session;

    return session;
  } catch (error) {
    console.error("Session creation test failed:", error);
    throw error;
  }
}

/**
 * Test session retrieval
 */
async function testSessionRetrieval() {
  try {
    console.log("\n--- Testing Session Retrieval ---");

    // Get session by ID
    const session = await sessionService.getSessionById(testSession._id);

    console.log("Session retrieval successful:", !!session);
    console.log("Session is active:", session.isActive);

    return session;
  } catch (error) {
    console.error("Session retrieval test failed:", error);
    throw error;
  }
}

/**
 * Test session activity tracking
 */
async function testSessionActivityTracking() {
  try {
    console.log("\n--- Testing Session Activity Tracking ---");

    // Update session activity
    await sessionService.updateSessionActivity(testSession._id, "test_action");

    console.log("Session activity updated");

    // Get updated session
    const updatedSession = await sessionService.getSessionById(testSession._id);

    console.log(
      "Last activity updated:",
      updatedSession.lastActivity > testSession.lastActivity
    );

    return updatedSession;
  } catch (error) {
    console.error("Session activity tracking test failed:", error);
    throw error;
  }
}

/**
 * Test user sessions retrieval
 */
async function testUserSessionsRetrieval() {
  try {
    console.log("\n--- Testing User Sessions Retrieval ---");

    // Get user sessions
    const userSessions = await sessionService.getUserSessions(testUser._id);

    console.log("User sessions retrieved:", userSessions.length);
    console.log(
      "Current session found:",
      userSessions.some((s) => s._id.toString() === testSession._id.toString())
    );

    return userSessions;
  } catch (error) {
    console.error("User sessions retrieval test failed:", error);
    throw error;
  }
}

/**
 * Test session termination
 */
async function testSessionTermination() {
  try {
    console.log("\n--- Testing Session Termination ---");

    // End the session
    await sessionService.endSession(testSession._id, {
      reason: "test_termination",
      userId: testUser._id,
    });

    console.log("Session terminated");

    // Get terminated session
    const terminatedSession = await sessionService.getSessionById(
      testSession._id
    );

    console.log("Session is inactive:", terminatedSession.status === "ended");

    return terminatedSession;
  } catch (error) {
    console.error("Session termination test failed:", error);
    throw error;
  }
}

/**
 * Test session cleanup
 */
async function testSessionCleanup() {
  try {
    console.log("\n--- Testing Session Cleanup ---");

    // Create multiple expired sessions
    const expiredSessions = [];

    for (let i = 0; i < 3; i++) {
      const session = new Session({
        userId: testUser._id,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        ipAddress: TEST_DEVICE_INFO.ip,
        deviceInfo: TEST_DEVICE_INFO,
      });

      await session.save();
      expiredSessions.push(session);
    }

    console.log(`Created ${expiredSessions.length} expired sessions`);

    // Run cleanup
    const cleanupResult = await sessionService.cleanupExpiredSessions();

    console.log("Session cleanup completed");
    console.log("Expired sessions cleaned up:", cleanupResult?.count || 0);

    return cleanupResult;
  } catch (error) {
    console.error("Session cleanup test failed:", error);
    return false;
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

    // Delete test user
    if (testUser) {
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
    console.log("Starting session management tests...");

    // Create test user
    await createTestUser();

    // Run tests
    const results = {
      sessionCreation: await testSessionCreation()
        .then(() => true)
        .catch(() => false),
      sessionRetrieval: await testSessionRetrieval()
        .then(() => true)
        .catch(() => false),
      sessionActivityTracking: await testSessionActivityTracking()
        .then(() => true)
        .catch(() => false),
      userSessionsRetrieval: await testUserSessionsRetrieval()
        .then(() => true)
        .catch(() => false),
      sessionTermination: await testSessionTermination()
        .then(() => true)
        .catch(() => false),
      sessionCleanup: await testSessionCleanup(),
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
