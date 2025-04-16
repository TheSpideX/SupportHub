import appPrimusClient from "@/services/primus/appPrimusClient";

// Define event types
export type QueryEvent =
  | "query:created"
  | "query:updated"
  | "query:comment_added"
  | "query:assigned"
  | "query:converted";

export type NotificationEvent = "notification";

// Define event handlers
export type QueryEventHandler = (data: any) => void;
export type NotificationEventHandler = (data: any) => void;

// Socket service for queries
export const querySocket = {
  // Subscribe to query updates
  subscribeToQuery: (queryId: string) => {
    if (appPrimusClient.primus) {
      appPrimusClient.primus.write({
        event: "query:subscribe",
        data: { queryId },
      });
    }
  },

  // Unsubscribe from query updates
  unsubscribeFromQuery: (queryId: string) => {
    if (appPrimusClient.primus) {
      appPrimusClient.primus.write({
        event: "query:unsubscribe",
        data: { queryId },
      });
    }
  },

  // Add query event listener
  onQueryEvent: (event: QueryEvent, handler: QueryEventHandler) => {
    if (appPrimusClient.primus) {
      appPrimusClient.primus.on(event, handler);
    }

    // Return cleanup function
    return () => {
      if (appPrimusClient.primus) {
        appPrimusClient.primus.off(event, handler);
      }
    };
  },

  // Add notification event listener
  onNotification: (handler: NotificationEventHandler) => {
    if (appPrimusClient.primus) {
      appPrimusClient.primus.on("notification", handler);
    }

    // Return cleanup function
    return () => {
      if (appPrimusClient.primus) {
        appPrimusClient.primus.off("notification", handler);
      }
    };
  },
};
