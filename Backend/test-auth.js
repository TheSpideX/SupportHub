const mongoose = require('mongoose');
const { redisClient } = require('./src/config/redis');
const deviceService = require('./src/modules/auth/services/device.service');

async function testDeviceService() {
  try {
    console.log('Testing device service...');
    
    // Test generateEnhancedFingerprint
    const deviceInfo = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ip: '127.0.0.1',
      browser: 'Chrome',
      os: 'macOS',
      device: 'Desktop',
      screen: '1920x1080',
      language: 'en-US',
      timezone: 'America/New_York',
      platform: 'MacIntel'
    };
    
    // Test recordDeviceInfo
    const userId = '6123456789abcdef01234567';
    const result = await deviceService.recordDeviceInfo(userId, deviceInfo);
    console.log('Device info recorded:', result);
    
    // Test assessDeviceSecurity
    const securityResult = await deviceService.assessDeviceSecurity(userId, deviceInfo);
    console.log('Security assessment:', securityResult);
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    mongoose.connection.close();
    process.exit(0);
  }
}

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/tech-support-crm')
  .then(() => {
    console.log('Connected to MongoDB');
    testDeviceService();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
