// This is the shared worker file that manages auth state across all tabs

import { MessageType } from "../services/CrossTabService";

// Define our auth state interface
interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  tokens: any | null;
  lastUpdate: number;
  updatedBy: string | null;
}

// Define message format for communication with tabs
interface WorkerMessage {
  type: string;
  payload: any;
  tabId: string;
  timestamp: number;
}

// Initial auth state
let authState: AuthState = {
  isAuthenticated: false,
  user: null,
  tokens: null,
  lastUpdate: Date.now(),
  updatedBy: null,
};

// Keep track of connected tabs
const connectedPorts: Map<string, MessagePort> = new Map();
let leaderTabId: string | null = null;

// Handler for connections from tabs
self.addEventListener("connect", (e: any) => {
  const port = e.ports[0];
  let tabId: string | null = null;

  // Set up message listener for this connection
  port.addEventListener("message", (event: MessageEvent) => {
    const message = event.data as WorkerMessage;

    // Store the tab ID when first received
    if (!tabId && message.tabId) {
      tabId = message.tabId;
      connectedPorts.set(tabId, port);

      // If this is the first tab, make it leader
      if (!leaderTabId) {
        leaderTabId = tabId;
        broadcastToAllTabs({
          type: "LEADER_ELECTED",
          payload: { tabId: leaderTabId },
          tabId: "worker",
          timestamp: Date.now(),
        });
      }

      // Send current auth state to newly connected tab
      port.postMessage({
        type: "AUTH_STATE_UPDATE",
        payload: authState,
        tabId: "worker",
        timestamp: Date.now(),
      });

      // Send leader information
      port.postMessage({
        type: "LEADER_INFO",
        payload: { leaderId: leaderTabId },
        tabId: "worker",
        timestamp: Date.now(),
      });
    }

    // Add handling for tab visibility changes
    if (message.type === "TAB_VISIBLE") {
      handleTabVisible(message, port);
      return;
    }

    // Handle different message types
    switch (message.type) {
      case MessageType.AUTH_STATE_CHANGED:
        handleAuthStateChange(message);
        break;

      case MessageType.LOGOUT:
        handleLogout(message);
        break;

      case MessageType.TOKENS_UPDATED:
      case MessageType.TOKENS_REFRESHED:
        handleTokenUpdate(message);
        break;

      case MessageType.USER_ACTIVITY:
        // Just relay activity to other tabs
        relayMessageExcept(message, tabId);
        break;

      case "HEARTBEAT":
        // Tab checking if worker is alive
        port.postMessage({
          type: "HEARTBEAT_RESPONSE",
          payload: { timestamp: Date.now() },
          tabId: "worker",
          timestamp: Date.now(),
        });
        break;

      case "GET_CONNECTED_TABS":
        port.postMessage({
          type: "CONNECTED_TABS",
          payload: { tabs: Array.from(connectedPorts.keys()) },
          tabId: "worker",
          timestamp: Date.now(),
        });
        break;
    }
  });

  // Start the port
  port.start();

  // Handle disconnection
  port.addEventListener("messageerror", () => {
    if (tabId) {
      handleTabDisconnect(tabId);
    }
  });

  // Also listen for port.close() or page close
  port.addEventListener("close", () => {
    if (tabId) {
      handleTabDisconnect(tabId);
    }
  });
});

// Handle tab disconnection
function handleTabDisconnect(tabId: string): void {
  // Remove from connected tabs
  connectedPorts.delete(tabId);

  // If the leader disconnected, elect a new leader
  if (tabId === leaderTabId) {
    electNewLeader();
  }
}

// Elect a new leader if current leader disconnected
function electNewLeader(): void {
  // Get the first key from the Map if any exist
  let newLeader: string | null = null;

  // Iterate to find the first key
  connectedPorts.forEach((_, tabId) => {
    if (newLeader === null) {
      newLeader = tabId;
    }
  });

  if (newLeader) {
    leaderTabId = newLeader;

    broadcastToAllTabs({
      type: "LEADER_ELECTED",
      payload: { tabId: leaderTabId },
      tabId: "worker",
      timestamp: Date.now(),
    });
  } else {
    leaderTabId = null;
  }
}

