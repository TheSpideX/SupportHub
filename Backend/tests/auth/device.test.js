/**
 * Device Management Tests
 *
 * Tests for device fingerprinting, verification, and security assessment
 */

const mongoose = require("mongoose");
const User = require("../../src/modules/auth/models/user.model");
const Device = require("../../src/modules/auth/models/device.model");
const deviceService = require("../../src/modules/auth/services/device.service");
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
let testDevice = null;

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
 * Test device fingerprinting
 */
async function testDeviceFingerprinting() {
  try {
    console.log("\n--- Testing Device Fingerprinting ---");

    // Generate fingerprint
    const fingerprint =
      deviceService.generateEnhancedFingerprint(TEST_DEVICE_INFO);

    console.log("Fingerprint generation successful:", !!fingerprint);
    console.log("Fingerprint:", fingerprint);

    // Verify fingerprint is consistent
    const secondFingerprint =
      deviceService.generateEnhancedFingerprint(TEST_DEVICE_INFO);
    console.log(
      "Fingerprint is consistent:",
      fingerprint === secondFingerprint
    );

    // Verify fingerprint changes with different data
    const modifiedDeviceInfo = { ...TEST_DEVICE_INFO, browser: "Firefox" };
    const differentFingerprint =
      deviceService.generateEnhancedFingerprint(modifiedDeviceInfo);
    console.log(
      "Fingerprint changes with different data:",
      fingerprint !== differentFingerprint
    );

    return fingerprint;
  } catch (error) {
    console.error("Device fingerprinting test failed:", error);
    throw error;
  }
}

/**
 * Test device recording
 */
async function testDeviceRecording() {
  try {
    console.log("\n--- Testing Device Recording ---");

    // Record device info
    const deviceRecord = await deviceService.recordDeviceInfo(
      testUser._id,
      TEST_DEVICE_INFO
    );

    console.log("Device recording successful:", !!deviceRecord);
    console.log("Device ID:", deviceRecord.deviceId);

    // Store device for later tests
    try {
      testDevice = await Device.findById(deviceRecord.deviceId);
    } catch (error) {
      // If not a valid ObjectId, try to find by deviceId field
      if (error.name === "CastError" && error.kind === "ObjectId") {
        testDevice = await Device.findOne({ deviceId: deviceRecord.deviceId });
      } else {
        throw error;
      }
    }

    return deviceRecord;
  } catch (error) {
    console.error("Device recording test failed:", error);
    throw error;
  }
}

/**
 * Test device verification
 */
async function testDeviceVerification() {
  try {
    console.log("\n--- Testing Device Verification ---");

    // Verify device consistency
    const verificationResult = await deviceService.verifyDeviceConsistency(
      testUser._id,
      TEST_DEVICE_INFO
    );

    console.log("Device verification successful:", !!verificationResult);
    console.log("Device is known:", verificationResult.isKnown);
    console.log("Device ID:", verificationResult.deviceId);

    return verificationResult;
  } catch (error) {
    console.error("Device verification test failed:", error);
    throw error;
  }
}

/**
 * Test device security assessment
 */
async function testDeviceSecurityAssessment() {
  try {
    console.log("\n--- Testing Device Security Assessment ---");

    // Assess device security
    const securityAssessment = await deviceService.assessDeviceSecurity(
      testUser._id,
      TEST_DEVICE_INFO
    );

    console.log("Security assessment successful:", !!securityAssessment);
    console.log("Trust level:", securityAssessment.trustLevel);
    console.log("Risk level:", securityAssessment.riskLevel);

    return securityAssessment;
  } catch (error) {
    console.error("Device security assessment test failed:", error);
    throw error;
  }
}

/**
 * Test suspicious device detection
 */
async function testSuspiciousDeviceDetection() {
  try {
    console.log("\n--- Testing Suspicious Device Detection ---");

    // Create suspicious device info
    const suspiciousDeviceInfo = {
      ...TEST_DEVICE_INFO,
      ip: "203.0.113.1", // Different IP
      timezone: "Asia/Tokyo", // Different timezone
      fingerprint: crypto.randomBytes(16).toString("hex"), // Different fingerprint
    };

    // Assess suspicious device
    const suspiciousAssessment = await deviceService.assessDeviceSecurity(
      testUser._id,
      suspiciousDeviceInfo
    );

    console.log(
      "Suspicious device assessment successful:",
      !!suspiciousAssessment
    );
    console.log(
      "Trust level for suspicious device:",
      suspiciousAssessment.trustLevel
    );
    console.log(
      "Risk level for suspicious device:",
      suspiciousAssessment.riskLevel
    );
    console.log(
      "Suspicious device detected:",
      suspiciousAssessment.riskLevel > 0
    );

    return suspiciousAssessment;
  } catch (error) {
    console.error("Suspicious device detection test failed:", error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanUp() {
  try {
    console.log("\n--- Cleaning Up Test Data ---");

    // Delete all devices for test user
    const deletedDevices = await Device.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedDevices.deletedCount} devices`);

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
    console.log("Starting device management tests...");

    // Create test user
    await createTestUser();

    // Run tests
    const results = {
      deviceFingerprinting: await testDeviceFingerprinting()
        .then(() => true)
        .catch(() => false),
      deviceRecording: await testDeviceRecording()
        .then(() => true)
        .catch(() => false),
      deviceVerification: await testDeviceVerification()
        .then(() => true)
        .catch(() => false),
      deviceSecurityAssessment: await testDeviceSecurityAssessment()
        .then(() => true)
        .catch(() => false),
      suspiciousDeviceDetection: await testSuspiciousDeviceDetection()
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
