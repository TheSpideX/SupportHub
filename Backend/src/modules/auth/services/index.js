const tokenService = require('./token.service');
const sessionService = require('./session.service');
const securityService = require('./security.service');
const offlineService = require('./offline.service');
const authService = require('./auth.service');
const deviceService = require('./device.service');
const websocketDebugService = require('./websocket-debug.service');
const crossTabService = require('./cross-tab.service');
const socketService = require('./socket.service');
const roomRegistryService = require('./room-registry.service');
const eventPropagationService = require('./event-propagation.service');

module.exports = {
  tokenService,
  sessionService,
  securityService,
  offlineService,
  authService,
  deviceService,
  websocketDebugService,
  crossTabService,
  socketService,
  roomRegistryService,
  eventPropagationService
};
