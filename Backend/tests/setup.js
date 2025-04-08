/**
 * Test Setup
 *
 * This file sets up the test environment by mocking external dependencies.
 */

const sinon = require("sinon");
const { redisClient } = require("./mocks/redis.mock");

// Create a sandbox for each test
beforeEach(function () {
  this.sandbox = sinon.createSandbox();
});

// Restore all stubs after each test
afterEach(function () {
  this.sandbox.restore();

  // Clean up services
  try {
    const deviceService = require("../src/modules/auth/services/device.service");
    if (deviceService && deviceService.cleanup) deviceService.cleanup();
  } catch (e) {}

  try {
    const sessionService = require("../src/modules/auth/services/session.service");
    if (sessionService && sessionService.cleanup) sessionService.cleanup();
  } catch (e) {}

  try {
    const tokenService = require("../src/modules/auth/services/token.service");
    if (tokenService && tokenService.cleanup) tokenService.cleanup();
  } catch (e) {}
});

// Mock the Redis client
const redisMock = {
  redisClient,
  createClient: sinon.stub().returns(redisClient),
};

// Mock the logger to prevent console output during tests
const loggerMock = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub(),
  debug: sinon.stub(),
};

// Mock the socket manager
const socketManagerMock = {
  socketManager: {
    getIO: sinon.stub().returns({
      to: sinon.stub().returnsThis(),
      emit: sinon.stub(),
    }),
    getNamespace: sinon.stub().returns({
      to: sinon.stub().returnsThis(),
      emit: sinon.stub(),
    }),
  },
};

// Export mocks for use in tests
module.exports = {
  redisMock,
  loggerMock,
  socketManagerMock,
};
