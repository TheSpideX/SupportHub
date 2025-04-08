/**
 * Redis Client Mock
 *
 * This module provides a mock implementation of the Redis client for testing.
 */

const sinon = require("sinon");

const redisMock = {
  set: sinon.stub().resolves("OK"),
  get: sinon.stub().resolves(null),
  del: sinon.stub().resolves(1),
  expire: sinon.stub().resolves(1),
  exists: sinon.stub().resolves(0),
  keys: sinon.stub().resolves([]),
  hset: sinon.stub().resolves(1),
  hget: sinon.stub().resolves(null),
  hdel: sinon.stub().resolves(1),
  hgetall: sinon.stub().resolves({}),
  publish: sinon.stub().resolves(0),
  subscribe: sinon.stub().resolves(),
  unsubscribe: sinon.stub().resolves(),
  on: sinon.stub(),
  quit: sinon.stub().resolves("OK"),
  flushall: sinon.stub().resolves("OK"),
};

module.exports = {
  redisClient: redisMock,
  createClient: sinon.stub().returns(redisMock),
};
