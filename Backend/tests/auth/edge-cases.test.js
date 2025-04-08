/**
 * Edge Case Tests for Authentication System
 * 
 * Tests various edge cases and error scenarios:
 * - Token expiration and automatic refresh
 * - Concurrent login attempts
 * - Network interruptions
 * - Invalid or malformed tokens
 * - Session timeout handling
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const io = require('socket.io-client');
const { expect } = require('chai');

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

// Import configs
const tokenConfig = require('../../src/modules/auth/config/token.config');
const cookieConfig = require('../../src/modules/auth/config/cookie.config');

describe('Authentication System Edge Cases', function() {
  // Increase timeout for edge case tests
  this.timeout(30000);
  
  let testUser;
  let testDevice;
  let testSession;
  let tokens;
  let socketClient;
  
  before(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27017/tech-support-crm-test');
    
    // Clean up any existing test data
    await User.deleteMany({ email: /^test.*@example\.com$/ });
    await Session.deleteMany({});
    await Device.deleteMany({});
    await Token.deleteMany({});
  });
  
  after(async () => {
    // Clean up and disconnect
    await User.deleteMany({ email: /^test.*@example\.com$/ });
    await Session.deleteMany({});
    await Device.deleteMany({});
    await Token.deleteMany({});
    
    await mongoose.connection.close();
  });
  
  beforeEach(async () => {
    // Create a test user for each test
    testUser = await User.create({
      email: `test.${Date.now()}@example.com`,
      profile: {
        firstName: 'Test',
        lastName: 'User',
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
  });
  
  afterEach(async () => {
    // Disconnect socket client if connected
    if (socketClient && socketClient.connected) {
      socketClient.disconnect();
    }
    
    // Clean up test data
    if (testUser) {
      await Session.deleteMany({ userId: testUser._id });
      await Device.deleteMany({ userId: testUser._id });
      await Token.deleteMany({ userId: testUser._id });
      await User.deleteOne({ _id: testUser._id });
    }
  });
  
  describe('Token Expiration and Refresh', () => {
    it('should handle access token expiration and refresh automatically', async () => {
      // Create mock response object to capture cookies
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
      
      // Login with test device
      const loginResult = await authService.login(
        testUser.email,
        'Test123!',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Test User Agent',
          deviceInfo: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        },
        true, // rememberMe
        mockRes // Pass mock response to capture cookies
      );
      
      // Store session and tokens
      testSession = loginResult.session;
      tokens = loginResult.tokens;
      
      // Get device from session
      if (testSession.deviceId) {
        testDevice = await Device.findById(testSession.deviceId);
      }
      
      // Override access token expiry to a very short time (1 second)
      const originalExpiry = tokenConfig.expiry.access;
      tokenConfig.expiry.access = 1; // 1 second
      
      // Generate a short-lived access token
      const shortLivedToken = await tokenService.generateAccessToken({
        sub: testUser._id.toString(),
        sessionId: testSession._id.toString(),
        deviceId: testDevice.deviceId,
        role: testUser.role
      });
      
      // Wait for token to expire
      await sleep(1500); // 1.5 seconds
      
      // Verify token is expired
      try {
        await tokenService.verifyAccessToken(shortLivedToken);
        // Should not reach here
        expect.fail('Token should have expired');
      } catch (error) {
        expect(error.name).to.equal('TokenExpiredError');
      }
      
      // Refresh token
      const refreshResult = await tokenService.refreshToken(tokens.refreshToken, mockRes);
      
      // Verify new tokens were generated
      expect(refreshResult.accessToken).to.be.a('string');
      expect(refreshResult.refreshToken).to.be.a('string');
      expect(refreshResult.accessToken).to.not.equal(tokens.accessToken);
      
      // Verify new access token is valid
      const verifiedToken = await tokenService.verifyAccessToken(refreshResult.accessToken);
      expect(verifiedToken).to.be.an('object');
      expect(verifiedToken.sub).to.equal(testUser._id.toString());
      
      // Restore original expiry
      tokenConfig.expiry.access = originalExpiry;
    });
    
    it('should handle refresh token expiration', async () => {
      // Create mock response object to capture cookies
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
      
      // Login with test device
      const loginResult = await authService.login(
        testUser.email,
        'Test123!',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Test User Agent',
          deviceInfo: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        },
        true, // rememberMe
        mockRes // Pass mock response to capture cookies
      );
      
      // Store session and tokens
      testSession = loginResult.session;
      tokens = loginResult.tokens;
      
      // Get device from session
      if (testSession.deviceId) {
        testDevice = await Device.findById(testSession.deviceId);
      }
      
      // Override refresh token expiry to a very short time (1 second)
      const originalExpiry = tokenConfig.expiry.refresh;
      tokenConfig.expiry.refresh = 1; // 1 second
      
      // Generate a short-lived refresh token
      const shortLivedToken = await tokenService.generateRefreshToken({
        sub: testUser._id.toString(),
        sessionId: testSession._id.toString(),
        deviceId: testDevice.deviceId
      });
      
      // Wait for token to expire
      await sleep(1500); // 1.5 seconds
      
      // Try to refresh with expired token
      try {
        await tokenService.refreshToken(shortLivedToken, mockRes);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect(error.name).to.equal('TokenExpiredError');
      }
      
      // Restore original expiry
      tokenConfig.expiry.refresh = originalExpiry;
    });
  });
  
  describe('Concurrent Login Attempts', () => {
    it('should handle concurrent login attempts from the same device', async () => {
      // Create device info with same fingerprint for both logins
      const deviceFingerprint = crypto.randomBytes(16).toString('hex');
      const deviceInfo = {
        name: 'Test Device',
        fingerprint: deviceFingerprint,
        browser: 'Test Browser',
        os: 'Test OS',
        device: 'Desktop',
      };
      
      // Start multiple login attempts concurrently
      const loginPromises = [];
      
      for (let i = 0; i < 3; i++) {
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
            testUser.email,
            'Test123!',
            {
              ipAddress: '192.168.1.100',
              userAgent: 'Test User Agent',
              deviceInfo: deviceInfo,
            },
            true, // rememberMe
            mockRes // Pass mock response to capture cookies
          )
        );
      }
      
      // Wait for all login attempts to complete
      const results = await Promise.all(loginPromises);
      
      // Verify all login attempts succeeded
      for (const result of results) {
        expect(result).to.be.an('object');
        expect(result.session).to.be.an('object');
        expect(result.tokens).to.be.an('object');
      }
      
      // Verify only one device was created
      const devices = await Device.find({ userId: testUser._id });
      expect(devices.length).to.equal(1);
      expect(devices[0].fingerprint).to.equal(deviceFingerprint);
      
      // Verify all sessions use the same device
      const sessions = await Session.find({ userId: testUser._id });
      expect(sessions.length).to.equal(results.length);
      
      for (const session of sessions) {
        expect(session.deviceId.toString()).to.equal(devices[0]._id.toString());
      }
    });
    
    it('should handle concurrent login attempts from different devices', async () => {
      // Start multiple login attempts concurrently with different fingerprints
      const loginPromises = [];
      
      for (let i = 0; i < 3; i++) {
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
            testUser.email,
            'Test123!',
            {
              ipAddress: `192.168.1.${100 + i}`,
              userAgent: `Test User Agent ${i}`,
              deviceInfo: {
                name: `Test Device ${i}`,
                fingerprint: crypto.randomBytes(16).toString('hex'), // Different fingerprint for each device
                browser: `Test Browser ${i}`,
                os: 'Test OS',
                device: 'Desktop',
              },
            },
            true, // rememberMe
            mockRes // Pass mock response to capture cookies
          )
        );
      }
      
      // Wait for all login attempts to complete
      const results = await Promise.all(loginPromises);
      
      // Verify all login attempts succeeded
      for (const result of results) {
        expect(result).to.be.an('object');
        expect(result.session).to.be.an('object');
        expect(result.tokens).to.be.an('object');
      }
      
      // Verify multiple devices were created
      const devices = await Device.find({ userId: testUser._id });
      expect(devices.length).to.equal(3);
      
      // Verify each session uses a different device
      const sessions = await Session.find({ userId: testUser._id });
      expect(sessions.length).to.equal(results.length);
      
      const deviceIds = new Set();
      for (const session of sessions) {
        deviceIds.add(session.deviceId.toString());
      }
      
      expect(deviceIds.size).to.equal(3);
    });
  });
  
  describe('Invalid Token Handling', () => {
    it('should reject malformed access tokens', async () => {
      try {
        await tokenService.verifyAccessToken('malformed-token');
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect(error.name).to.equal('JsonWebTokenError');
      }
    });
    
    it('should reject malformed refresh tokens', async () => {
      try {
        await tokenService.verifyRefreshToken('malformed-token');
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect(error.name).to.equal('JsonWebTokenError');
      }
    });
    
    it('should reject tokens with invalid signature', async () => {
      // Create mock response object to capture cookies
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
      
      // Login with test device
      const loginResult = await authService.login(
        testUser.email,
        'Test123!',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Test User Agent',
          deviceInfo: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        },
        true, // rememberMe
        mockRes // Pass mock response to capture cookies
      );
      
      // Store tokens
      tokens = loginResult.tokens;
      
      // Tamper with the token
      const parts = tokens.accessToken.split('.');
      const header = parts[0];
      const payload = parts[1];
      const tamperedSignature = 'invalid-signature';
      const tamperedToken = `${header}.${payload}.${tamperedSignature}`;
      
      // Verify tampered token is rejected
      try {
        await tokenService.verifyAccessToken(tamperedToken);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect(error.name).to.equal('JsonWebTokenError');
        expect(error.message).to.equal('invalid signature');
      }
    });
    
    it('should reject tokens for non-existent users', async () => {
      // Create a token for a non-existent user
      const nonExistentUserId = new mongoose.Types.ObjectId();
      
      const token = await tokenService.generateAccessToken({
        sub: nonExistentUserId.toString(),
        sessionId: new mongoose.Types.ObjectId().toString(),
        deviceId: 'test-device-id',
        role: 'support'
      });
      
      // Verify token is valid (JWT verification doesn't check if user exists)
      const verifiedToken = await tokenService.verifyAccessToken(token);
      expect(verifiedToken).to.be.an('object');
      expect(verifiedToken.sub).to.equal(nonExistentUserId.toString());
      
      // But using the token for authentication should fail
      try {
        await authService.getUserFromToken(token);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('User not found');
      }
    });
  });
  
  describe('Session Timeout Handling', () => {
    it('should handle session expiry correctly', async () => {
      // Create mock response object to capture cookies
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
      
      // Login with test device
      const loginResult = await authService.login(
        testUser.email,
        'Test123!',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Test User Agent',
          deviceInfo: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        },
        true, // rememberMe
        mockRes // Pass mock response to capture cookies
      );
      
      // Store session and tokens
      testSession = loginResult.session;
      tokens = loginResult.tokens;
      
      // Set session to expire soon
      await Session.findByIdAndUpdate(testSession.id, {
        $set: {
          expiresAt: new Date(Date.now() + 1000) // 1 second from now
        }
      });
      
      // Wait for session to expire
      await sleep(1500); // 1.5 seconds
      
      // Run cleanup to mark expired sessions
      await sessionService.cleanupExpiredSessions();
      
      // Check if session is marked as expired
      const expiredSession = await Session.findById(testSession.id);
      expect(expiredSession.status).to.equal('expired');
      
      // Try to use the token associated with expired session
      try {
        await authService.getUserFromToken(tokens.accessToken);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('Session expired');
      }
    });
    
    it('should detect idle timeout and issue warnings', async () => {
      // Create mock response object to capture cookies
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
      
      // Login with test device
      const loginResult = await authService.login(
        testUser.email,
        'Test123!',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Test User Agent',
          deviceInfo: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        },
        true, // rememberMe
        mockRes // Pass mock response to capture cookies
      );
      
      // Store session and tokens
      testSession = loginResult.session;
      tokens = loginResult.tokens;
      
      // Get device from session
      if (testSession.deviceId) {
        testDevice = await Device.findById(testSession.deviceId);
      }
      
      // Set session last activity to be old
      const oldActivity = new Date(Date.now() - 25 * 60 * 1000); // 25 minutes ago
      await Session.findByIdAndUpdate(testSession.id, {
        $set: {
          lastActivity: oldActivity
        }
      });
      
      // Get session timeout info
      const timeoutInfo = await sessionService.getSessionTimeoutInfo(testSession.id);
      
      // Verify idle time is detected
      expect(timeoutInfo.idleTime).to.be.closeTo(25 * 60, 5); // 25 minutes in seconds, with 5 second tolerance
      
      // Verify session is approaching idle timeout
      expect(timeoutInfo.isApproachingIdleTimeout).to.be.true;
    });
  });
  
  describe('Revoked Token Handling', () => {
    it('should reject revoked refresh tokens', async () => {
      // Create mock response object to capture cookies
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
      
      // Login with test device
      const loginResult = await authService.login(
        testUser.email,
        'Test123!',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Test User Agent',
          deviceInfo: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        },
        true, // rememberMe
        mockRes // Pass mock response to capture cookies
      );
      
      // Store session and tokens
      testSession = loginResult.session;
      tokens = loginResult.tokens;
      
      // Revoke the refresh token
      await tokenService.revokeToken(testSession.id);
      
      // Try to use the revoked token
      try {
        await tokenService.refreshToken(tokens.refreshToken, mockRes);
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('revoked');
      }
    });
  });
});
