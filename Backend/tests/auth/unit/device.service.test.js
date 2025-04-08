/**
 * Unit Tests for Device Service
 *
 * Tests all functions of the device service in isolation:
 * - Device registration
 * - Device verification
 * - Device trust scoring
 * - Device management
 */

const mongoose = require("mongoose");
const { expect } = require("chai");
const sinon = require("sinon");
const { redisMock } = require("../../setup");

// Import the device service
const deviceService = require("../../../src/modules/auth/services/device.service");
const Device = require("../../../src/modules/auth/models/device.model");
const User = require("../../../src/modules/auth/models/user.model");
const roomRegistryService = require("../../../src/modules/auth/services/room-registry.service");
const crypto = require("crypto");
const { redisClient } = redisMock;

describe("Device Service Unit Tests", () => {
  let testUser;
  let testDeviceInfo;
  let testDevice;
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

    // Create test device info
    testDeviceInfo = {
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
      fingerprint: "test-fingerprint",
    };

    // Create a test device
    testDevice = {
      deviceId: "test-device-id",
      userId: testUser._id,
      name: testDeviceInfo.name,
      fingerprint: testDeviceInfo.fingerprint,
      userAgent: testDeviceInfo.userAgent,
      browser: testDeviceInfo.browser,
      os: testDeviceInfo.os,
      deviceType: "desktop",
      isVerified: true,
      verifiedAt: new Date(),
      lastActive: new Date(),
      ipAddresses: [testDeviceInfo.ip],
      trustScore: 100,
      hierarchyPath: {
        userRoom: `user:${testUser._id}`,
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
    deviceService.cleanup();
  });

  after(async () => {
    // Clean up and disconnect
    await Device.deleteMany({});
    await mongoose.connection.close();
  });

  describe("registerDevice", () => {
    it("should register a new device if fingerprint is not found", async () => {
      // Arrange
      const deviceData = {
        ip: testDeviceInfo.ip,
        userAgent: testDeviceInfo.userAgent,
        deviceInfo: testDeviceInfo,
      };

      // Stub Redis
      sandbox.stub(redisClient, "set").resolves("OK");
      sandbox.stub(redisClient, "expire").resolves(1);

      // Stub crypto for device ID generation
      sandbox.stub(crypto, "randomBytes").returns({
        toString: () => "test-device-id",
      });

      // Stub Device.findOne to return null (no existing device)
      sandbox.stub(Device.prototype, "save").resolves({
        ...testDevice,
        _id: new mongoose.Types.ObjectId(),
        toObject: () => ({ ...testDevice, _id: new mongoose.Types.ObjectId() }),
      });

      sandbox.stub(Device, "findOne").resolves(null);

      // Act
      const result = await deviceService.registerDevice(
        testUser._id,
        deviceData
      );

      // Assert
      expect(result).to.be.an("object");
      expect(result.userId.toString()).to.equal(testUser._id.toString());
      expect(result.fingerprint).to.equal(testDeviceInfo.fingerprint);
    });

    it("should update existing device if fingerprint is found", async () => {
      // Arrange
      const deviceData = {
        ipAddress: testDeviceInfo.ip,
        userAgent: testDeviceInfo.userAgent,
        deviceInfo: testDeviceInfo,
      };

      const existingDevice = {
        ...testDevice,
        _id: new mongoose.Types.ObjectId(),
        lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        ipAddresses: ["192.168.1.1"],
        toObject: function () {
          return this;
        },
      };

      sandbox.stub(Device, "findOne").resolves(existingDevice);

      sandbox.stub(Device, "findByIdAndUpdate").resolves({
        ...existingDevice,
        lastActive: new Date(),
        ipAddresses: ["192.168.1.1", testDeviceInfo.ip],
        toObject: function () {
          return this;
        },
      });

      // Act
      const result = await deviceService.registerDevice(
        testUser._id,
        deviceData
      );

      // Assert
      expect(result).to.be.an("object");
      expect(result.userId.toString()).to.equal(testUser._id.toString());
      expect(result.fingerprint).to.equal(testDeviceInfo.fingerprint);

      // Verify device was updated
      expect(Device.findByIdAndUpdate.calledOnce).to.be.true;
      const updateArgs = Device.findByIdAndUpdate.firstCall.args;
      expect(updateArgs[0].toString()).to.equal(existingDevice._id.toString());
      expect(updateArgs[1].$set.lastActive).to.exist;
      expect(updateArgs[1].$addToSet.ipAddresses).to.equal(testDeviceInfo.ip);
    });

    it("should throw an error if required fields are missing", async () => {
      // Arrange
      const incompleteDeviceData = {
        ipAddress: testDeviceInfo.ip,
        // Missing userAgent
        deviceInfo: {
          // Missing fingerprint
          name: testDeviceInfo.name,
        },
      };

      // Act & Assert
      try {
        await deviceService.registerDevice(testUser._id, incompleteDeviceData);
        // Should not reach here
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("getDevice", () => {
    it("should retrieve a device by ID", async () => {
      // Arrange
      const deviceId = new mongoose.Types.ObjectId();
      sandbox.stub(Device, "findById").resolves({
        ...testDevice,
        _id: deviceId,
        toObject: () => ({ ...testDevice, _id: deviceId }),
      });

      // Act
      const result = await deviceService.getDevice(deviceId);

      // Assert
      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(deviceId.toString());
      expect(result.userId.toString()).to.equal(testUser._id.toString());
      expect(result.deviceId).to.equal(testDevice.deviceId);
    });

    it("should return null for non-existent device", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(Device, "findById").resolves(null);

      // Act
      const result = await deviceService.getDevice(nonExistentId);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe("getDeviceByFingerprint", () => {
    it("should retrieve a device by fingerprint and user ID", async () => {
      // Arrange
      sandbox.stub(Device, "findOne").resolves({
        ...testDevice,
        _id: new mongoose.Types.ObjectId(),
        toObject: () => ({ ...testDevice, _id: new mongoose.Types.ObjectId() }),
      });

      // Act
      const result = await deviceService.getDeviceByFingerprint(
        testUser._id,
        testDevice.fingerprint
      );

      // Assert
      expect(result).to.be.an("object");
      expect(result.userId.toString()).to.equal(testUser._id.toString());
      expect(result.fingerprint).to.equal(testDevice.fingerprint);
    });

    it("should return null for non-existent device", async () => {
      // Arrange
      sandbox.stub(Device, "findOne").resolves(null);

      // Act
      const result = await deviceService.getDeviceByFingerprint(
        testUser._id,
        "non-existent-fingerprint"
      );

      // Assert
      expect(result).to.be.null;
    });
  });

  describe("getUserDevices", () => {
    it("should retrieve all devices for a user", async () => {
      // Arrange
      sandbox.stub(Device, "find").resolves([
        {
          ...testDevice,
          _id: new mongoose.Types.ObjectId(),
          deviceId: "device-1",
          toObject: () => ({
            ...testDevice,
            _id: new mongoose.Types.ObjectId(),
            deviceId: "device-1",
          }),
        },
        {
          ...testDevice,
          _id: new mongoose.Types.ObjectId(),
          deviceId: "device-2",
          toObject: () => ({
            ...testDevice,
            _id: new mongoose.Types.ObjectId(),
            deviceId: "device-2",
          }),
        },
      ]);

      // Act
      const result = await deviceService.getUserDevices(testUser._id);

      // Assert
      expect(result).to.be.an("array");
      expect(result.length).to.equal(2);
      expect(result[0].userId.toString()).to.equal(testUser._id.toString());
      expect(result[1].userId.toString()).to.equal(testUser._id.toString());
      expect(result[0].deviceId).to.equal("device-1");
      expect(result[1].deviceId).to.equal("device-2");
    });

    it("should return empty array for user with no devices", async () => {
      // Arrange
      sandbox.stub(Device, "find").resolves([]);

      // Act
      const result = await deviceService.getUserDevices(testUser._id);

      // Assert
      expect(result).to.be.an("array");
      expect(result.length).to.equal(0);
    });
  });

  describe("updateDeviceActivity", () => {
    it("should update device last activity time", async () => {
      // Arrange
      const deviceId = new mongoose.Types.ObjectId();
      const now = new Date();

      sandbox.stub(Device, "findByIdAndUpdate").resolves({
        ...testDevice,
        _id: deviceId,
        lastActive: now,
        toObject: () => ({ ...testDevice, _id: deviceId, lastActive: now }),
      });

      // Act
      const result = await deviceService.updateDeviceActivity(deviceId);

      // Assert
      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(deviceId.toString());
      expect(result.lastActive).to.deep.equal(now);

      // Verify update was called with correct parameters
      expect(Device.findByIdAndUpdate.calledOnce).to.be.true;
      const updateArgs = Device.findByIdAndUpdate.firstCall.args;
      expect(updateArgs[0].toString()).to.equal(deviceId.toString());
      expect(updateArgs[1].$set.lastActive).to.exist;
    });

    it("should return null for non-existent device", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(Device, "findByIdAndUpdate").resolves(null);

      // Act
      const result = await deviceService.updateDeviceActivity(nonExistentId);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe("verifyDevice", () => {
    it("should verify a device", async () => {
      // Arrange
      const deviceId = new mongoose.Types.ObjectId();

      sandbox.stub(Device, "findByIdAndUpdate").resolves({
        ...testDevice,
        _id: deviceId,
        isVerified: true,
        verifiedAt: new Date(),
        toObject: () => ({
          ...testDevice,
          _id: deviceId,
          isVerified: true,
          verifiedAt: new Date(),
        }),
      });

      // Act
      const result = await deviceService.verifyDevice(deviceId);

      // Assert
      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(deviceId.toString());
      expect(result.isVerified).to.be.true;
      expect(result.verifiedAt).to.exist;

      // Verify update was called with correct parameters
      expect(Device.findByIdAndUpdate.calledOnce).to.be.true;
      const updateArgs = Device.findByIdAndUpdate.firstCall.args;
      expect(updateArgs[0].toString()).to.equal(deviceId.toString());
      expect(updateArgs[1].$set.isVerified).to.be.true;
      expect(updateArgs[1].$set.verifiedAt).to.exist;
    });

    it("should return null for non-existent device", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(Device, "findByIdAndUpdate").resolves(null);

      // Act
      const result = await deviceService.verifyDevice(nonExistentId);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe("updateTrustScore", () => {
    it("should update device trust score", async () => {
      // Arrange
      const deviceId = new mongoose.Types.ObjectId();
      const newScore = 85;

      sandbox.stub(Device, "findByIdAndUpdate").resolves({
        ...testDevice,
        _id: deviceId,
        trustScore: newScore,
        toObject: () => ({
          ...testDevice,
          _id: deviceId,
          trustScore: newScore,
        }),
      });

      // Act
      const result = await deviceService.updateTrustScore(deviceId, newScore);

      // Assert
      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(deviceId.toString());
      expect(result.trustScore).to.equal(newScore);

      // Verify update was called with correct parameters
      expect(Device.findByIdAndUpdate.calledOnce).to.be.true;
      const updateArgs = Device.findByIdAndUpdate.firstCall.args;
      expect(updateArgs[0].toString()).to.equal(deviceId.toString());
      expect(updateArgs[1].$set.trustScore).to.equal(newScore);
    });

    it("should return null for non-existent device", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(Device, "findByIdAndUpdate").resolves(null);

      // Act
      const result = await deviceService.updateTrustScore(nonExistentId, 85);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe("removeDevice", () => {
    it("should remove a device", async () => {
      // Arrange
      const deviceId = new mongoose.Types.ObjectId();

      sandbox.stub(Device, "findById").resolves({
        ...testDevice,
        _id: deviceId,
        toObject: () => ({ ...testDevice, _id: deviceId }),
      });

      sandbox.stub(Device, "findByIdAndDelete").resolves({
        ...testDevice,
        _id: deviceId,
        toObject: () => ({ ...testDevice, _id: deviceId }),
      });

      sandbox.stub(roomRegistryService, "unregisterDevice").resolves();

      // Act
      const result = await deviceService.removeDevice(deviceId);

      // Assert
      expect(result).to.be.true;

      // Verify device was deleted
      expect(Device.findByIdAndDelete.calledOnce).to.be.true;
      expect(Device.findByIdAndDelete.firstCall.args[0].toString()).to.equal(
        deviceId.toString()
      );

      // Verify device was unregistered
      expect(roomRegistryService.unregisterDevice.calledOnce).to.be.true;
    });

    it("should return false for non-existent device", async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId();
      sandbox.stub(Device, "findById").resolves(null);

      // Act
      const result = await deviceService.removeDevice(nonExistentId);

      // Assert
      expect(result).to.be.false;
    });
  });

  describe("removeAllUserDevices", () => {
    it("should remove all devices for a user", async () => {
      // Arrange
      sandbox.stub(Device, "find").resolves([
        {
          ...testDevice,
          _id: new mongoose.Types.ObjectId(),
          deviceId: "device-1",
          toObject: () => ({
            ...testDevice,
            _id: new mongoose.Types.ObjectId(),
            deviceId: "device-1",
          }),
        },
        {
          ...testDevice,
          _id: new mongoose.Types.ObjectId(),
          deviceId: "device-2",
          toObject: () => ({
            ...testDevice,
            _id: new mongoose.Types.ObjectId(),
            deviceId: "device-2",
          }),
        },
      ]);

      sandbox.stub(deviceService, "removeDevice").resolves(true);

      // Act
      const result = await deviceService.removeAllUserDevices(testUser._id);

      // Assert
      expect(result).to.equal(2);

      // Verify removeDevice was called for each device
      expect(deviceService.removeDevice.callCount).to.equal(2);
    });

    it("should return 0 for user with no devices", async () => {
      // Arrange
      sandbox.stub(Device, "find").resolves([]);

      // Act
      const result = await deviceService.removeAllUserDevices(testUser._id);

      // Assert
      expect(result).to.equal(0);
    });
  });
});
