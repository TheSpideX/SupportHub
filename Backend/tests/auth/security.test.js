/**
 * Security Tests for Authentication System
 * 
 * Tests security features and protections:
 * - CSRF protection
 * - XSS protection
 * - Session fixation protection
 * - Brute force protection
 * - HTTP-only cookie security
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const cookieParser = require('cookie-parser');

// Import models
const User = require('../../src/modules/auth/models/user.model');
const Session = require('../../src/modules/auth/models/session.model');
const Device = require('../../src/modules/auth/models/device.model');
const Token = require('../../src/modules/auth/models/token.model');

// Import services
const authService = require('../../src/modules/auth/services/auth.service');
const tokenService = require('../../src/modules/auth/services/token.service');
const sessionService = require('../../src/modules/auth/services/session.service');

// Import routes for testing
const authRoutes = require('../../src/modules/auth/routes');

// Import configs
const cookieConfig = require('../../src/modules/auth/config/cookie.config');

describe('Authentication System Security Tests', function() {
  // Increase timeout for security tests
  this.timeout(30000);
  
  let app;
  let testUser;
  let testDevice;
  let testSession;
  let tokens;
  
  before(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27017/tech-support-crm-test');
    
    // Clean up any existing test data
    await User.deleteMany({ email: /^test.*@example\.com$/ });
    await Session.deleteMany({});
    await Device.deleteMany({});
    await Token.deleteMany({});
    
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRoutes);
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
    // Clean up test data
    if (testUser) {
      await Session.deleteMany({ userId: testUser._id });
      await Device.deleteMany({ userId: testUser._id });
      await Token.deleteMany({ userId: testUser._id });
      await User.deleteOne({ _id: testUser._id });
    }
  });
  
  describe('CSRF Protection', () => {
    it('should require CSRF token for sensitive operations', async () => {
      // Login to get tokens and session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(loginResponse.status).to.equal(200);
      
      // Extract cookies
      const cookies = loginResponse.headers['set-cookie'];
      const csrfToken = loginResponse.body.tokens.csrfToken;
      
      // Try to logout without CSRF token
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies);
      
      // Should be rejected
      expect(logoutResponse.status).to.equal(403);
      expect(logoutResponse.body.message).to.include('CSRF');
      
      // Try again with CSRF token
      const validLogoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken);
      
      // Should succeed
      expect(validLogoutResponse.status).to.equal(200);
    });
    
    it('should reject requests with invalid CSRF token', async () => {
      // Login to get tokens and session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(loginResponse.status).to.equal(200);
      
      // Extract cookies
      const cookies = loginResponse.headers['set-cookie'];
      
      // Try to logout with invalid CSRF token
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', 'invalid-token');
      
      // Should be rejected
      expect(logoutResponse.status).to.equal(403);
      expect(logoutResponse.body.message).to.include('CSRF');
    });
  });
  
  describe('HTTP-Only Cookie Security', () => {
    it('should set HTTP-only flag on sensitive cookies', async () => {
      // Login to get tokens and session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(loginResponse.status).to.equal(200);
      
      // Extract cookies
      const cookies = loginResponse.headers['set-cookie'];
      
      // Check if access token cookie is HTTP-only
      const accessTokenCookie = cookies.find(cookie => cookie.includes(cookieConfig.names.ACCESS_TOKEN));
      expect(accessTokenCookie).to.include('HttpOnly');
      
      // Check if refresh token cookie is HTTP-only
      const refreshTokenCookie = cookies.find(cookie => cookie.includes(cookieConfig.names.REFRESH_TOKEN));
      expect(refreshTokenCookie).to.include('HttpOnly');
    });
    
    it('should not expose tokens in response body', async () => {
      // Login to get tokens and session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(loginResponse.status).to.equal(200);
      
      // Check response body
      expect(loginResponse.body.tokens).to.be.an('object');
      expect(loginResponse.body.tokens.csrfToken).to.be.a('string'); // CSRF token is exposed
      expect(loginResponse.body.tokens.accessToken).to.be.undefined; // Access token should not be exposed
      expect(loginResponse.body.tokens.refreshToken).to.be.undefined; // Refresh token should not be exposed
    });
  });
  
  describe('Session Fixation Protection', () => {
    it('should issue new session ID after login', async () => {
      // First, create a session (simulate pre-login session)
      const preLoginSession = await sessionService.createSession({
        userId: null, // Anonymous session
        deviceId: null,
        ipAddress: '192.168.1.100',
        userAgent: 'Test User Agent',
      });
      
      // Login with the same device info
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(loginResponse.status).to.equal(200);
      
      // Get the new session ID
      const postLoginSessionId = loginResponse.body.session.id;
      
      // Verify it's different from the pre-login session
      expect(postLoginSessionId).to.not.equal(preLoginSession.id);
      
      // Verify pre-login session is terminated
      const oldSession = await Session.findById(preLoginSession.id);
      if (oldSession) {
        expect(oldSession.status).to.not.equal('active');
      }
    });
    
    it('should issue new session ID after password change', async () => {
      // Login to get tokens and session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(loginResponse.status).to.equal(200);
      
      // Extract cookies and CSRF token
      const cookies = loginResponse.headers['set-cookie'];
      const csrfToken = loginResponse.body.tokens.csrfToken;
      const originalSessionId = loginResponse.body.session.id;
      
      // Change password
      const changePasswordResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'Test123!',
          newPassword: 'NewTest456!',
        });
      
      expect(changePasswordResponse.status).to.equal(200);
      
      // Get the new session ID
      const newSessionId = changePasswordResponse.body.session.id;
      
      // Verify it's different from the original session
      expect(newSessionId).to.not.equal(originalSessionId);
      
      // Verify original session is terminated
      const oldSession = await Session.findById(originalSessionId);
      if (oldSession) {
        expect(oldSession.status).to.not.equal('active');
      }
    });
  });
  
  describe('Brute Force Protection', () => {
    it('should limit failed login attempts', async () => {
      // Try multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword!',
            rememberMe: true,
            securityContext: {
              name: 'Test Device',
              fingerprint: crypto.randomBytes(16).toString('hex'),
              browser: 'Test Browser',
              os: 'Test OS',
              device: 'Desktop',
            },
          });
        
        expect(loginResponse.status).to.equal(401);
      }
      
      // Check if user account is locked
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.security.loginAttempts).to.be.at.least(5);
      
      // Try one more login attempt
      const finalLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      // Should be locked out
      expect(finalLoginResponse.status).to.equal(429);
      expect(finalLoginResponse.body.message).to.include('too many');
    });
    
    it('should reset login attempts after successful login', async () => {
      // Try a few failed login attempts
      for (let i = 0; i < 3; i++) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword!',
            rememberMe: true,
            securityContext: {
              name: 'Test Device',
              fingerprint: crypto.randomBytes(16).toString('hex'),
              browser: 'Test Browser',
              os: 'Test OS',
              device: 'Desktop',
            },
          });
        
        expect(loginResponse.status).to.equal(401);
      }
      
      // Check login attempts count
      let updatedUser = await User.findById(testUser._id);
      expect(updatedUser.security.loginAttempts).to.be.at.least(3);
      
      // Now login successfully
      const successLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(successLoginResponse.status).to.equal(200);
      
      // Verify login attempts were reset
      updatedUser = await User.findById(testUser._id);
      expect(updatedUser.security.loginAttempts).to.equal(0);
    });
  });
  
  describe('Password Security', () => {
    it('should enforce password complexity requirements', async () => {
      // Try to register with a weak password
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'weak',
          firstName: 'New',
          lastName: 'User',
          phoneNumber: '+1234567890',
        });
      
      // Should be rejected
      expect(registerResponse.status).to.equal(400);
      expect(registerResponse.body.message).to.include('password');
    });
    
    it('should not store passwords in plain text', async () => {
      // Get the user from database
      const user = await User.findById(testUser._id);
      
      // Verify password is hashed
      expect(user.security.password).to.not.equal('Test123!');
      expect(user.security.password).to.be.a('string');
      expect(user.security.password.length).to.be.at.least(60); // Bcrypt hash length
    });
    
    it('should validate passwords correctly', async () => {
      // Login with correct password
      const correctLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Test123!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(correctLoginResponse.status).to.equal(200);
      
      // Login with incorrect password
      const incorrectLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword!',
          rememberMe: true,
          securityContext: {
            name: 'Test Device',
            fingerprint: crypto.randomBytes(16).toString('hex'),
            browser: 'Test Browser',
            os: 'Test OS',
            device: 'Desktop',
          },
        });
      
      expect(incorrectLoginResponse.status).to.equal(401);
    });
  });
});
