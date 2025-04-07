/**
 * Cross-Tab Synchronization Test
 * 
 * This script tests the cross-tab synchronization functionality of the authentication system.
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

// Test device info
const TEST_DEVICE_INFO = {
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
};

// Store test data
let testUser = null;
let testDevice = null;
let testSession = null;

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
 * Create a test device
 */
async function createTestDevice() {
  try {
    console.log('\n--- Creating Test Device ---');
    
    // Record device info
    const deviceRecord = await deviceService.recordDeviceInfo(
      testUser._id,
      TEST_DEVICE_INFO
    );
    
    console.log('✅ Device recorded with ID:', deviceRecord.deviceId);
    
    // Get the device from the database
    const device = await Device.findOne({ userId: testUser._id });
    
    if (!device) {
      throw new Error('Device not found in database');
    }
    
    console.log('✅ Device found in database with ID:', device._id);
    testDevice = device;
    return device;
  } catch (error) {
    console.error('❌ Device creation failed:', error);
    throw error;
  }
}

/**
 * Create a test session
 */
async function createTestSession() {
  try {
    console.log('\n--- Creating Test Session ---');
    
    // Create a session
    const session = await sessionService.createSession({
      userId: testUser._id,
      deviceId: testDevice._id,
      userAgent: TEST_DEVICE_INFO.userAgent,
      ipAddress: TEST_DEVICE_INFO.ip,
      deviceInfo: TEST_DEVICE_INFO
    });
    
    console.log('✅ Session created with ID:', session._id);
    testSession = session;
    return session;
  } catch (error) {
    console.error('❌ Session creation failed:', error);
    throw error;
  }
}

/**
 * Test cross-tab synchronization
 */
async function testCrossTabSync() {
  try {
    console.log('\n--- Testing Cross-Tab Synchronization ---');
    
    // Create multiple tabs for the same device
    const tabSessions = [];
    
    for (let i = 0; i < 3; i++) {
      console.log(`Creating tab ${i+1}`);
      
      // Create a new session for the same device (simulating a new tab)
      const tabSession = await sessionService.createSession({
        userId: testUser._id,
        deviceId: testDevice._id,
        userAgent: TEST_DEVICE_INFO.userAgent,
        ipAddress: TEST_DEVICE_INFO.ip,
        deviceInfo: TEST_DEVICE_INFO,
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
    console.log('Starting cross-tab synchronization tests...');
    
    // Create test data
    await createTestUser();
    await createTestDevice();
    await createTestSession();
    
    // Run tests
    const result = await testCrossTabSync().then(() => true).catch(() => false);
    
    // Clean up
    await cleanUp();
    
    // Print results
    console.log('\n--- Test Results ---');
    console.log(`Cross-Tab Synchronization: ${result ? '✅ PASSED' : '❌ FAILED'}`);
    
    return result;
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
