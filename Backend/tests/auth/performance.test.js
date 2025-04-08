/**
 * Performance Tests for Authentication System
 * 
 * Tests performance characteristics:
 * - Handling large numbers of concurrent sessions
 * - Handling high volumes of authentication requests
 * - WebSocket connection scaling
 * - Token generation and validation performance
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const io = require('socket.io-client');
const { expect } = require('chai');
const { performance } = require('perf_hooks');

// Import models
const User = require('../../src/modules/auth/models/user.model');
const Session = require('../../src/modules/auth/models/session.model');
const Device = require('../../src/modules/auth/models/device.model');
const Token = require('../../src/modules/auth/models/token.model');

// Import services
const authService = require('../../src/modules/auth/services/auth.service');
const tokenService = require('../../src/modules/auth/services/token.service');
const sessionService = require('../../src/modules/auth/services/session.service');
const deviceService = require('../../src/modules/auth/services/device.service');

describe('Authentication System Performance Tests', function() {
  // Increase timeout for performance tests
  this.timeout(60000);
  
  let testUsers = [];
  let testDevices = [];
  let testSessions = [];
  let socketClients = [];
  
  before(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27017/tech-support-crm-test');
    
    // Clean up any existing test data
    await User.deleteMany({ email: /^perf.*@example\.com$/ });
    await Session.deleteMany({});
    await Device.deleteMany({});
    await Token.deleteMany({});
  });
  
  after(async () => {
    // Disconnect all socket clients
    for (const client of socketClients) {
      if (client && client.connected) {
        client.disconnect();
      }
    }
    
    // Clean up and disconnect
    await User.deleteMany({ email: /^perf.*@example\.com$/ });
    await Session.deleteMany({});
    await Device.deleteMany({});
    await Token.deleteMany({});
    
    await mongoose.connection.close();
  });
  
  describe('Token Generation and Validation Performance', () => {
    it('should generate and validate tokens efficiently', async () => {
      // Create a test user
      const testUser = await User.create({
        email: `perf.${Date.now()}@example.com`,
        profile: {
          firstName: 'Performance',
          lastName: 'Test',
          phoneNumber: '+1234567890',
          timezone: 'America/New_York',
        },
        role: 'support',
        status: {
          isActive: true,
          verifiedAt: new Date(),
        },
        security: {
          password: 'Test123!',
          passwordChangedAt: new Date(),
          emailVerified: true,
          loginAttempts: 0,
          lastLogin: null,
        },
      });
      
      // Create a test device
      const testDevice = await Device.create({
        deviceId: crypto.randomBytes(16).toString('hex'),
        userId: testUser._id,
        name: 'Performance Test Device',
        fingerprint: crypto.randomBytes(16).toString('hex'),
        userAgent: 'Test User Agent',
        browser: 'Test Browser',
        os: 'Test OS',
        deviceType: 'desktop',
        isVerified: true,
        verifiedAt: new Date(),
        lastActive: new Date(),
        ipAddresses: ['127.0.0.1'],
        trustScore: 100,
        hierarchyPath: {
          userRoom: `user:${testUser._id}`
        }
      });
      
      // Create a test session
      const testSession = await Session.create({
        userId: testUser._id,
        deviceId: testDevice._id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent',
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'active',
        hierarchyPath: {
          userRoom: `user:${testUser._id}`,
          deviceRoom: `device:${testDevice.deviceId}`
        }
      });
      
      // Prepare payload for token generation
      const payload = {
        sub: testUser._id.toString(),
        sessionId: testSession._id.toString(),
        deviceId: testDevice.deviceId,
        role: testUser.role
      };
      
      // Measure access token generation performance
      const accessTokenCount = 100;
      const accessTokenStartTime = performance.now();
      
      for (let i = 0; i < accessTokenCount; i++) {
        await tokenService.generateAccessToken(payload);
      }
      
      const accessTokenEndTime = performance.now();
      const accessTokenAvgTime = (accessTokenEndTime - accessTokenStartTime) / accessTokenCount;
      
      console.log(`Average access token generation time: ${accessTokenAvgTime.toFixed(2)}ms`);
      
      // Generate a token for validation testing
      const token = await tokenService.generateAccessToken(payload);
      
      // Measure token validation performance
      const validationCount = 100;
      const validationStartTime = performance.now();
      
      for (let i = 0; i < validationCount; i++) {
        await tokenService.verifyAccessToken(token);
      }
      
      const validationEndTime = performance.now();
      const validationAvgTime = (validationEndTime - validationStartTime) / validationCount;
      
      console.log(`Average token validation time: ${validationAvgTime.toFixed(2)}ms`);
      
      // Assertions
      expect(accessTokenAvgTime).to.be.lessThan(10); // Should be less than 10ms per token
      expect(validationAvgTime).to.be.lessThan(5); // Should be less than 5ms per validation
      
      // Clean up
      await Session.deleteOne({ _id: testSession._id });
      await Device.deleteOne({ _id: testDevice._id });
      await User.deleteOne({ _id: testUser._id });
    });
  });
  
  describe('Concurrent Session Handling', () => {
    it('should handle multiple sessions for a single user efficiently', async () => {
      // Create a test user
      const testUser = await User.create({
        email: `perf.${Date.now()}@example.com`,
        profile: {
          firstName: 'Performance',
          lastName: 'Test',
          phoneNumber: '+1234567890',
          timezone: 'America/New_York',
        },
        role: 'support',
        status: {
          isActive: true,
          verifiedAt: new Date(),
        },
        security: {
          password: 'Test123!',
          passwordChangedAt: new Date(),
          emailVerified: true,
          loginAttempts: 0,
          lastLogin: null,
        },
      });
      
      testUsers.push(testUser);
      
      // Create multiple devices and sessions
      const sessionCount = 20; // Create 20 sessions
      const createSessionStartTime = performance.now();
      
      for (let i = 0; i < sessionCount; i++) {
        // Create device
        const device = await Device.create({
          deviceId: crypto.randomBytes(16).toString('hex'),
          userId: testUser._id,
          name: `Performance Test Device ${i}`,
          fingerprint: crypto.randomBytes(16).toString('hex'),
          userAgent: `Test User Agent ${i}`,
          browser: 'Test Browser',
          os: 'Test OS',
          deviceType: 'desktop',
          isVerified: true,
          verifiedAt: new Date(),
          lastActive: new Date(),
          ipAddresses: ['127.0.0.1'],
          trustScore: 100,
          hierarchyPath: {
            userRoom: `user:${testUser._id}`
          }
        });
        
        testDevices.push(device);
        
        // Create session
        const session = await Session.create({
          userId: testUser._id,
          deviceId: device._id,
          ipAddress: '127.0.0.1',
          userAgent: `Test User Agent ${i}`,
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: 'active',
          hierarchyPath: {
            userRoom: `user:${testUser._id}`,
            deviceRoom: `device:${device.deviceId}`
          }
        });
        
        testSessions.push(session);
      }
      
      const createSessionEndTime = performance.now();
      const createSessionAvgTime = (createSessionEndTime - createSessionStartTime) / sessionCount;
      
      console.log(`Average session creation time: ${createSessionAvgTime.toFixed(2)}ms`);
      
      // Measure session retrieval performance
      const retrievalStartTime = performance.now();
      
      const sessions = await sessionService.getUserSessions(testUser._id);
      
      const retrievalEndTime = performance.now();
      const retrievalTime = retrievalEndTime - retrievalStartTime;
      
      console.log(`Time to retrieve ${sessions.length} sessions: ${retrievalTime.toFixed(2)}ms`);
      
      // Assertions
      expect(sessions.length).to.equal(sessionCount);
      expect(retrievalTime).to.be.lessThan(100); // Should retrieve all sessions in less than 100ms
    });
  });
  
  describe('Concurrent Login Performance', () => {
    it('should handle multiple concurrent login requests efficiently', async () => {
      // Create multiple test users
      const userCount = 10;
      const users = [];
      
      for (let i = 0; i < userCount; i++) {
        const user = await User.create({
          email: `perf.${Date.now()}.${i}@example.com`,
          profile: {
            firstName: 'Performance',
            lastName: `Test ${i}`,
            phoneNumber: '+1234567890',
            timezone: 'America/New_York',
          },
          role: 'support',
          status: {
            isActive: true,
            verifiedAt: new Date(),
          },
          security: {
            password: 'Test123!',
            passwordChangedAt: new Date(),
            emailVerified: true,
            loginAttempts: 0,
            lastLogin: null,
          },
        });
        
        users.push(user);
        testUsers.push(user);
      }
      
      // Prepare login requests
      const loginPromises = [];
      
      for (let i = 0; i < userCount; i++) {
        const mockRes = {
          cookies: {},
          cookie: function(name, value, options) {
            this.cookies[name] = value;
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
        
        loginPromises.push(
          authService.login(
            users[i].email,
            'Test123!',
            {
              ipAddress: '192.168.1.100',
              userAgent: `Test User Agent ${i}`,
              deviceInfo: {
                name: `Test Device ${i}`,
                fingerprint: crypto.randomBytes(16).toString('hex'),
                browser: 'Test Browser',
                os: 'Test OS',
                device: 'Desktop',
              },
            },
            true, // rememberMe
            mockRes // Pass mock response to capture cookies
          )
        );
      }
      
      // Measure concurrent login performance
      const loginStartTime = performance.now();
      
      const loginResults = await Promise.all(loginPromises);
      
      const loginEndTime = performance.now();
      const loginTotalTime = loginEndTime - loginStartTime;
      const loginAvgTime = loginTotalTime / userCount;
      
      console.log(`Total time for ${userCount} concurrent logins: ${loginTotalTime.toFixed(2)}ms`);
      console.log(`Average login time: ${loginAvgTime.toFixed(2)}ms`);
      
      // Store sessions and devices for cleanup
      for (const result of loginResults) {
        testSessions.push(result.session);
        if (result.session.deviceId) {
          const device = await Device.findById(result.session.deviceId);
          if (device) {
            testDevices.push(device);
          }
        }
      }
      
      // Assertions
      expect(loginResults.length).to.equal(userCount);
      expect(loginAvgTime).to.be.lessThan(500); // Each login should take less than 500ms on average
    });
  });
  
  describe('WebSocket Connection Scaling', () => {
    it('should handle multiple WebSocket connections efficiently', async () => {
      // Create a test user
      const testUser = await User.create({
        email: `perf.${Date.now()}@example.com`,
        profile: {
          firstName: 'Performance',
          lastName: 'Test',
          phoneNumber: '+1234567890',
          timezone: 'America/New_York',
        },
        role: 'support',
        status: {
          isActive: true,
          verifiedAt: new Date(),
        },
        security: {
          password: 'Test123!',
          passwordChangedAt: new Date(),
          emailVerified: true,
          loginAttempts: 0,
          lastLogin: null,
        },
      });
      
      testUsers.push(testUser);
      
      // Create a device
      const device = await Device.create({
        deviceId: crypto.randomBytes(16).toString('hex'),
        userId: testUser._id,
        name: 'Performance Test Device',
        fingerprint: crypto.randomBytes(16).toString('hex'),
        userAgent: 'Test User Agent',
        browser: 'Test Browser',
        os: 'Test OS',
        deviceType: 'desktop',
        isVerified: true,
        verifiedAt: new Date(),
        lastActive: new Date(),
        ipAddresses: ['127.0.0.1'],
        trustScore: 100,
        hierarchyPath: {
          userRoom: `user:${testUser._id}`
        }
      });
      
      testDevices.push(device);
      
      // Create a session
      const session = await Session.create({
        userId: testUser._id,
        deviceId: device._id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent',
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'active',
        hierarchyPath: {
          userRoom: `user:${testUser._id}`,
          deviceRoom: `device:${device.deviceId}`
        }
      });
      
      testSessions.push(session);
      
      // Generate tokens
      const tokens = await tokenService.generateAuthTokens(
        testUser,
        {
          sessionId: session._id,
          userAgent: 'Test User Agent',
          ipAddress: '127.0.0.1',
          deviceInfo: {
            name: 'Performance Test Device',
            fingerprint: device.fingerprint,
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          }
        }
      );
      
      // Create multiple WebSocket connections
      const connectionCount = 10; // Create 10 connections (tabs)
      const connectionPromises = [];
      
      for (let i = 0; i < connectionCount; i++) {
        connectionPromises.push(
          new Promise((resolve, reject) => {
            const socketClient = io('http://localhost:4290/auth', {
              withCredentials: true,
              extraHeaders: {
                Cookie: `access_token=${tokens.accessToken}; refresh_token=${tokens.refreshToken}; csrf_token=${tokens.csrfToken}`,
                'X-CSRF-Token': tokens.csrfToken,
              },
              auth: {
                deviceId: device.deviceId,
                tabId: `tab_${i}`,
                timestamp: Date.now(),
                token: tokens.accessToken,
              },
            });
            
            // Set timeout
            const timeout = setTimeout(() => {
              socketClient.disconnect();
              reject(new Error('Connection timeout'));
            }, 5000);
            
            // Set up event handlers
            socketClient.on('connect', () => {
              clearTimeout(timeout);
              socketClients.push(socketClient);
              resolve(socketClient);
            });
            
            socketClient.on('connect_error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          })
        );
      }
      
      // Measure connection performance
      const connectionStartTime = performance.now();
      
      try {
        const connectedClients = await Promise.all(connectionPromises);
        
        const connectionEndTime = performance.now();
        const connectionTotalTime = connectionEndTime - connectionStartTime;
        const connectionAvgTime = connectionTotalTime / connectionCount;
        
        console.log(`Total time for ${connectionCount} WebSocket connections: ${connectionTotalTime.toFixed(2)}ms`);
        console.log(`Average connection time: ${connectionAvgTime.toFixed(2)}ms`);
        
        // Assertions
        expect(connectedClients.length).to.equal(connectionCount);
        expect(connectionAvgTime).to.be.lessThan(500); // Each connection should take less than 500ms on average
        
        // Wait a bit to ensure all connections are established
        await sleep(1000);
        
        // Measure message broadcasting performance
        const messageCount = 10;
        const messageStartTime = performance.now();
        
        // Send messages to all clients
        for (let i = 0; i < messageCount; i++) {
          // Broadcast a message to all clients in the user's room
          // This would normally be done by the server, but we're simulating it here
          for (const client of connectedClients) {
            client.emit('test:message', {
              message: `Test message ${i}`,
              timestamp: Date.now(),
            });
          }
          
          // Small delay between messages
          await sleep(100);
        }
        
        const messageEndTime = performance.now();
        const messageTotalTime = messageEndTime - messageStartTime;
        const messageAvgTime = messageTotalTime / messageCount;
        
        console.log(`Total time for ${messageCount} broadcast messages: ${messageTotalTime.toFixed(2)}ms`);
        console.log(`Average broadcast time: ${messageAvgTime.toFixed(2)}ms`);
        
        // Disconnect all clients
        for (const client of connectedClients) {
          client.disconnect();
        }
      } catch (error) {
        console.error('WebSocket connection test failed:', error);
        throw error;
      }
    });
  });
});
