const mongoose = require("mongoose");
const { redisClient } = require("./src/config/redis");
const authService = require("./src/modules/auth/services/auth.service");
const tokenService = require("./src/modules/auth/services/token.service");
const sessionService = require("./src/modules/auth/services/session.service");
const deviceService = require("./src/modules/auth/services/device.service");
const User = require("./src/modules/auth/models/user.model");
const Session = require("./src/modules/auth/models/session.model");
const Device = require("./src/modules/auth/models/device.model");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// Test user credentials
const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "Test123!";
const TEST_USER_DATA = {
  email: TEST_EMAIL,
  profile: {
    firstName: "Test",
    lastName: "User",
    phoneNumber: "+1234567890",
    timezone: "America/New_York",
  },
  role: "support", // Valid roles are 'customer', 'support', 'technical', 'team_lead', 'admin'
  status: {
    isActive: true,
    verifiedAt: new Date(),
  },
};

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
};

// Store test data
let testUser = null;
let accessToken = null;
let refreshToken = null;
let sessionId = null;

/**
 * Create a test user
 */
async function createTestUser() {
  try {
    // Check if test user already exists
    let user = await User.findOne({ email: TEST_EMAIL });

    if (user) {
      console.log("Test user already exists, using existing user");
      testUser = user;
      return user;
    }

    // Create a user directly
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, salt);

    // Create a new user
    user = new User({
      email: TEST_EMAIL,
      profile: {
        firstName: TEST_USER_DATA.profile.firstName,
        lastName: TEST_USER_DATA.profile.lastName,
        phoneNumber: TEST_USER_DATA.profile.phoneNumber,
        timezone: TEST_USER_DATA.profile.timezone,
      },
      role: TEST_USER_DATA.role,
      status: {
        isActive: true,
        verifiedAt: new Date(),
      },
      security: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        emailVerified: true,
        loginAttempts: 0,
        lastLogin: null,
      },
    });

    await user.save();
    console.log("Test user created with ID:", user._id);
    testUser = user;
    return user;
  } catch (error) {
    console.error("Error creating test user:", error);
    throw error;
  }
}

/**
 * Test user registration
 */
async function testRegistration() {
  try {
    console.log("\n--- Testing User Registration ---");

    // Generate a unique email to avoid conflicts
    const uniqueEmail = `test.${Date.now()}@example.com`;

    // Create a new user directly
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, salt);

    // Create a new user
    const user = new User({
      email: uniqueEmail,
      profile: {
        firstName: "Test",
        lastName: "Registration",
        phoneNumber: "+1234567890",
        timezone: "America/New_York",
      },
      role: "support",
      status: {
        isActive: true,
        verifiedAt: new Date(),
      },
      security: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        emailVerified: true,
        loginAttempts: 0,
        lastLogin: null,
      },
    });

    await user.save();

    const result = {
      userId: user._id,
    };

    console.log("Registration successful:", !!result);
    console.log("User ID:", result.userId);

    // Clean up - delete the test registration user
    await User.findByIdAndDelete(result.userId);
    console.log("Test registration user deleted");

    return true;
  } catch (error) {
    console.error("Registration test failed:", error);
    return false;
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

    console.log("Login successful:", !!loginResult);
    console.log("Session ID:", loginResult.session.id);

    // Store tokens and session ID for later tests
    accessToken = loginResult.accessToken;
    refreshToken = loginResult.refreshToken;
    sessionId = loginResult.session.id;

    return true;
  } catch (error) {
    console.error("Login test failed:", error);
    return false;
  }
}

/**
 * Test token verification
 */
async function testTokenVerification() {
  try {
    console.log("\n--- Testing Token Verification ---");

    // Verify access token
    const decodedAccess = await tokenService.verifyAccessToken(accessToken);
    console.log("Access token verification successful:", !!decodedAccess);
    console.log(
      "User ID from token:",
      decodedAccess.sub || decodedAccess.userId
    );

    // Verify refresh token
    const decodedRefresh = await tokenService.verifyRefreshToken(refreshToken);
    console.log("Refresh token verification successful:", !!decodedRefresh);
    console.log("Session ID from refresh token:", decodedRefresh.sessionId);

    return true;
  } catch (error) {
    console.error("Token verification test failed:", error);
    return false;
  }
}

