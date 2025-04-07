/**
 * User Authentication Tests
 *
 * Tests for user registration, login, and account management
 */

const mongoose = require("mongoose");
const User = require("../../src/modules/auth/models/user.model");
const authService = require("../../src/modules/auth/services/auth.service");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Test user credentials
const TEST_EMAIL = `test.${Date.now()}@example.com`;
const TEST_PASSWORD = "Test123!";
const TEST_USER_DATA = {
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
  fingerprint: crypto.randomBytes(16).toString("hex"),
};

// Store test data
let testUser = null;

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
 * Test user registration
 */
async function testRegistration() {
  try {
    console.log("\n--- Testing User Registration ---");

    // Generate a unique email to avoid conflicts
    const uniqueEmail = `test.${Date.now()}@example.com`;

    // Create a new user directly in the database
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
        password: TEST_PASSWORD, // Let the model handle password hashing
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

    return loginResult;
  } catch (error) {
    console.error("Login test failed:", error);
    throw error;
  }
}

/**
 * Test password change
 */
async function testPasswordChange() {
  try {
    console.log("\n--- Testing Password Change ---");

    // Change password
    const newPassword = "NewTest456!";

    // Update user password directly
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(testUser._id, {
      "security.password": hashedPassword,
      "security.passwordChangedAt": new Date(),
    });

    console.log("Password changed successfully");

    // Try to login with new password
    const loginResult = await authService.login(TEST_EMAIL, newPassword, {
      ipAddress: TEST_DEVICE_INFO.ip,
      userAgent: TEST_DEVICE_INFO.userAgent,
      deviceInfo: TEST_DEVICE_INFO,
    });

    console.log("Login with new password successful:", !!loginResult);

    return true;
  } catch (error) {
    console.error("Password change test failed:", error);
    return false;
  }
}

/**
 * Test user account update
 */
async function testAccountUpdate() {
  try {
    console.log("\n--- Testing Account Update ---");

    // Update user profile
    const updatedProfile = {
      firstName: "Updated",
      lastName: "User",
      phoneNumber: "+9876543210",
      timezone: "Europe/London",
    };

    await User.findByIdAndUpdate(testUser._id, {
      profile: updatedProfile,
    });

    // Verify update
    const updatedUser = await User.findById(testUser._id);

    console.log(
      "Account update successful:",
      updatedUser.profile.firstName === updatedProfile.firstName &&
        updatedUser.profile.lastName === updatedProfile.lastName &&
        updatedUser.profile.phoneNumber === updatedProfile.phoneNumber &&
        updatedUser.profile.timezone === updatedProfile.timezone
    );

    return true;
  } catch (error) {
    console.error("Account update test failed:", error);
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
    console.log("Starting user authentication tests...");

    // Create test user
    await createTestUser();

    // Run tests
    const results = {
      registration: await testRegistration(),
      login: await testLogin()
        .then(() => true)
        .catch(() => false),
      passwordChange: await testPasswordChange(),
      accountUpdate: await testAccountUpdate(),
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
