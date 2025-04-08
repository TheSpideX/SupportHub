/**
 * Unit Tests for Session Service
 *
 * Tests all functions of the session service in isolation:
 * - Session creation
 * - Session validation
 * - Session termination
 * - Session activity tracking
 */

const mongoose = require("mongoose");
const { expect } = require("chai");
const sinon = require("sinon");
const { redisMock } = require("../../setup");

// Import the session service
const sessionService = require("../../../src/modules/auth/services/session.service");
const Session = require("../../../src/modules/auth/models/session.model");
const User = require("../../../src/modules/auth/models/user.model");
const Device = require("../../../src/modules/auth/models/device.model");
const tokenService = require("../../../src/modules/auth/services/token.service");
const roomRegistryService = require("../../../src/modules/auth/services/room-registry.service");
const crypto = require("crypto");
const { redisClient } = redisMock;

describe("Session Service Unit Tests", () => {
  let testUser;
  let testDevice;
  let testSession;
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

    // Create a test device
    testDevice = new Device({
      deviceId: "test-device-id",
      userId: testUser._id,
      name: "Test Device",
      fingerprint: "test-fingerprint",
      userAgent: "Test User Agent",
      browser: "Test Browser",
      os: "Test OS",
      deviceType: "desktop",
      isVerified: true,
      verifiedAt: new Date(),
      lastActive: new Date(),
      ipAddresses: ["127.0.0.1"],
      trustScore: 100,
      hierarchyPath: {
        userRoom: `user:${testUser._id}`,
      },
    });

    // Create a test session
    testSession = {
      userId: testUser._id,
      deviceId: testDevice._id,
      ipAddress: "127.0.0.1",
      userAgent: "Test User Agent",
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: "active",
      hierarchyPath: {
        userRoom: `user:${testUser._id}`,
        deviceRoom: `device:${testDevice.deviceId}`,
      },
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
    sessionService.cleanup();
  });

  after(async () => {
    // Clean up and disconnect
    await Session.deleteMany({});
    await mongoose.connection.close();
  });

  describe("createSession", () => {
    it("should create a new session", async () => {
      // Arrange
      const sessionData = {
        userId: testUser._id,
        ipAddress: "127.0.0.1",
        userAgent: "Test User Agent",
        deviceInfo: {
          name: "Test Device",
          fingerprint: "test-fingerprint",
          browser: "Test Browser",
          os: "Test OS",
          device: "Desktop",
        },
      };

      sandbox.stub(Session, "countDocuments").resolves(0); // No active sessions
      sandbox.stub(crypto, "randomBytes").returns({
        toString: () => "test-session-id",
      });
      sandbox.stub(Session, "create").resolves({
        ...testSession,
        _id: new mongoose.Types.ObjectId(),
        toObject: () => ({
          ...testSession,
          _id: new mongoose.Types.ObjectId(),
        }),
      });
      sandbox.stub(redisClient, "set").resolves("OK");

      // Act
      const result = await sessionService.createSession(sessionData);

      // Assert
      expect(result).to.be.an("object");
      expect(result.userId.toString()).to.equal(testUser._id.toString());
      expect(result.isActive).to.be.true;
    });

    it("should handle missing fields gracefully", async () => {
      // Arrange
      const incompleteSessionData = {
        userId: testUser._id,
        // Missing other required fields
      };

      sandbox.stub(Session, "countDocuments").resolves(0);
      sandbox.stub(crypto, "randomBytes").returns({
        toString: () => "test-session-id",
      });
      sandbox.stub(Session, "create").resolves({
        ...testSession,
        _id: new mongoose.Types.ObjectId(),
        toObject: () => ({
          ...testSession,
          _id: new mongoose.Types.ObjectId(),
        }),
      });
      sandbox.stub(redisClient, "set").resolves("OK");

      // Act
      const result = await sessionService.createSession(incompleteSessionData);

      // Assert
      expect(result).to.be.an("object");
      expect(result.userId.toString()).to.equal(testUser._id.toString());
    });
  });

  describe("getSessionById", () => {
    it("should retrieve a session by ID", async () => {
      // Arrange
      const sessionId = new mongoose.Types.ObjectId();
      sandbox.stub(redisClient, "get").resolves(null); // Not in Redis
      sandbox.stub(Session, "findById").resolves({
        ...testSession,
        _id: sessionId,
        toObject: () => ({ ...testSession, _id: sessionId }),
      });
      sandbox.stub(redisClient, "set").resolves("OK");

      // Act
      const result = await sessionService.getSessionById(sessionId);

      // Assert
      expect(result).to.be.an("object");
      expect(result.id).to.equal(sessionId.toString());
      expect(result.userId.toString()).to.equal(testUser._id.toString());
    });

    it("should return a default object for non-existent session", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(redisClient, "get").resolves(null); // Not in Redis
      sandbox.stub(Session, "findById").resolves(null);

      // Act
      const result = await sessionService.getSessionById(nonExistentId);

      // Assert
      expect(result).to.be.an("object");
      expect(result.id).to.equal(nonExistentId.toString());
      expect(result.isActive).to.be.false;
      expect(result.notFound).to.be.true;
    });
  });

  describe("getUserSessions", () => {
    it("should retrieve all sessions for a user", async () => {
      // Arrange
      sandbox.stub(Session, "find").resolves([
        {
          ...testSession,
          _id: new mongoose.Types.ObjectId(),
          toObject: () => ({
            ...testSession,
            _id: new mongoose.Types.ObjectId(),
          }),
        },
        {
          ...testSession,
          _id: new mongoose.Types.ObjectId(),
          toObject: () => ({
            ...testSession,
            _id: new mongoose.Types.ObjectId(),
          }),
        },
      ]);

      // Act
      const result = await sessionService.getUserSessions(testUser._id);

      // Assert
      expect(result).to.be.an("array");
      expect(result.length).to.equal(2);
      expect(result[0].userId.toString()).to.equal(testUser._id.toString());
      expect(result[1].userId.toString()).to.equal(testUser._id.toString());
    });

    it("should return empty array for user with no sessions", async () => {
      // Arrange
      sandbox.stub(Session, "find").resolves([]);

      // Act
      const result = await sessionService.getUserSessions(testUser._id);

      // Assert
      expect(result).to.be.an("array");
      expect(result.length).to.equal(0);
    });
  });

  describe("updateSessionActivity", () => {
    it("should update session last activity time", async () => {
      // Arrange
      const sessionId = new mongoose.Types.ObjectId();
      const now = new Date();

      sandbox.stub(Session, "findByIdAndUpdate").resolves({
        ...testSession,
        _id: sessionId,
        lastActivity: now,
        toObject: () => ({ ...testSession, _id: sessionId, lastActivity: now }),
      });

      // Act
      const result = await sessionService.updateSessionActivity(sessionId);

      // Assert
      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(sessionId.toString());
      expect(result.lastActivity).to.deep.equal(now);

      // Verify update was called with correct parameters
      expect(Session.findByIdAndUpdate.calledOnce).to.be.true;
      const updateArgs = Session.findByIdAndUpdate.firstCall.args;
      expect(updateArgs[0].toString()).to.equal(sessionId.toString());
      expect(updateArgs[1].$set.lastActivity).to.exist;
    });

    it("should return null for non-existent session", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(Session, "findByIdAndUpdate").resolves(null);

      // Act
      const result = await sessionService.updateSessionActivity(nonExistentId);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe("terminateSession", () => {
    it("should terminate a session", async () => {
      // Arrange
      const sessionId = new mongoose.Types.ObjectId();

      sandbox.stub(Session, "findById").resolves({
        ...testSession,
        _id: sessionId,
        toObject: () => ({ ...testSession, _id: sessionId }),
      });

      sandbox.stub(Session, "findByIdAndUpdate").resolves({
        ...testSession,
        _id: sessionId,
        status: "terminated",
        toObject: () => ({
          ...testSession,
          _id: sessionId,
          status: "terminated",
        }),
      });

      sandbox.stub(tokenService, "revokeToken").resolves(true);
      sandbox.stub(roomRegistryService, "unregisterSession").resolves();

      // Act
      const result = await sessionService.terminateSession(sessionId);

      // Assert
      expect(result).to.be.true;

      // Verify session was updated
      expect(Session.findByIdAndUpdate.calledOnce).to.be.true;
      const updateArgs = Session.findByIdAndUpdate.firstCall.args;
      expect(updateArgs[0].toString()).to.equal(sessionId.toString());
      expect(updateArgs[1].$set.status).to.equal("terminated");

      // Verify token was revoked
      expect(tokenService.revokeToken.calledOnce).to.be.true;
      expect(tokenService.revokeToken.firstCall.args[0].toString()).to.equal(
        sessionId.toString()
      );

      // Verify session was unregistered
      expect(roomRegistryService.unregisterSession.calledOnce).to.be.true;
    });

    it("should return false for non-existent session", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(Session, "findById").resolves(null);

      // Act
      const result = await sessionService.terminateSession(nonExistentId);

      // Assert
      expect(result).to.be.false;
    });
  });

  describe("terminateAllUserSessions", () => {
    it("should terminate all sessions for a user", async () => {
      // Arrange
      sandbox.stub(Session, "find").resolves([
        {
          ...testSession,
          _id: new mongoose.Types.ObjectId(),
          toObject: () => ({
            ...testSession,
            _id: new mongoose.Types.ObjectId(),
          }),
        },
        {
          ...testSession,
          _id: new mongoose.Types.ObjectId(),
          toObject: () => ({
            ...testSession,
            _id: new mongoose.Types.ObjectId(),
          }),
        },
      ]);

      sandbox.stub(sessionService, "terminateSession").resolves(true);

      // Act
      const result = await sessionService.terminateAllUserSessions(
        testUser._id
      );

      // Assert
      expect(result).to.equal(2);

      // Verify terminateSession was called for each session
      expect(sessionService.terminateSession.callCount).to.equal(2);
    });

    it("should return 0 for user with no sessions", async () => {
      // Arrange
      sandbox.stub(Session, "find").resolves([]);

      // Act
      const result = await sessionService.terminateAllUserSessions(
        testUser._id
      );

      // Assert
      expect(result).to.equal(0);
    });
  });

  describe("terminateAllSessionsExceptCurrent", () => {
    it("should terminate all sessions except the current one", async () => {
      // Arrange
      const currentSessionId = new mongoose.Types.ObjectId();

      sandbox.stub(Session, "find").resolves([
        {
          ...testSession,
          _id: new mongoose.Types.ObjectId(),
          toObject: () => ({
            ...testSession,
            _id: new mongoose.Types.ObjectId(),
          }),
        },
        {
          ...testSession,
          _id: currentSessionId,
          toObject: () => ({ ...testSession, _id: currentSessionId }),
        },
        {
          ...testSession,
          _id: new mongoose.Types.ObjectId(),
          toObject: () => ({
            ...testSession,
            _id: new mongoose.Types.ObjectId(),
          }),
        },
      ]);

      sandbox.stub(sessionService, "terminateSession").resolves(true);

      // Act
      const result = await sessionService.terminateAllSessionsExceptCurrent(
        testUser._id,
        currentSessionId
      );

      // Assert
      expect(result).to.equal(2);

      // Verify terminateSession was called for each session except current
      expect(sessionService.terminateSession.callCount).to.equal(2);

      // Verify current session was not terminated
      const terminatedIds = sessionService.terminateSession
        .getCalls()
        .map((call) => call.args[0].toString());
      expect(terminatedIds).to.not.include(currentSessionId.toString());
    });

    it("should return 0 for user with only the current session", async () => {
      // Arrange
      const currentSessionId = new mongoose.Types.ObjectId();

      sandbox.stub(Session, "find").resolves([
        {
          ...testSession,
          _id: currentSessionId,
          toObject: () => ({ ...testSession, _id: currentSessionId }),
        },
      ]);

      sandbox.stub(sessionService, "terminateSession").resolves(true);

      // Act
      const result = await sessionService.terminateAllSessionsExceptCurrent(
        testUser._id,
        currentSessionId
      );

      // Assert
      expect(result).to.equal(0);

      // Verify terminateSession was not called
      expect(sessionService.terminateSession.callCount).to.equal(0);
    });
  });

  describe("cleanupExpiredSessions", () => {
    it("should clean up expired sessions", async () => {
      // Arrange
      sandbox.stub(Session, "updateMany").resolves({ modifiedCount: 5 });

      // Act
      const result = await sessionService.cleanupExpiredSessions();

      // Assert
      expect(result).to.equal(5);

      // Verify updateMany was called with correct parameters
      expect(Session.updateMany.calledOnce).to.be.true;
      const updateArgs = Session.updateMany.firstCall.args;
      expect(updateArgs[0].expiresAt.$lt).to.exist;
      expect(updateArgs[0].status).to.equal("active");
      expect(updateArgs[1].$set.status).to.equal("expired");
    });
  });

  describe("getSessionTimeoutInfo", () => {
    it("should return session timeout info", async () => {
      // Arrange
      const sessionId = new mongoose.Types.ObjectId();
      const lastActivity = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      sandbox.stub(Session, "findById").resolves({
        ...testSession,
        _id: sessionId,
        lastActivity,
        expiresAt,
        toObject: () => ({
          ...testSession,
          _id: sessionId,
          lastActivity,
          expiresAt,
        }),
      });

      // Act
      const result = await sessionService.getSessionTimeoutInfo(sessionId);

      // Assert
      expect(result).to.be.an("object");
      expect(result.lastActivity).to.deep.equal(lastActivity);
      expect(result.expiresAt).to.deep.equal(expiresAt);
      expect(result.idleTime).to.be.closeTo(20 * 60, 5); // 20 minutes in seconds, with 5 second tolerance
      expect(result.remainingTime).to.be.closeTo(10 * 60, 5); // 10 minutes in seconds, with 5 second tolerance
    });

    it("should return null for non-existent session", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(Session, "findById").resolves(null);

      // Act
      const result = await sessionService.getSessionTimeoutInfo(nonExistentId);

      // Assert
      expect(result).to.be.null;
    });
  });
});
