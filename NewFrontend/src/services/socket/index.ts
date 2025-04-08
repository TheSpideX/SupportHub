/**
 * Socket Service Index
 * Exports the WebSocket service for authentication and session management
 * Now using Primus instead of Socket.IO
 */

import {
  primusSocketService as webSocketService,
  PrimusSocketService as WebSocketService,
  RoomType,
  EventType
} from "./PrimusSocketService";

// Create a global type declaration for the socket service
declare global {
  interface Window {
    __webSocketService?: WebSocketService;
  }
}

/**
 * Get the WebSocket service instance
 */
export const getSocketService = (): WebSocketService => {
  return webSocketService;
};

/**
 * Initialize the WebSocket service
 */
export const initializeWebSocketService = (): WebSocketService => {
  // Store in window for cross-file access
  if (typeof window !== "undefined") {
    window.__webSocketService = webSocketService;
  }

  return webSocketService;
};

// Export all the types and services
export {
  webSocketService,
  WebSocketService,
  RoomType,
  EventType
};

// Export the instance as default
export default webSocketService;
