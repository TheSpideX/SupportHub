/**
 * Login Flow Test
 * 
 * This test verifies the complete login flow:
 * 1. Creating a test user directly in the database
 * 2. Logging in with the test user
 * 3. Verifying the session and tokens
 * 4. Refreshing the tokens
 * 5. Logging out
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
 * Test login
 */
async function testLogin() {
  console.log('\n--- Testing Login ---');
  
  // Create mock response object to capture cookies
  const mockRes = {
    cookies: {},
    cookie: function(name, value, options) {
      this.cookies[name] = value;
      console.log(`Setting cookie: ${name}=${value.substring(0, 20)}...`);
      console.log('Cookie options:', options);
    },
    headersSent: false,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      return this;
    }
  };
  
  // Login with test device
  const loginResult = await authService.login(
    TEST_USER.email,
    TEST_USER.password,
    {
      ipAddress: TEST_DEVICE.ip,
      userAgent: TEST_DEVICE.userAgent,
      deviceInfo: TEST_DEVICE,
    },
    true, // rememberMe
    mockRes // Pass mock response to capture cookies
  );
  
  console.log('Login successful');
  console.log('Session ID:', loginResult.session.id);
  
  // Store session and tokens
  testSession = loginResult.session;
  tokens = loginResult.tokens;
  
  // Get device from session
  if (testSession.deviceId) {
    const device = await Device.findById(testSession.deviceId);
    if (device) {
      console.log('Device associated with session:', device._id);
      testDevice = device;
    }
  }
  
  // Print cookies
  console.log('Cookies set during login:');
  for (const [name, value] of Object.entries(mockRes.cookies)) {
    console.log(`${name}: ${value.substring(0, 20)}...`);
  }
  
  return { loginResult, mockRes };
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
  
  // Create mock response object to capture cookies
  const mockRes = {
    cookies: {},
    cookie: function(name, value, options) {
      this.cookies[name] = value;
      console.log(`Setting cookie: ${name}=${value.substring(0, 20)}...`);
      console.log('Cookie options:', options);
    },
    headersSent: false,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      return this;
    }
  };
  
  // Refresh tokens
  const refreshResult = await tokenService.refreshToken(tokens.refreshToken, mockRes);
  
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
  
  // Print cookies
  console.log('Cookies set during token refresh:');
  for (const [name, value] of Object.entries(mockRes.cookies)) {
    console.log(`${name}: ${value.substring(0, 20)}...`);
  }
  
  return { refreshResult, mockRes };
}

/**
 * Test logout
 */
async function testLogout() {
  console.log('\n--- Testing Logout ---');
  
  // Create mock response object to capture cookies
  const mockRes = {
    cookies: {},
    cookie: function(name, value, options) {
      this.cookies[name] = value;
      console.log(`Setting cookie: ${name}=${value}`);
      console.log('Cookie options:', options);
    },
    clearCookie: function(name, options) {
      console.log(`Clearing cookie: ${name}`);
      console.log('Cookie options:', options);
      this.cookies[name] = null;
    },
    headersSent: false,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      return this;
    }
  };
  
  // Create mock request object
  const mockReq = {
    cookies: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      csrf_token: tokens.csrfToken,
    },
    headers: {
      'user-agent': TEST_DEVICE.userAgent,
      'x-csrf-token': tokens.csrfToken,
    },
    ip: TEST_DEVICE.ip,
    session: testSession,
  };
  
  // Logout
  const logoutResult = await authService.logout(mockReq, mockRes);
  
  console.log('Logout successful');
  
  // Check if session was deleted
  const session = await Session.findById(testSession.id);
  console.log('Session deleted:', !session);
  
  return { logoutResult, mockRes };
}

/**
 * Clean up test data
 */
async function cleanUp() {
  console.log('\n--- Cleaning Up Test Data ---');
  
  // Delete all sessions for test user
  if (testUser) {
    const deletedSessions = await Session.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedSessions.deletedCount} sessions`);
    
    // Delete all devices for test user
    const deletedDevices = await Device.deleteMany({ userId: testUser._id });
    console.log(`Deleted ${deletedDevices.deletedCount} devices`);
    
    // Delete test user
    await User.deleteOne({ _id: testUser._id });
    console.log('Deleted test user');
  }
  
  return true;
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('Starting login flow tests...');
    
    // Create test user
    await createTestUser();
    
    // Test login
    await testLogin();
    
    // Verify tokens
    await verifyTokens();
    
    // Test token refresh
    await testTokenRefresh();
    
    // Test logout
    await testLogout();
    
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
