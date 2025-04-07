const mongoose = require('mongoose');
const User = require('./src/modules/auth/models/user.model');
const authService = require('./src/modules/auth/services/auth.service');
const bcrypt = require('bcryptjs');

// Test user credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Test123!';

// Test device info
const TEST_DEVICE_INFO = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
  ip: '127.0.0.1',
  browser: 'Chrome',
  os: 'macOS',
  device: 'Desktop',
  screen: '1920x1080',
  language: 'en-US',
  timezone: 'America/New_York',
  platform: 'MacIntel'
};

/**
 * Create a test user directly in the database
 */
async function createTestUser() {
  try {
    console.log('\n--- Creating Test User ---');
    
    // Check if test user already exists
    let user = await User.findOne({ email: TEST_EMAIL });
    
    if (user) {
      console.log('Test user already exists, deleting it');
      await User.deleteOne({ email: TEST_EMAIL });
    }
    
    // Create a new user directly in the database
    user = await User.create({
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
        // Store the plain password for now, we'll hash it in pre-save hook
        password: TEST_PASSWORD
      }
    });
    
    console.log('Test user created with ID:', user._id);
    return user;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}

/**
 * Test user login
 */
async function testLogin() {
  try {
    console.log('\n--- Testing User Login ---');
    
    // Login with test credentials
    const loginResult = await authService.login(
      TEST_EMAIL,
      TEST_PASSWORD,
      {
        ipAddress: TEST_DEVICE_INFO.ip,
        userAgent: TEST_DEVICE_INFO.userAgent,
        deviceInfo: TEST_DEVICE_INFO
      }
    );
    
    console.log('Login successful:', !!loginResult);
    console.log('Session ID:', loginResult.session.id);
    console.log('Access Token:', loginResult.accessToken ? 'Received' : 'Not received');
    console.log('Refresh Token:', loginResult.refreshToken ? 'Received' : 'Not received');
    
    return loginResult;
  } catch (error) {
    console.error('Login test failed:', error);
    throw error;
  }
}

/**
 * Run tests
 */
async function runTests() {
  try {
    // Create test user
    await createTestUser();
    
    // Test login
    const loginResult = await testLogin();
    
    console.log('\n--- Test Results ---');
    console.log('All tests passed successfully!');
    
    return true;
  } catch (error) {
    console.error('Tests failed:', error);
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
