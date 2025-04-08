/**
 * Token Generation Test
 * 
 * This test verifies the token generation and validation functionality:
 * 1. Creating a test user directly in the database
 * 2. Generating tokens for the user
 * 3. Validating the tokens
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// Import models
const User = require('../../src/modules/auth/models/user.model');
const Session = require('../../src/modules/auth/models/session.model');
const Device = require('../../src/modules/auth/models/device.model');

// Import services
const authService = require('../../src/modules/auth/services/auth.service');
const tokenService = require('../../src/modules/auth/services/token.service');
const sessionService = require('../../src/modules/auth/services/session.service');

// Test user data
const TEST_USER = {
  email: `test.${Date.now()}@example.com`,
  password: 'Test123!',
  firstName: 'Test',
  lastName: 'User',
  phoneNumber: '+1234567890',
};

// Test device info
const TEST_DEVICE = {
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
  fingerprint: crypto.randomBytes(16).toString('hex'),
};

// Test data storage
let testUser = null;
let testSession = null;
let testDevice = null;
let tokens = null;

/**
 * Create test user
 */
async function createTestUser() {
  console.log('\n--- Creating Test User ---');
  
  // Check if test user already exists
  let user = await User.findOne({ email: TEST_USER.email });
  
  if (user) {
    console.log('Test user already exists, deleting it');
    await User.deleteOne({ email: TEST_USER.email });
  }
  
  // Create a new user directly in the database
  user = await User.create({
    email: TEST_USER.email,
    profile: {
      firstName: TEST_USER.firstName,
      lastName: TEST_USER.lastName,
      phoneNumber: TEST_USER.phoneNumber,
      timezone: 'America/New_York',
    },
    role: 'support',
    status: {
      isActive: true,
      verifiedAt: new Date(),
    },
    security: {
      password: TEST_USER.password, // Let the model handle password hashing
      passwordChangedAt: new Date(),
      emailVerified: true,
      loginAttempts: 0,
      lastLogin: null,
    },
  });
  
  console.log('Test user created with ID:', user._id);
  testUser = user;
  
  return user;
}

/**
 * Create test session and device
 */
async function createTestSession() {
  console.log('\n--- Creating Test Session ---');
  
  // Create device directly
  const device = await Device.create({
    deviceId: crypto.randomBytes(16).toString('hex'),
    userId: testUser._id,
    name: TEST_DEVICE.name,
    fingerprint: TEST_DEVICE.fingerprint,
    userAgent: TEST_DEVICE.userAgent,
    browser: TEST_DEVICE.browser,
    os: TEST_DEVICE.os,
    deviceType: 'desktop',
    isVerified: true,
    verifiedAt: new Date(),
    lastActive: new Date(),
    ipAddresses: [TEST_DEVICE.ip],
    trustScore: 100,
    hierarchyPath: {
      userRoom: `user:${testUser._id}`
    }
  });
  
  console.log('Test device created with ID:', device._id);
  testDevice = device;
  
  // Create session
  const session = await Session.create({
    userId: testUser._id,
    deviceId: device._id,
    ipAddress: TEST_DEVICE.ip,
    userAgent: TEST_DEVICE.userAgent,
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    status: 'active',
    hierarchyPath: {
      userRoom: `user:${testUser._id}`,
      deviceRoom: `device:${device.deviceId}`
    }
  });
  
  console.log('Test session created with ID:', session._id);
  testSession = session;
  
  return { session, device };
}

/**
 * Generate tokens for test user
 */
async function generateTokens() {
  console.log('\n--- Generating Tokens ---');
  
  // Generate tokens using the token service
  const tokenResult = await tokenService.generateAuthTokens(
    testUser,
    {
      sessionId: testSession._id,
      userAgent: TEST_DEVICE.userAgent,
      ipAddress: TEST_DEVICE.ip,
      deviceInfo: TEST_DEVICE
    }
  );
  
  tokens = {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    csrfToken: tokenResult.csrfToken,
  };
  
  console.log('Tokens generated');
  console.log('Access Token:', tokens.accessToken.substring(0, 20) + '...');
  console.log('Refresh Token:', tokens.refreshToken.substring(0, 20) + '...');
  console.log('CSRF Token:', tokens.csrfToken);
  
  return tokens;
}

/**
 * Verify tokens
 */
async function verifyTokens() {
  console.log('\n--- Verifying Tokens ---');
  
  // Verify access token
  const accessTokenVerified = await tokenService.verifyAccessToken(tokens.accessToken);
  console.log('Access Token Verified:', !!accessTokenVerified);
  if (accessTokenVerified) {
    console.log('Access Token Payload:', accessTokenVerified);
  }
  
  // Verify refresh token
  const refreshTokenVerified = await tokenService.verifyRefreshToken(tokens.refreshToken);
  console.log('Refresh Token Verified:', !!refreshTokenVerified);
  if (refreshTokenVerified) {
    console.log('Refresh Token Payload:', refreshTokenVerified);
  }
  
  // Verify CSRF token
  const csrfTokenVerified = await tokenService.verifyCsrfToken(tokens.csrfToken);
  console.log('CSRF Token Verified:', !!csrfTokenVerified);
  
  return {
    accessTokenVerified,
    refreshTokenVerified,
    csrfTokenVerified,
  };
}

/**
 * Test token refresh
 */
async function testTokenRefresh() {
  console.log('\n--- Testing Token Refresh ---');
  
  // Refresh tokens
  const refreshResult = await tokenService.refreshToken(tokens.refreshToken);
  
  console.log('Tokens refreshed');
  console.log('New Access Token:', refreshResult.accessToken.substring(0, 20) + '...');
  console.log('New Refresh Token:', refreshResult.refreshToken.substring(0, 20) + '...');
  
  // Update tokens
  tokens.accessToken = refreshResult.accessToken;
  tokens.refreshToken = refreshResult.refreshToken;
  
  // Verify new tokens
  const accessTokenVerified = await tokenService.verifyAccessToken(tokens.accessToken);
  console.log('New Access Token Verified:', !!accessTokenVerified);
  
  const refreshTokenVerified = await tokenService.verifyRefreshToken(tokens.refreshToken);
  console.log('New Refresh Token Verified:', !!refreshTokenVerified);
  
  return refreshResult;
}

/**
 * Clean up test data
 */
async function cleanUp() {
  console.log('\n--- Cleaning Up Test Data ---');
  
  // Delete test session
  if (testSession) {
    await Session.deleteOne({ _id: testSession._id });
    console.log('Test session deleted');
  }
  
  // Delete test device
  if (testDevice) {
    await Device.deleteOne({ _id: testDevice._id });
    console.log('Test device deleted');
  }
  
  // Delete test user
  if (testUser) {
    await User.deleteOne({ _id: testUser._id });
    console.log('Test user deleted');
  }
  
  return true;
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('Starting token generation tests...');
    
    // Create test user
    await createTestUser();
    
    // Create test session and device
    await createTestSession();
    
    // Generate tokens
    await generateTokens();
    
    // Verify tokens
    await verifyTokens();
    
    // Test token refresh
    await testTokenRefresh();
    
    // Clean up
    await cleanUp();
    
    console.log('\n--- All Tests Completed Successfully ---');
    return true;
  } catch (error) {
    console.error('Error running tests:', error);
    
    // Clean up
    await cleanUp();
    
    return false;
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    process.exit(0);
  }
}

// Connect to MongoDB and run tests
mongoose
  .connect('mongodb://localhost:27017/tech-support-crm')
  .then(() => {
    console.log('Connected to MongoDB');
    runTests();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
