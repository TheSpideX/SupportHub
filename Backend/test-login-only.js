const mongoose = require('mongoose');
const authService = require('./src/modules/auth/services/auth.service');

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
 * Test user login
 */
async function testLogin() {
  try {
    console.log('\n--- Testing User Login ---');
    
    // Login with test credentials
    const loginResult = await authService.login(
      'test@example.com',
      'Test123!',
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
    
    return true;
  } catch (error) {
    console.error('Login test failed:', error);
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
    testLogin();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
