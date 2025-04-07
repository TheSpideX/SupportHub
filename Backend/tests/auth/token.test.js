/**
 * Token Management Tests
 *
 * Tests for token generation, verification, refresh, and blacklisting
 */

const mongoose = require("mongoose");
const User = require("../../src/modules/auth/models/user.model");
const tokenService = require("../../src/modules/auth/services/token.service");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Test user credentials
const TEST_EMAIL = `test.${Date.now()}@example.com`;
const TEST_PASSWORD = "Test123!";

// Store test data
let testUser = null;
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
 * Test token generation
 */
async function testTokenGeneration() {
  try {
    console.log("\n--- Testing Token Generation ---");

    // Generate tokens
    const sessionId = crypto.randomBytes(16).toString("hex");
    const deviceId = crypto.randomBytes(16).toString("hex");

    const tokenPair = await tokenService.generateAuthTokens(testUser, {
      sessionId,
      deviceId,
      ipAddress: "127.0.0.1",
      userAgent: "Test Browser",
    });

    console.log("Token generation successful:", !!tokenPair);
    console.log("Access token received:", !!tokenPair.accessToken);
    console.log("Refresh token received:", !!tokenPair.refreshToken);

    // Store tokens for later tests
    accessToken = tokenPair.accessToken;
    refreshToken = tokenPair.refreshToken;

    return tokenPair;
  } catch (error) {
    console.error("Token generation test failed:", error);
    throw error;
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

    return { decodedAccess, decodedRefresh };
  } catch (error) {
    console.error("Token verification test failed:", error);
    throw error;
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

    return refreshResult;
  } catch (error) {
    console.error("Token refresh test failed:", error);
    throw error;
  }
}

/**
 * Test token blacklisting
 */
async function testTokenBlacklisting() {
  try {
    console.log("\n--- Testing Token Blacklisting ---");

    // Blacklist the access token
    await tokenService.blacklistToken(accessToken, "access");
    console.log("Access token blacklisted");

    // Wait a bit to ensure blacklisting is complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Try to verify the blacklisted token
    try {
      await tokenService.verifyAccessToken(accessToken);
      console.log("ERROR: Blacklisted access token is still valid!");
      return false;
    } catch (error) {
      console.log(
        "Success: Blacklisted access token is properly invalidated:",
        error.message
      );
    }

    // Blacklist the refresh token
    await tokenService.blacklistToken(refreshToken, "refresh");
    console.log("Refresh token blacklisted");

    // Wait a bit to ensure blacklisting is complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Try to verify the blacklisted token
    try {
      await tokenService.verifyRefreshToken(refreshToken);
      console.log("ERROR: Blacklisted refresh token is still valid!");
      return false;
    } catch (error) {
      console.log(
        "Success: Blacklisted refresh token is properly invalidated:",
        error.message
      );
    }

    return true;
  } catch (error) {
    console.error("Token blacklisting test failed:", error);
    return false;
  }
}

/**
 * Test token rotation
 */
async function testTokenRotation() {
  try {
    console.log("\n--- Testing Token Rotation ---");

    // Generate new tokens
    const sessionId = crypto.randomBytes(16).toString("hex");
    const deviceId = crypto.randomBytes(16).toString("hex");

    const tokenPair = await tokenService.generateAuthTokens(testUser, {
      sessionId,
      deviceId,
      ipAddress: "127.0.0.1",
      userAgent: "Test Browser",
    });

    // Store tokens
    accessToken = tokenPair.accessToken;
    refreshToken = tokenPair.refreshToken;

    // Rotate refresh token
    const rotationResult = await tokenService.rotateRefreshToken(
      refreshToken,
      testUser
    );

    console.log("Token rotation successful:", !!rotationResult);
    console.log("New access token received:", !!rotationResult.accessToken);
    console.log("New refresh token received:", !!rotationResult.refreshToken);

    // Verify old refresh token is invalidated
    try {
      // Wait a bit to ensure blacklisting is complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      await tokenService.verifyRefreshToken(refreshToken);
      console.log("ERROR: Old refresh token is still valid after rotation!");
      return false;
    } catch (error) {
      console.log(
        "Success: Old refresh token is properly invalidated after rotation:",
        error.message
      );
    }

    // Update tokens
    accessToken = rotationResult.accessToken;
    refreshToken = rotationResult.refreshToken;

    // Verify new tokens are valid
    const decodedAccess = await tokenService.verifyAccessToken(accessToken);
    const decodedRefresh = await tokenService.verifyRefreshToken(refreshToken);

    console.log("New access token is valid:", !!decodedAccess);
    console.log("New refresh token is valid:", !!decodedRefresh);

    return true;
  } catch (error) {
    console.error("Token rotation test failed:", error);
    return false;
  }
}

/**
 * Clean up test data
 */
async function cleanUp() {
  try {
    console.log("\n--- Cleaning Up Test Data ---");

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
    console.log("Starting token management tests...");

    // Create test user
    await createTestUser();

    // Run tests
    const results = {
      tokenGeneration: await testTokenGeneration()
        .then(() => true)
        .catch(() => false),
      tokenVerification: await testTokenVerification()
        .then(() => true)
        .catch(() => false),
      tokenRefresh: await testTokenRefresh()
        .then(() => true)
        .catch(() => false),
      tokenBlacklisting: await testTokenBlacklisting(),
      tokenRotation: await testTokenRotation(),
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
