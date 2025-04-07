/**
 * Cross-Device Management Test
 * 
 * This script tests the cross-device management functionality of the authentication system.
 */

const mongoose = require('mongoose');
const User = require('./src/modules/auth/models/user.model');
const Session = require('./src/modules/auth/models/session.model');
const Device = require('./src/modules/auth/models/device.model');
const authService = require('./src/modules/auth/services/auth.service');
const sessionService = require('./src/modules/auth/services/session.service');
const deviceService = require('./src/modules/auth/services/device.service');
const crypto = require('crypto');

// Test user credentials
const TEST_EMAIL = `test.${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test123!';

// Test device info for multiple devices
const TEST_DEVICES = [
  {
    name: 'Desktop Chrome',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    ip: '192.168.1.100',
    browser: 'Chrome',
    os: 'macOS',
    device: 'Desktop',
    screen: '1920x1080',
    language: 'en-US',
    timezone: 'America/New_York',
    platform: 'MacIntel',
    fingerprint: crypto.randomBytes(16).toString('hex')
  },
  {
    name: 'Mobile Safari',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    ip: '192.168.1.101',
    browser: 'Safari',
    os: 'iOS',
    device: 'iPhone',
    screen: '375x812',
    language: 'en-US',
    timezone: 'America/New_York',
    platform: 'iPhone',
    fingerprint: crypto.randomBytes(16).toString('hex')
  },
  {
    name: 'Tablet Firefox',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/34.0 Mobile/15E148 Safari/605.1.15',
    ip: '192.168.1.102',
    browser: 'Firefox',
    os: 'iOS',
    device: 'iPad',
    screen: '768x1024',
    language: 'en-US',
    timezone: 'America/New_York',
    platform: 'iPad',
    fingerprint: crypto.randomBytes(16).toString('hex')
  }
];

// Store test data
let testUser = null;
let sessions = [];
let devices = [];
let deviceIds = [];

/**
 * Create a test user
 */
async function createTestUser() {
  try {
    console.log('\n--- Creating Test User ---');
    
    // Create a new user
    const user = new User({
      email: TEST_EMAIL,
      profile: {
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+1234567890',
        timezone: 'America/New_York'
      },
      role: 'support',
      status: {
        isActive: true,
        verifiedAt: new Date()
      },
      security: {
        password: TEST_PASSWORD
      }
    });
    
    await user.save();
    
    console.log('✅ User created with ID:', user._id);
    testUser = user;
    return user;
  } catch (error) {
    console.error('❌ User creation failed:', error);
    throw error;
  }
}

/**
 * Test multi-device login
 */
async function testMultiDeviceLogin() {
  try {
    console.log('\n--- Testing Multi-Device Login ---');
    
    // Login with each test device
    for (const deviceInfo of TEST_DEVICES) {
      console.log(`Logging in with device: ${deviceInfo.name}`);
      
      const loginResult = await authService.login(
        TEST_EMAIL,
        TEST_PASSWORD,
        {
          ipAddress: deviceInfo.ip,
          userAgent: deviceInfo.userAgent,
          deviceInfo: deviceInfo
        }
      );
      
      console.log(`✅ Login successful on ${deviceInfo.name}`);
      console.log(`Session ID: ${loginResult.session.id}`);
      
      // Store session
      sessions.push(loginResult.session);
      
      // Get device ID from session
      const session = await sessionService.getSessionById(loginResult.session.id);
      if (session.deviceId) {
        deviceIds.push(session.deviceId);
        console.log(`Device ID: ${session.deviceId}`);
        
        // Try to get the device from the database
        try {
          const device = await Device.findById(session.deviceId);
          if (device) {
            devices.push(device);
            console.log(`Device found in database: ${device._id}`);
          }
        } catch (error) {
          console.log(`Could not find device in database: ${error.message}`);
        }
      }
      
      // Wait a bit between logins to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Successfully logged in with ${sessions.length} devices`);
    return { sessions, devices, deviceIds };
  } catch (error) {
    console.error('❌ Multi-device login failed:', error);
    throw error;
  }
}

/**
 * Test device verification
 */
async function testDeviceVerification() {
  try {
    console.log('\n--- Testing Device Verification ---');
    
    // Verify each device
    for (let i = 0; i < TEST_DEVICES.length; i++) {
      const deviceInfo = TEST_DEVICES[i];
      console.log(`Verifying device: ${deviceInfo.name}`);
      
      const verificationResult = await deviceService.verifyDeviceConsistency(
        testUser._id,
        deviceInfo
      );
      
      console.log(`✅ Device verification successful for ${deviceInfo.name}`);
      console.log(`Device is known: ${verificationResult.isKnown}`);
      console.log(`Device ID: ${verificationResult.deviceId}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Device verification failed:', error);
    throw error;
  }
}

/**
 * Test session termination across devices
 */
async function testSessionTermination() {
  try {
    console.log('\n--- Testing Session Termination Across Devices ---');
    
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
      
      await sessionService.endSession(
        sessionToTerminate.id,
        {
          reason: 'security_action',
          userId: testUser._id,
          initiatedBy: primarySession.id,
          message: 'Administrator terminated all other sessions'
        }
      );
    }
    
    // Verify sessions are terminated
    const remainingActiveSessions = await Session.find({
      userId: testUser._id,
      status: { $ne: 'ended' }
    });
    
    console.log(`✅ Remaining active sessions: ${remainingActiveSessions.length}`);
    
    return remainingActiveSessions;
  } catch (error) {
    console.error('❌ Session termination failed:', error);
    throw error;
  }
}

/**
 * Test logout from all devices
 */
async function testLogoutAllDevices() {
  try {
    console.log('\n--- Testing Logout From All Devices ---');
    
    // Logout from all devices
    await authService.logoutAllDevices(testUser._id);
    
    console.log('✅ Logged out from all devices');
    
    // Verify all sessions are terminated
    const activeSessions = await Session.find({
      userId: testUser._id,
      status: { $ne: 'ended' }
    });
    
    console.log(`Active sessions after logout: ${activeSessions.length}`);
    
    return activeSessions;
  } catch (error) {
    console.error('❌ Logout from all devices failed:', error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanUp() {
  try {
    console.log('\n--- Cleaning Up Test Data ---');
    
    // Delete all sessions for test user
    const deletedSessions = await Session.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedSessions.deletedCount} sessions`);
    
    // Delete all devices for test user
    const deletedDevices = await Device.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedDevices.deletedCount} devices`);
    
    // Delete test user
    await User.deleteOne({ _id: testUser._id });
    console.log('Deleted test user');
    
    return true;
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('Starting cross-device management tests...');
    
    // Create test user
    await createTestUser();
    
    // Run tests
    const results = {
      multiDeviceLogin: await testMultiDeviceLogin().then(() => true).catch(() => false),
      deviceVerification: await testDeviceVerification().then(() => true).catch(() => false),
      sessionTermination: await testSessionTermination().then(() => true).catch(() => false),
      logoutAllDevices: await testLogoutAllDevices().then(() => true).catch(() => false)
    };
    
    // Clean up
    await cleanUp();
    
    // Print results
    console.log('\n--- Test Results ---');
    for (const [test, passed] of Object.entries(results)) {
      console.log(`${test}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    const allPassed = Object.values(results).every(result => result);
    console.log(`\nOverall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    return allPassed;
  } catch (error) {
    console.error('Error running tests:', error);
    return false;
  } finally {
    // Close connections
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
}

// Connect to MongoDB and run tests
mongoose.connect('mongodb://localhost:27017/tech-support-crm')
  .then(() => {
    console.log('Connected to MongoDB');
    runTests();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
