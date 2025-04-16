import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { RootState } from "@/store";

// Create the API with a base query
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:4290",
    prepareHeaders: (headers, { getState }) => {
      // Get CSRF token from cookies
      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrf_token="))
        ?.split("=")[1];

      if (csrfToken) {
        headers.set("X-CSRF-Token", csrfToken);
      }

      // Add device and tab identifiers if available
      const state = getState() as RootState;
      const deviceId = state.session?.deviceId;
      const tabId = state.session?.tabId;
      const isLeader = state.session?.isLeader;

      if (deviceId) {
        headers.set("X-Device-ID", deviceId);
      }

      if (tabId) {
        headers.set("X-Tab-ID", tabId);
      }

      if (isLeader) {
        headers.set("X-Tab-Leader", "true");
      }

      return headers;
    },
    credentials: "include", // Important for cookies
  }),
  tagTypes: [
    "Tickets",
    "Queries",
    "SLAPolicies",
    "SLABreaches",
    "TicketStats",
    "Teams",
    "Users",
    "Customers",
    "Organizations",
  ],
  endpoints: () => ({}),
});

// Export hooks for usage in components
export const {
  util: { getRunningQueriesThunk },
} = api;
