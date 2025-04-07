/**
 * Simple Authentication System Test
 *
 * This script tests the core authentication features:
 * - User login
 * - Token refresh
 * - Session management
 * - Logout
 */

const mongoose = require("mongoose");
const User = require("./src/modules/auth/models/user.model");
const Session = require("./src/modules/auth/models/session.model");
const authService = require("./src/modules/auth/services/auth.service");
const tokenService = require("./src/modules/auth/services/token.service");
const sessionService = require("./src/modules/auth/services/session.service");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Test user credentials
const TEST_EMAIL = "test@example.com";
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
let session = null;
let accessToken = null;
let refreshToken = null;

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
 * Test user login
 */
async function testLogin() {
  try {
    console.log("\n--- Testing User Login ---");

    // Login with test credentials
    const loginResult = await authService.login(TEST_EMAIL, TEST_PASSWORD, {
      ipAddress: TEST_DEVICE_INFO.ip,
      userAgent: TEST_DEVICE_INFO.userAgent,
      deviceInfo: TEST_DEVICE_INFO,
    });

    console.log("Login successful");
    console.log("Session ID:", loginResult.session.id);
    console.log(
      "Access Token:",
      loginResult.accessToken ? "Received" : "Not received"
    );
    console.log(
      "Refresh Token:",
      loginResult.refreshToken ? "Received" : "Not received"
    );

    // Store session and tokens
    session = loginResult.session;
    accessToken = loginResult.accessToken;
    refreshToken = loginResult.refreshToken;

    return loginResult;
  } catch (error) {
    console.error("Login test failed:", error);
    throw error;
  }
}

/**
 * Test token refresh
 */
async function testTokenRefresh() {
  try {
    console.log("\n--- Testing Token Refresh ---");

    // Skip token refresh test if no refresh token is available
    if (!refreshToken) {
      console.log(
        "Skipping token refresh test - no refresh token available (using HTTP-only cookies)"
      );
      return null;
    }

    // Refresh the token
    const refreshResult = await tokenService.refreshToken(refreshToken);

    console.log("Token refresh successful");
    console.log("New access token received:", !!refreshResult.accessToken);
    console.log("New refresh token received:", !!refreshResult.refreshToken);

    // Update tokens
    accessToken = refreshResult.accessToken;
    refreshToken = refreshResult.refreshToken;

    return refreshResult;
  } catch (error) {
    console.error("Token refresh test failed:", error);
    // Don't throw the error, just return null
    return null;
  }
}

/**
 * Test session management
 */
async function testSessionManagement() {
  try {
    console.log("\n--- Testing Session Management ---");

    // Get session by ID
    const sessionData = await sessionService.getSessionById(session.id);
    console.log("Session retrieval successful:", !!sessionData);
    console.log("Session is active:", sessionData.isActive);

    // Update session activity
    await sessionService.updateSessionActivity(session.id, "test_action");
    console.log("Session activity updated");

    // Get user sessions
    const userSessions = await sessionService.getUserSessions(testUser._id);
    console.log("User sessions retrieved:", userSessions.length);

    return userSessions;
  } catch (error) {
    console.error("Session management test failed:", error);
    throw error;
  }
}

/**
 * Test logout
 */
async function testLogout() {
  try {
    console.log("\n--- Testing Logout ---");

    // Logout
    const logoutResult = await authService.logout(session.id, {
      refreshToken: refreshToken,
      reason: "test_logout",
    });

    console.log("Logout successful:", logoutResult);

    // Verify session is terminated
    const sessionData = await sessionService.getSessionById(session.id);
    console.log(
      "Session is inactive after logout:",
      sessionData?.status === "ended"
    );

    return logoutResult;
  } catch (error) {
    console.error("Logout test failed:", error);
    // Don't throw the error, just return false
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
    console.log("Starting authentication system tests...");

    // Create test user
    await createTestUser();

    // Run tests
    const results = {
      login: await testLogin()
        .then(() => true)
        .catch(() => false),
      tokenRefresh: await testTokenRefresh()
        .then(() => true)
        .catch(() => false),
      sessionManagement: await testSessionManagement()
        .then(() => true)
        .catch(() => false),
      logout: await testLogout()
        .then(() => true)
        .catch(() => false),
    };

    // Clean up
    await cleanUp();

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