// Handle auth state change
function handleAuthStateChange(message: WorkerMessage): void {
  // Process auth state changes with priority flags
  const isAuthenticated = message.payload?.isAuthenticated;
  const isPriority = message.payload?.isPriority === true;

  // Update central auth state
  if (message.payload && isAuthenticated !== undefined) {
    // For login updates (going from not authenticated to authenticated),
    // always update and broadcast regardless of source
    const isLoginEvent =
      isAuthenticated === true && authState.isAuthenticated === false;

    // For logout updates (going from authenticated to not authenticated),
    // always update and broadcast regardless of source
    const isLogoutEvent =
      isAuthenticated === false && authState.isAuthenticated === true;

    // Update state if it's a login, logout, or priority update
    if (isLoginEvent || isLogoutEvent || isPriority) {
      authState = {
        ...message.payload,
        lastUpdate: Date.now(),
        updatedBy: message.tabId,
      };

      // Broadcast immediately to all tabs with high priority
      broadcastToAllTabs({
        type: "AUTH_STATE_UPDATE",
        payload: {
          ...authState,
          isPriority: true, // Mark as priority so other tabs respect it
        },
        tabId: "worker",
        timestamp: Date.now(),
      });

      console.log(
        `[AuthSharedWorker] Auth state changed: isAuthenticated=${isAuthenticated}, broadcasting to ${connectedPorts.size} tabs`
      );
    } else {
      // For regular updates, just update the state
      authState = {
        ...authState,
        ...message.payload,
        lastUpdate: Date.now(),
        updatedBy: message.tabId,
      };

      // Broadcast to all tabs except sender
      broadcastToAllTabs(
        {
          type: "AUTH_STATE_UPDATE",
          payload: authState,
          tabId: "worker",
          timestamp: Date.now(),
        },
        message.tabId
      );
    }
  }
}

// Handle token updates
function handleTokenUpdate(message: WorkerMessage): void {
  // Update tokens in central state
  if (message.payload) {
    authState = {
      ...authState,
      tokens: message.payload,
      lastUpdate: Date.now(),
      updatedBy: message.tabId,
    };

    // Broadcast to all tabs except sender
    broadcastToAllTabs(
      {
        type: "AUTH_STATE_UPDATE",
        payload: authState,
        tabId: "worker",
        timestamp: Date.now(),
      },
      message.tabId
    );
  }
}

// Handle logout with verification
function handleLogout(message: WorkerMessage): void {
  // Clear auth state
  authState = {
    isAuthenticated: false,
    user: null,
    tokens: null,
    lastUpdate: Date.now(),
    updatedBy: message.tabId,
  };

  // Broadcast to ALL tabs with high priority flag
  try {
    broadcastToAllTabs({
      type: "LOGOUT_CONFIRMED",
      payload: {
        ...message.payload,
        isPriority: true, // Mark as high priority
      },
      tabId: "worker",
      timestamp: Date.now(),
    });

    console.log(
      `[AuthSharedWorker] Broadcast logout to ${connectedPorts.size} tabs`
    );
  } catch (error) {
    console.error("[AuthSharedWorker] Error broadcasting logout:", error);
  }
}

// When a tab becomes visible, send the current auth state
function handleTabVisible(message: WorkerMessage, port: MessagePort): void {
  port.postMessage({
    type: "AUTH_STATE_UPDATE",
    payload: authState,
    tabId: "worker",
    timestamp: Date.now(),
  });
}

// Broadcast message to all tabs
function broadcastToAllTabs(
  message: WorkerMessage,
  exceptTabId?: string
): void {
  // Instead of using Array.from(entries()), iterate over the Map directly
  connectedPorts.forEach((port, tabId) => {
    if (!exceptTabId || tabId !== exceptTabId) {
      try {
        port.postMessage(message);
      } catch (err) {
        console.error(`Failed to send message to tab ${tabId}`, err);
        // Remove the port if it's closed
        connectedPorts.delete(tabId);
      }
    }
  });
}

// Relay a message to all tabs except one
function relayMessageExcept(
  message: WorkerMessage,
  exceptTabId?: string | null
): void {
  // Instead of using Array.from(entries()), iterate over the Map directly
  connectedPorts.forEach((port, tabId) => {
    if (!exceptTabId || tabId !== exceptTabId) {
      try {
        port.postMessage(message);
      } catch (err) {
        console.error(`Failed to relay message to tab ${tabId}`, err);
        connectedPorts.delete(tabId);
      }
    }
  });
}
