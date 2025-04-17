import { createApi } from "@reduxjs/toolkit/query/react";
import appPrimusClient from "@/services/primus/appPrimusClient";

// Define event types
export type TicketEvent =
  | "ticket:created"
  | "ticket:updated"
  | "ticket:comment_added"
  | "ticket:assigned"
  | "ticket:status_changed"
  | "ticket:sla_updated";

export type QueryEvent =
  | "query:created"
  | "query:updated"
  | "query:comment_added"
  | "query:assigned"
  | "query:converted";

export type NotificationEvent = "notification";

// Define event handlers
export type TicketEventHandler = (data: any) => void;
export type QueryEventHandler = (data: any) => void;
export type NotificationEventHandler = (data: any) => void;

// Socket service for tickets
export const ticketSocket = {
  // Subscribe to ticket updates
  subscribeToTicket: (ticketId: string) => {
    if (appPrimusClient.primus) {
      console.log(`Subscribing to ticket updates for ticket ${ticketId}`);
      appPrimusClient.primus.write({
        event: "ticket:subscribe",
        data: { ticketId },
      });
    } else {
      console.error("Primus client not available for ticket subscription");
    }
  },

  // Unsubscribe from ticket updates
  unsubscribeFromTicket: (ticketId: string) => {
    if (appPrimusClient.primus) {
      appPrimusClient.primus.write({
        event: "ticket:unsubscribe",
        data: { ticketId },
      });
    }
  },

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

  // Add ticket event listener
  onTicketEvent: (event: TicketEvent, handler: TicketEventHandler) => {
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
