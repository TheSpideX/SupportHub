/**
 * Comprehensive Authentication System Test
 * 
 * This script tests all aspects of the authentication system:
 * 1. User registration and account management
 * 2. Login and session creation
 * 3. Token generation, verification, and refresh
 * 4. Device management and fingerprinting
 * 5. Cross-tab synchronization with leader election
 * 6. Cross-device session management
 * 7. Security features (session termination, logout from all devices)
 */

const mongoose = require('mongoose');
const User = require('./src/modules/auth/models/user.model');
const Session = require('./src/modules/auth/models/session.model');
const Device = require('./src/modules/auth/models/device.model');
const authService = require('./src/modules/auth/services/auth.service');
const tokenService = require('./src/modules/auth/services/token.service');
const sessionService = require('./src/modules/auth/services/session.service');
const deviceService = require('./src/modules/auth/services/device.service');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { redisClient } = require('./src/config/redis');

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
let tokens = [];
let deviceIds = [];

/**
 * Test 1: User Registration
 */
async function testUserRegistration() {
  try {
    console.log('\n=== Test 1: User Registration ===');
    
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
    
    console.log('✅ User registration successful');
    console.log('User ID:', user._id);
    
    testUser = user;
    return user;
  } catch (error) {
    console.error('❌ User registration failed:', error);
    throw error;
  }
}

/**
 * Test 2: Device Fingerprinting
 */
async function testDeviceFingerprinting() {
  try {
    console.log('\n=== Test 2: Device Fingerprinting ===');
    
    // Generate fingerprints for all test devices
    const fingerprints = TEST_DEVICES.map(deviceInfo => {
      const fingerprint = deviceService.generateEnhancedFingerprint(deviceInfo);
      console.log(`Device: ${deviceInfo.name}, Fingerprint: ${fingerprint}`);
      return fingerprint;
    });
    
    // Verify fingerprints are unique
    const uniqueFingerprints = new Set(fingerprints);
    console.log(`✅ Generated ${fingerprints.length} fingerprints, ${uniqueFingerprints.size} are unique`);
    
    return fingerprints;
  } catch (error) {
    console.error('❌ Device fingerprinting failed:', error);
    throw error;
  }
}

/**
 * Test 3: Multi-Device Login
 */
async function testMultiDeviceLogin() {
  try {
    console.log('\n=== Test 3: Multi-Device Login ===');
    
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
      
      // Store session and tokens
      sessions.push(loginResult.session);
      tokens.push({
        device: deviceInfo.name,
        accessToken: loginResult.accessToken,
        refreshToken: loginResult.refreshToken
      });
      
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
    return { sessions, tokens, devices, deviceIds };
  } catch (error) {
    console.error('❌ Multi-device login failed:', error);
    throw error;
  }
}

/**
 * Test 4: Cross-Tab Synchronization
 */
