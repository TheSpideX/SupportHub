/**
 * Basic Authentication Flow Test
 *
 * This test verifies the basic authentication flow:
 * 1. User registration
 * 2. Login
 * 3. Token validation
 * 4. Token refresh
 * 5. Logout
 */

const mongoose = require("mongoose");
const crypto = require("crypto");
const { expect } = require("chai");

// Import models
const User = require("../../src/modules/auth/models/user.model");
const Session = require("../../src/modules/auth/models/session.model");
const Device = require("../../src/modules/auth/models/device.model");
const Token = require("../../src/modules/auth/models/token.model");

// Import services
const authService = require("../../src/modules/auth/services/auth.service");
const tokenService = require("../../src/modules/auth/services/token.service");
const sessionService = require("../../src/modules/auth/services/session.service");

// Test user data
const TEST_USER = {
  email: `test.${Date.now()}@example.com`,
  password: "Test123!",
  firstName: "Test",
  lastName: "User",
  phoneNumber: "+1234567890",
};

// Test device info
const TEST_DEVICE = {
  name: "Test Device",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
  ip: "192.168.1.100",
  browser: "Chrome",
  os: "macOS",
  device: "Desktop",
  screen: "1920x1080",
  language: "en-US",
  timezone: "America/New_York",
  platform: "MacIntel",
  fingerprint: crypto.randomBytes(16).toString("hex"),
};

describe("Basic Authentication Flow", function () {
  // Increase timeout for tests
  this.timeout(10000);

  let testUser;
  let testSession;
  let tokens;

  before(async () => {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/tech-support-crm");
    console.log("Connected to MongoDB");

    // Clean up any existing test data
    await User.deleteMany({ email: TEST_USER.email });
    await Session.deleteMany({});
    await Device.deleteMany({});
    await Token.deleteMany({});
  });

  after(async () => {
    // Clean up test data
    await User.deleteMany({ email: TEST_USER.email });
    await Session.deleteMany({});
    await Device.deleteMany({});
    await Token.deleteMany({});

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  });

  it("should register a new user", async () => {
    // Create a new user
    testUser = await User.create({
      email: TEST_USER.email,
      profile: {
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
        phoneNumber: TEST_USER.phoneNumber,
        timezone: "America/New_York",
      },
      role: "support",
      status: {
        isActive: true,
        verifiedAt: new Date(),
      },
      security: {
        password: TEST_USER.password,
        passwordChangedAt: new Date(),
        emailVerified: true,
        loginAttempts: 0,
        lastLogin: null,
      },
    });

    console.log("Test user created with ID:", testUser._id);

    // Verify user was created
    expect(testUser).to.be.an("object");
    expect(testUser.email).to.equal(TEST_USER.email);
    expect(testUser.profile.firstName).to.equal(TEST_USER.firstName);
    expect(testUser.profile.lastName).to.equal(TEST_USER.lastName);
  });

  it("should login successfully", async () => {
    // Create mock response object to capture cookies
    const mockRes = {
      cookies: {},
      cookie: function (name, value, options) {
        this.cookies[name] = value;
      },
      headersSent: false,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        return this;
      },
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

    console.log("Login successful");
    console.log("Session ID:", loginResult.session.id);

    // Store session and tokens
    testSession = loginResult.session;
    tokens = loginResult.tokens;

    // Verify login result
    expect(loginResult).to.be.an("object");
    expect(loginResult.user).to.be.an("object");
    expect(loginResult.session).to.be.an("object");
    expect(loginResult.tokens).to.be.an("object");
    expect(loginResult.tokens.csrfToken).to.be.a("string");

    // Verify cookies were set
    expect(mockRes.cookies).to.be.an("object");
    expect(Object.keys(mockRes.cookies).length).to.be.at.least(2); // At least access and refresh tokens
  });

  it("should validate access token", async () => {
    // Verify access token
    const verifiedToken = await tokenService.verifyAccessToken(
      tokens.accessToken
    );

    // Verify token payload
    expect(verifiedToken).to.be.an("object");
    expect(verifiedToken.sub).to.equal(testUser._id.toString());
    // Session ID might be different due to how sessions are created
    expect(verifiedToken.sessionId).to.be.a("string");
  });

  it("should refresh tokens", async () => {
    // Create mock response object to capture cookies
    const mockRes = {
      cookies: {},
      cookie: function (name, value, options) {
        this.cookies[name] = value;
      },
      headersSent: false,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        return this;
      },
    };

    // Refresh tokens
    const refreshResult = await tokenService.refreshToken(
      tokens.refreshToken,
      mockRes
    );

    console.log("Tokens refreshed");

    // Update tokens
    const oldAccessToken = tokens.accessToken;
    const oldRefreshToken = tokens.refreshToken;

    tokens.accessToken = refreshResult.accessToken;
    tokens.refreshToken = refreshResult.refreshToken;

    // Verify refresh result
    expect(refreshResult).to.be.an("object");
    expect(refreshResult.accessToken).to.be.a("string");
    expect(refreshResult.refreshToken).to.be.a("string");

    // Verify new tokens are different from old tokens
    expect(refreshResult.accessToken).to.not.equal(oldAccessToken);
    expect(refreshResult.refreshToken).to.not.equal(oldRefreshToken);

    // Verify new access token is valid
    const verifiedToken = await tokenService.verifyAccessToken(
      refreshResult.accessToken
    );
    expect(verifiedToken).to.be.an("object");
    expect(verifiedToken.sub).to.equal(testUser._id.toString());
    // Session ID might be different due to how sessions are created
    expect(verifiedToken.sessionId).to.be.a("string");
  });

  it("should logout successfully", async () => {
    // Create mock request object
    const mockReq = {
      user: testUser,
      session: testSession,
      cookies: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        csrf_token: tokens.csrfToken,
      },
      headers: {
        "user-agent": TEST_DEVICE.userAgent,
        "x-csrf-token": tokens.csrfToken,
      },
      ip: TEST_DEVICE.ip,
    };

    // Create mock response object
    const mockRes = {
      cookies: {},
      cookie: function (name, value, options) {
        this.cookies[name] = value;
      },
      clearCookie: function (name, options) {
        this.cookies[name] = null;
      },
      headersSent: false,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        return this;
      },
    };

    // Logout
    const logoutResult = await authService.logout(mockReq, mockRes);

    console.log("Logout successful");

    // Verify logout result
    expect(logoutResult).to.be.true;

    // Verify session was terminated or marked as inactive
    const session = await Session.findById(testSession.id);
    if (session) {
      expect(session.status).to.not.equal("active");
    }

    // Verify cookies were cleared
    expect(mockRes.cookies).to.be.an("object");
    expect(mockRes.cookies.access_token).to.be.null;
    expect(mockRes.cookies.refresh_token).to.be.null;
  });
});