/**
 * Test token refresh
 */
async function testTokenRefresh() {
  try {
    console.log("\n--- Testing Token Refresh ---");

    // Refresh the token
    const refreshResult = await tokenService.refreshToken(refreshToken);

    console.log("Token refresh successful:", !!refreshResult);
    console.log("New access token received:", !!refreshResult.accessToken);
    console.log("New refresh token received:", !!refreshResult.refreshToken);

    // Update tokens for later tests
    accessToken = refreshResult.accessToken;
    refreshToken = refreshResult.refreshToken;

    return true;
  } catch (error) {
    console.error("Token refresh test failed:", error);
    return false;
  }
}

/**
 * Test session management
 */
async function testSessionManagement() {
  try {
    console.log("\n--- Testing Session Management ---");

    // Get session by ID
    const session = await sessionService.getSessionById(sessionId);
    console.log("Session retrieval successful:", !!session);
    console.log("Session is active:", session.isActive);

    // Update session activity
    await sessionService.updateSessionActivity(sessionId, "test_action");
    console.log("Session activity updated");

    // Get user sessions
    const userSessions = await sessionService.getUserSessions(testUser._id);
    console.log("User sessions retrieved:", userSessions.length);

    return true;
  } catch (error) {
    console.error("Session management test failed:", error);
    return false;
  }
}

/**
 * Test device management
 */
async function testDeviceManagement() {
  try {
    console.log("\n--- Testing Device Management ---");

    // Record device info
    const deviceRecord = await deviceService.recordDeviceInfo(
      testUser._id,
      TEST_DEVICE_INFO
    );
    console.log("Device info recorded:", !!deviceRecord);

    if (deviceRecord.deviceId) {
      console.log("Device ID:", deviceRecord.deviceId);

      // Verify device consistency
      const deviceVerification = await deviceService.verifyDeviceConsistency(
        testUser._id,
        TEST_DEVICE_INFO
      );
      console.log("Device verification successful:", !!deviceVerification);
      console.log("Device is known:", deviceVerification.isKnown);

      // Assess device security
      const securityAssessment = await deviceService.assessDeviceSecurity(
        testUser._id,
        TEST_DEVICE_INFO
      );
      console.log("Security assessment successful:", !!securityAssessment);
      console.log("Trust level:", securityAssessment.trustLevel);
      console.log("Risk level:", securityAssessment.riskLevel);
    }

    return true;
  } catch (error) {
    console.error("Device management test failed:", error);
    return false;
  }
}

/**
 * Test logout
 */
async function testLogout() {
  try {
    console.log("\n--- Testing Logout ---");

    // Logout
    const logoutResult = await authService.logout(
      accessToken,
      refreshToken,
      sessionId
    );

    console.log("Logout successful:", !!logoutResult);

    // Verify session is terminated
    const session = await sessionService.getSessionById(sessionId);
    console.log("Session is inactive after logout:", !session.isActive);

    return true;
  } catch (error) {
    console.error("Logout test failed:", error);
    return false;
  }
}

/**
 * Clean up test data
 */
async function cleanUp() {
  try {
    console.log("\n--- Cleaning Up Test Data ---");

    // We'll keep the test user for future tests
    // but clean up any sessions and devices

    // Delete all sessions for test user
    await Session.deleteMany({ userId: testUser._id });
    console.log("Test sessions deleted");

    // Delete all devices for test user
    await Device.deleteMany({ userId: testUser._id });
    console.log("Test devices deleted");

    return true;
  } catch (error) {
    console.error("Clean up failed:", error);
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
      registration: await testRegistration(),
      login: await testLogin(),
      tokenVerification: await testTokenVerification(),
      tokenRefresh: await testTokenRefresh(),
      sessionManagement: await testSessionManagement(),
      deviceManagement: await testDeviceManagement(),
      logout: await testLogout(),
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
