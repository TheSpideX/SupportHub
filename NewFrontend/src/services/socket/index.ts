/**
 * Socket Service Index
 * Exports the WebSocket service for authentication and session management
 */

import {
  webSocketService,
  WebSocketService,
  RoomType,
  EventType,
} from "./WebSocketService";

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

// Export the WebSocket service and types
export { webSocketService, WebSocketService, RoomType, EventType };

// Export the instance as default
export default webSocketService;