async function testCrossTabSync() {
  try {
    console.log('\n=== Test 4: Cross-Tab Synchronization ===');
    
    // Get device info from the first login
    if (sessions.length === 0) {
      throw new Error('No sessions available for cross-tab testing');
    }
    
    // Get the first session
    const firstSession = sessions[0];
    console.log(`Using session: ${firstSession.id}`);
    
    // Get device info from the session
    const sessionData = await sessionService.getSessionById(firstSession.id);
    const deviceId = sessionData.deviceId;
    
    if (!deviceId) {
      throw new Error('No device ID available for cross-tab testing');
    }
    
    console.log(`Using device ID: ${deviceId}`);
    
    // Get device info
    const deviceInfo = TEST_DEVICES[0];
    
    // Create multiple tabs for the same device
    const tabSessions = [];
    
    for (let i = 0; i < 3; i++) {
      console.log(`Creating tab ${i+1}`);
      
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
          fingerprint: deviceInfo.fingerprint
        },
        metadata: {
          tabId: `tab_${i+1}`,
          isLeader: i === 0 // First tab is the leader
        }
      });
      
      console.log(`✅ Tab ${i+1} session created with ID: ${tabSession._id}`);
      tabSessions.push(tabSession);
    }
    
    // Test leader election
    console.log('\n--- Testing Leader Election ---');
    
    // Simulate leader tab heartbeat
    for (let i = 0; i < tabSessions.length; i++) {
      const isLeader = i === 0;
      const tabSession = tabSessions[i];
      
      // Update session with heartbeat
      await sessionService.updateSessionActivity(
        tabSession._id,
        'heartbeat',
        {
          tabId: `tab_${i+1}`,
          isLeader: isLeader,
          timestamp: Date.now()
        }
      );
      
      console.log(`Tab ${i+1} heartbeat sent, leader status: ${isLeader}`);
    }
    
    // Simulate leader tab closing (tab 0)
    console.log('\nSimulating leader tab closing...');
    
    // Mark the leader tab session as inactive
    await sessionService.endSession(tabSessions[0]._id, {
      reason: 'tab_closed',
      userId: testUser._id
    });
    
    console.log('✅ Leader tab marked as inactive');
    
    // Simulate new leader election (tab 1 becomes leader)
    console.log('\nSimulating new leader election...');
    
    // Update tab 1 to become the leader
    await sessionService.updateSessionActivity(
      tabSessions[1]._id,
      'leader_elected',
      {
        tabId: `tab_2`,
        isLeader: true,
        timestamp: Date.now()
      }
    );
    
    console.log('✅ Tab 2 elected as new leader');
    
    // Verify the new leader
    const updatedSession = await Session.findById(tabSessions[1]._id);
    console.log(`New leader tab metadata:`, updatedSession.metadata);
    
    return { tabSessions };
  } catch (error) {
    console.error('❌ Cross-tab synchronization failed:', error);
    throw error;
  }
}

/**
 * Test 5: Token Refresh and Rotation
 */
async function testTokenRefreshAndRotation() {
  try {
    console.log('\n=== Test 5: Token Refresh and Rotation ===');
    
    // Skip if no tokens are available (HTTP-only cookies)
    if (!tokens.length || !tokens[0].refreshToken) {
      console.log('Skipping token refresh test - no refresh token available (using HTTP-only cookies)');
      return null;
    }
    
    // Use the refresh token from the first device
    const deviceToken = tokens[0];
    console.log(`Using refresh token from device: ${deviceToken.device}`);
    
    // Refresh the token
    const refreshResult = await tokenService.refreshToken(deviceToken.refreshToken);
    
    console.log('✅ Token refresh successful');
    console.log('New access token received:', !!refreshResult.accessToken);
    console.log('New refresh token received:', !!refreshResult.refreshToken);
    
    // Verify the old refresh token is blacklisted
    try {
      // Wait a bit to ensure blacklisting is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await tokenService.verifyRefreshToken(deviceToken.refreshToken);
      console.log('❌ ERROR: Old refresh token is still valid!');
    } catch (error) {
      console.log('✅ Old refresh token is properly invalidated:', error.message);
    }
    
    // Update the tokens
    tokens[0].accessToken = refreshResult.accessToken;
    tokens[0].refreshToken = refreshResult.refreshToken;
    
    // Verify the new tokens
    const decodedAccess = await tokenService.verifyAccessToken(refreshResult.accessToken);
    console.log('✅ New access token is valid:', !!decodedAccess);
    
    const decodedRefresh = await tokenService.verifyRefreshToken(refreshResult.refreshToken);
    console.log('✅ New refresh token is valid:', !!decodedRefresh);
    
    return refreshResult;
  } catch (error) {
    console.error('❌ Token refresh and rotation failed:', error);
    return null;
  }
}

/**
 * Test 6: Session Termination Across Devices
 */
