/**
 * Unit Tests for Token Service
 *
 * Tests all functions of the token service in isolation:
 * - Token generation
 * - Token validation
 * - Token refresh
 * - Token revocation
 * - CSRF token handling
 */

const mongoose = require("mongoose");
const { expect } = require("chai");
const sinon = require("sinon");
const jwt = require("jsonwebtoken");
const { redisMock } = require("../../setup");

// Import the token service
const tokenService = require("../../../src/modules/auth/services/token.service");
const Token = require("../../../src/modules/auth/models/token.model");
const User = require("../../../src/modules/auth/models/user.model");
const sessionService = require("../../../src/modules/auth/services/session.service");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { redisClient } = redisMock;

describe("Token Service Unit Tests", () => {
  let testUser;
  let testPayload;
  let sandbox;

  before(async () => {
    // Connect to test database
    await mongoose.connect("mongodb://localhost:27017/tech-support-crm-test");

    // Create a test user
    testUser = new User({
      email: "test@example.com",
      profile: {
        firstName: "Test",
        lastName: "User",
        phoneNumber: "+1234567890",
        timezone: "America/New_York",
      },
      role: "support",
      status: {
        isActive: true,
        verifiedAt: new Date(),
      },
      security: {
        password: "Test123!",
        passwordChangedAt: new Date(),
        emailVerified: true,
        loginAttempts: 0,
        lastLogin: null,
      },
    });

    // Create test payload
    testPayload = {
      sub: testUser._id.toString(),
      sessionId: new mongoose.Types.ObjectId().toString(),
      deviceId: "test-device-id",
      role: testUser.role,
    };
  });

  beforeEach(() => {
    // Create a sandbox for stubs
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    // Restore stubs
    sandbox.restore();

    // Call the service cleanup function
    tokenService.cleanup();
  });

  after(async () => {
    // Clean up and disconnect
    await Token.deleteMany({});
    await mongoose.connection.close();
  });

  describe("generateToken", () => {
    it("should generate a valid token", async () => {
      // Stub the internal generateToken function to make it testable
      sandbox.stub(jwt, "sign").returns("test-token");

      // Act
      const token = tokenService.generateToken(testPayload, "access");

      // Assert
      expect(token).to.equal("test-token");
      expect(jwt.sign.calledOnce).to.be.true;

      // Verify the payload was passed correctly
      const signArgs = jwt.sign.firstCall.args;
      expect(signArgs[0]).to.include(testPayload);
    });
  });

  describe("generateAuthTokens", () => {
    it("should generate auth tokens for a user", async () => {
      // Arrange
      sandbox.stub(tokenService, "generateToken").returns("test-token");
      sandbox.stub(crypto, "randomBytes").returns({
        toString: () => "test-csrf-token",
      });
      sandbox.stub(sessionService, "getSessionById").resolves({
        id: testPayload.sessionId,
        userId: testUser._id,
        toObject: () => ({
          id: testPayload.sessionId,
          userId: testUser._id,
        }),
      });
      sandbox.stub(redisClient, "set").resolves("OK");

      // Act
      const result = await tokenService.generateAuthTokens(testUser, {
        sessionId: testPayload.sessionId,
      });

      // Assert
      expect(result).to.be.an("object");
      expect(result.accessToken).to.equal("test-token");
      expect(result.refreshToken).to.equal("test-token");
      expect(result.csrfToken).to.equal("test-csrf-token");
      expect(result.session).to.be.an("object");
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid refresh token", async () => {
      // Act
      const token = await tokenService.generateRefreshToken(testPayload);

      // Assert
      expect(token).to.be.a("string");

      // Verify token contents
      const decoded = jwt.decode(token);
      expect(decoded.sub).to.equal(testPayload.sub);
      expect(decoded.sessionId).to.equal(testPayload.sessionId);
      expect(decoded.deviceId).to.equal(testPayload.deviceId);
    });

    it("should set the correct expiry time", async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);

      // Act
      const token = await tokenService.generateRefreshToken(testPayload);

      // Assert
      const decoded = jwt.decode(token);

      // Token should expire in the future (default is 7 days)
      expect(decoded.exp).to.be.greaterThan(now);

      // Token should expire within reasonable time (7 days + small buffer)
      expect(decoded.exp).to.be.lessThan(now + 7 * 24 * 60 * 60 + 10);
    });

    it("should store the token in the database", async () => {
      // Arrange
      sandbox.stub(Token, "create").resolves({ _id: "test-token-id" });

      // Act
      await tokenService.generateRefreshToken(testPayload);

      // Assert
      expect(Token.create.calledOnce).to.be.true;
      const createArgs = Token.create.firstCall.args[0];
      expect(createArgs.userId).to.equal(testPayload.sub);
      expect(createArgs.sessionId).to.equal(testPayload.sessionId);
      expect(createArgs.deviceId).to.equal(testPayload.deviceId);
      expect(createArgs.type).to.equal("refresh");
    });
  });

  describe("generateCsrfToken", () => {
    it("should generate a valid CSRF token", async () => {
      // Act
      const token = await tokenService.generateCsrfToken();

      // Assert
      expect(token).to.be.a("string");
      expect(token.length).to.be.at.least(32); // Should be reasonably long
    });
  });

  describe("verifyToken", () => {
    it("should verify a valid token", async () => {
      // Arrange
      sandbox.stub(jwt, "verify").returns(testPayload);
      sandbox.stub(tokenService, "isTokenBlacklisted").resolves(false);

      // Act
      const result = await tokenService.verifyToken("test-token", "access");

      // Assert
      expect(result).to.deep.equal(testPayload);
      expect(jwt.verify.calledOnce).to.be.true;
      expect(tokenService.isTokenBlacklisted.calledOnce).to.be.true;
    });

    it("should reject a blacklisted token", async () => {
      // Arrange
      sandbox.stub(jwt, "verify").returns(testPayload);
      sandbox.stub(tokenService, "isTokenBlacklisted").resolves(true);

      // Act & Assert
      try {
        await tokenService.verifyToken("test-token", "access");
        // Should not reach here
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include("blacklisted");
      }
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify a valid access token", async () => {
      // Arrange
      const token = await tokenService.generateAccessToken(testPayload);

      // Act
      const result = await tokenService.verifyAccessToken(token);

      // Assert
      expect(result).to.be.an("object");
      expect(result.sub).to.equal(testPayload.sub);
      expect(result.sessionId).to.equal(testPayload.sessionId);
      expect(result.deviceId).to.equal(testPayload.deviceId);
    });

    it("should reject an invalid access token", async () => {
      // Act & Assert
      try {
        await tokenService.verifyAccessToken("invalid-token");
        // Should not reach here
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it("should reject an expired access token", async () => {
      // Arrange
      sandbox
        .stub(jwt, "verify")
        .throws(new jwt.TokenExpiredError("Token expired", new Date()));

      // Act & Assert
      try {
        await tokenService.verifyAccessToken("expired-token");
        // Should not reach here
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        expect(error.name).to.equal("TokenExpiredError");
      }
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify a valid refresh token", async () => {
      // Arrange
      const token = await tokenService.generateRefreshToken(testPayload);
      sandbox.stub(Token, "findOne").resolves({
        _id: "test-token-id",
        userId: testPayload.sub,
        sessionId: testPayload.sessionId,
        deviceId: testPayload.deviceId,
        isRevoked: false,
      });

      // Act
      const result = await tokenService.verifyRefreshToken(token);

      // Assert
      expect(result).to.be.an("object");
      expect(result.sub).to.equal(testPayload.sub);
      expect(result.sessionId).to.equal(testPayload.sessionId);
      expect(result.deviceId).to.equal(testPayload.deviceId);
    });

    it("should reject a revoked refresh token", async () => {
      // Arrange
      const token = await tokenService.generateRefreshToken(testPayload);
      sandbox.stub(Token, "findOne").resolves({
        _id: "test-token-id",
        userId: testPayload.sub,
        sessionId: testPayload.sessionId,
        deviceId: testPayload.deviceId,
        isRevoked: true,
      });

      // Act & Assert
      try {
        await tokenService.verifyRefreshToken(token);
        // Should not reach here
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include("revoked");
      }
    });

    it("should reject a non-existent refresh token", async () => {
      // Arrange
      const token = await tokenService.generateRefreshToken(testPayload);
      sandbox.stub(Token, "findOne").resolves(null);

      // Act & Assert
      try {
        await tokenService.verifyRefreshToken(token);
        // Should not reach here
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include("not found");
      }
    });
  });

  describe("refreshToken", () => {
    it("should refresh tokens when given a valid refresh token", async () => {
      // Arrange
      const refreshToken = await tokenService.generateRefreshToken(testPayload);

      sandbox.stub(tokenService, "verifyRefreshToken").resolves(testPayload);
      sandbox
        .stub(tokenService, "generateAccessToken")
        .resolves("new-access-token");
      sandbox
        .stub(tokenService, "generateRefreshToken")
        .resolves("new-refresh-token");
      sandbox
        .stub(tokenService, "generateCsrfToken")
        .resolves("new-csrf-token");

      const mockRes = {
        cookie: sinon.stub(),
      };

      // Act
      const result = await tokenService.refreshToken(refreshToken, mockRes);

      // Assert
      expect(result).to.be.an("object");
      expect(result.accessToken).to.equal("new-access-token");
      expect(result.refreshToken).to.equal("new-refresh-token");
      expect(result.csrfToken).to.equal("new-csrf-token");

      // Verify cookies were set
      expect(mockRes.cookie.callCount).to.be.at.least(3);
    });

    it("should throw an error when given an invalid refresh token", async () => {
      // Arrange
      sandbox
        .stub(tokenService, "verifyRefreshToken")
        .rejects(new Error("Invalid token"));

      // Act & Assert
      try {
        await tokenService.refreshToken("invalid-token");
        // Should not reach here
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.equal("Invalid token");
      }
    });
  });

  describe("revokeToken", () => {
    it("should revoke a token", async () => {
      // Arrange
      sandbox.stub(Token, "findOneAndUpdate").resolves({
        _id: "test-token-id",
        isRevoked: true,
      });

      // Act
      const result = await tokenService.revokeToken(testPayload.sessionId);

      // Assert
      expect(result).to.be.true;
      expect(Token.findOneAndUpdate.calledOnce).to.be.true;

      const updateArgs = Token.findOneAndUpdate.firstCall.args;
      expect(updateArgs[0].sessionId).to.equal(testPayload.sessionId);
      expect(updateArgs[1].isRevoked).to.be.true;
    });

    it("should handle non-existent token gracefully", async () => {
      // Arrange
      sandbox.stub(Token, "findOneAndUpdate").resolves(null);

      // Act
      const result = await tokenService.revokeToken("non-existent-session");

      // Assert
      expect(result).to.be.false;
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should revoke all tokens for a user", async () => {
      // Arrange
      sandbox.stub(Token, "updateMany").resolves({
        modifiedCount: 3,
      });

      // Act
      const result = await tokenService.revokeAllUserTokens(testPayload.sub);

      // Assert
      expect(result).to.equal(3);
      expect(Token.updateMany.calledOnce).to.be.true;

      const updateArgs = Token.updateMany.firstCall.args;
      expect(updateArgs[0].userId).to.equal(testPayload.sub);
      expect(updateArgs[1].isRevoked).to.be.true;
    });
  });

  describe("clearTokens", () => {
    it("should clear tokens from response cookies", async () => {
      // Arrange
      const mockRes = {
        clearCookie: sinon.stub(),
      };

      // Act
      await tokenService.clearTokens(mockRes);

      // Assert
      expect(mockRes.clearCookie.callCount).to.be.at.least(3);
    });
  });
});