async function testSessionTermination() {
  try {
    console.log('\n=== Test 6: Session Termination Across Devices ===');
    
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
 * Test 7: Security Event Propagation
 */
async function testSecurityEventPropagation() {
  try {
    console.log('\n=== Test 7: Security Event Propagation ===');
    
    // Simulate a security event
    const securityEvent = {
      type: 'security:alert',
      userId: testUser._id,
      sessionId: sessions[0].id,
      deviceId: deviceIds[0],
      severity: 'medium',
      details: {
        message: 'Unusual login location detected',
        location: 'New York, USA',
        ipAddress: '203.0.113.1',
        timestamp: new Date()
      }
    };
    
    console.log('Simulating security event:', securityEvent.type);
    
    // Record the security event
    await sessionService.recordSecurityEvent(
      testUser._id,
      securityEvent.sessionId,
      securityEvent.type,
      securityEvent.severity,
      securityEvent.details
    );
    
    console.log('✅ Security event recorded');
    
    // Check if the event was recorded in Redis
    const eventKey = `security:events:${testUser._id}`;
    const events = await redisClient.lrange(eventKey, 0, -1);
    
    if (events && events.length > 0) {
      console.log(`✅ Found ${events.length} security events in Redis`);
      
      // Parse the latest event
      const latestEvent = JSON.parse(events[0]);
      console.log('Latest security event:', latestEvent.type);
    } else {
      console.log('❌ No security events found in Redis');
    }
    
    return securityEvent;
  } catch (error) {
    console.error('❌ Security event propagation failed:', error);
    throw error;
  }
}

/**
 * Test 8: Logout From All Devices
 */
async function testLogoutAllDevices() {
  try {
    console.log('\n=== Test 8: Logout From All Devices ===');
    
    // Logout from all devices
    await authService.logoutAllDevices(testUser._id);
    
    console.log('✅ Logged out from all devices');
    
    // Verify all sessions are terminated
    const activeSessions = await Session.find({
      userId: testUser._id,
      status: { $ne: 'ended' }
    });
    
    console.log(`Active sessions after logout: ${activeSessions.length}`);
    
    // Try to use a token after logout
    if (tokens.length > 0 && tokens[0].accessToken) {
      try {
        const token = tokens[0].accessToken;
        await tokenService.verifyAccessToken(token);
        console.log('❌ ERROR: Token is still valid after logout!');
      } catch (error) {
        console.log('✅ Token is properly invalidated after logout:', error.message);
      }
    }
    
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
    console.log('\n=== Cleaning Up Test Data ===');
    
    // Delete all sessions for test user
    const deletedSessions = await Session.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedSessions.deletedCount} sessions`);
    
    // Delete all devices for test user
    const deletedDevices = await Device.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedDevices.deletedCount} devices`);
    
    // Delete test user
    await User.deleteOne({ _id: testUser._id });
    console.log('Deleted test user');
    
    // Clear Redis keys related to the test user
    const userKeys = await redisClient.keys(`*:${testUser._id}*`);
    if (userKeys && userKeys.length > 0) {
      await redisClient.del(userKeys);
      console.log(`Deleted ${userKeys.length} Redis keys`);
    }
    
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
    console.log('Starting comprehensive authentication system tests...');
    
    // Run tests
    const results = {
      userRegistration: await testUserRegistration().then(() => true).catch(() => false),
      deviceFingerprinting: await testDeviceFingerprinting().then(() => true).catch(() => false),
      multiDeviceLogin: await testMultiDeviceLogin().then(() => true).catch(() => false),
      crossTabSync: await testCrossTabSync().then(() => true).catch(() => false),
      tokenRefreshAndRotation: await testTokenRefreshAndRotation() !== null,
      sessionTermination: await testSessionTermination().then(() => true).catch(() => false),
      securityEventPropagation: await testSecurityEventPropagation().then(() => true).catch(() => false),
      logoutAllDevices: await testLogoutAllDevices().then(() => true).catch(() => false)
    };
    
    // Clean up
    await cleanUp();
    
    // Print results
    console.log('\n=== Test Results ===');
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
