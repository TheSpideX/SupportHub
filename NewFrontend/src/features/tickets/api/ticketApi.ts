import { api } from "@/lib/api";

export interface Ticket {
  _id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status:
    | "new"
    | "assigned"
    | "in_progress"
    | "on_hold"
    | "pending_customer"
    | "resolved"
    | "closed";
  priority: "low" | "medium" | "high" | "critical";
  category: string;
  subcategory?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    email: string;
  };
  assignedTo?: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    email: string;
  };
  primaryTeam?: {
    teamId: {
      _id: string;
      name: string;
      teamType: string;
    };
    assignedAt: string;
  };
  supportingTeams?: Array<{
    teamId: {
      _id: string;
      name: string;
      teamType: string;
    };
    assignedAt: string;
    status: string;
  }>;
  customer?: {
    userId: {
      _id: string;
      profile: {
        firstName: string;
        lastName: string;
      };
      email: string;
    };
  };
  comments?: Array<{
    _id: string;
    author: {
      _id: string;
      profile: {
        firstName: string;
        lastName: string;
      };
      email: string;
    };
    text: string;
    createdAt: string;
    isInternal: boolean;
  }>;
  attachments?: Array<{
    filename: string;
    path: string;
    mimetype: string;
    size: number;
    uploadedAt: string;
  }>;
  sla?: {
    responseDeadline?: string;
    resolutionDeadline?: string;
    breached?: {
      response: boolean;
      resolution: boolean;
    };
  };
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  priority: "low" | "medium" | "high" | "critical";
  primaryTeam?: string;
  assignedTo?: string;
  customer?: {
    userId?: string;
    email?: string;
    name?: string;
  };
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  status?:
    | "new"
    | "assigned"
    | "in_progress"
    | "on_hold"
    | "pending_customer"
    | "resolved"
    | "closed";
  priority?: "low" | "medium" | "high" | "critical";
  category?: string;
  subcategory?: string;
  assignedTo?: string;
  primaryTeam?: string;
  supportingTeams?: string[];
  statusReason?: string;
}

export interface AddCommentRequest {
  text: string;
  isInternal?: boolean;
  visibleToTeams?: string[];
}

export interface AssignTicketRequest {
  assigneeId: string;
}

export interface AssignTeamRequest {
  teamId: string;
  isPrimary?: boolean;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  primaryTeam?: string;
  supportingTeam?: string;
  customer?: string;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  timestamp: string;
  performedBy: {
    _id: string;
    name: string;
  };
  details: Record<string, any>;
}

export interface GroupedActivityResponse {
  status: string;
  statusLabel: string;
  startTime: string;
  endTime: string | null;
  activities: AuditLogEntry[];
  ticketInfo: {
    ticketNumber: string;
    title: string;
  };
}

const ticketApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get tickets with filters
    getTickets: builder.query<
      PaginatedResponse<Ticket>,
      { filters?: TicketFilters; page?: number; limit?: number }
    >({
      query: ({ filters = {}, page = 1, limit = 20 }) => {
        const queryParams = new URLSearchParams();
        queryParams.append("page", page.toString());
        queryParams.append("limit", limit.toString());

        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            queryParams.append(key, value);
          }
        });

        return {
          url: `/api/tickets?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ _id }) => ({
                type: "Tickets" as const,
                id: _id,
              })),
              { type: "Tickets" as const, id: "LIST" },
            ]
          : [{ type: "Tickets" as const, id: "LIST" }],
    }),

    // Get ticket by ID
    getTicketById: builder.query<Ticket, string>({
      query: (id) => ({
        url: `/api/tickets/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Tickets" as const, id }],
    }),

    // Get ticket audit log
    getTicketAuditLog: builder.query<GroupedActivityResponse[], string>({
      query: (id) => ({
        url: `/api/tickets/${id}/audit-log`,
        method: "GET",
      }),
      transformResponse: (response: {
        success: boolean;
        data: GroupedActivityResponse[];
      }) => {
        // Process the audit log to remove any duplicate activities
        if (response.data && Array.isArray(response.data)) {
          // For each status group, make sure there are no duplicate activities
          const processedData = response.data.map((group) => {
            if (group.activities && Array.isArray(group.activities)) {
              // Use a Set to track activity IDs we've seen
              const seenActivityIds = new Set();

              // Filter out duplicate activities
              const uniqueActivities = group.activities.filter((activity) => {
                if (!activity._id) return true; // Keep activities without IDs

                const activityId = activity._id.toString();
                if (seenActivityIds.has(activityId)) {
                  return false; // Skip this duplicate
                }

                seenActivityIds.add(activityId);
                return true;
              });

              return {
                ...group,
                activities: uniqueActivities,
              };
            }
            return group;
          });

          return processedData;
        }
        return response.data;
      },
      providesTags: (result, error, id) => [
        { type: "TicketAuditLog" as const, id },
      ],
    }),

    // Create ticket
    createTicket: builder.mutation<Ticket, CreateTicketRequest>({
      query: (data) => {
        // Create a simple, clean object with just the required fields
        const cleanTicketData = {
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority || "medium",
          source: data.source || "direct_creation",
        };

        // Add optional fields if they exist
        if (data.subcategory) cleanTicketData.subcategory = data.subcategory;
        if (data.primaryTeam) cleanTicketData.primaryTeam = data.primaryTeam;
        if (data.assignedTo) cleanTicketData.assignedTo = data.assignedTo;
        if (data.slaPolicy) cleanTicketData.slaPolicy = data.slaPolicy;
        if (data.customer) cleanTicketData.customer = data.customer;

        console.log(
          "Creating ticket with clean data:",
          JSON.stringify(cleanTicketData, null, 2)
        );

        // Use a direct fetch approach instead of relying on RTK Query's default
        return {
          url: "/api/tickets",
          method: "POST",
          body: JSON.stringify(cleanTicketData),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        };
      },
      invalidatesTags: [{ type: "Tickets", id: "LIST" }],
      // Add transformResponse to log the response
      transformResponse: (response) => {
        console.log("Ticket creation response:", response);
        return response;
      },
      // Add transformErrorResponse to log the error
      transformErrorResponse: (response) => {
        console.error("Ticket creation error:", response);
        return response;
      },
    }),

    // Update ticket
    updateTicket: builder.mutation<
      Ticket,
      { id: string; data: UpdateTicketRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/tickets/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Tickets", id },
        { type: "Tickets", id: "LIST" },
      ],
    }),

    // Add comment to ticket
    addComment: builder.mutation<
      Ticket,
      { id: string; data: AddCommentRequest }
    >({
      query: ({ id, data }) => {
        console.log("API layer sending comment data:", JSON.stringify(data));

        // Validate comment text is not empty
        if (!data.text || typeof data.text !== "string" || !data.text.trim()) {
          throw new Error("Comment text cannot be empty");
        }

        // Ensure we're sending a clean object with the right structure
        const cleanData = {
          text: data.text.trim(),
          isInternal: !!data.isInternal,
        };

        console.log("Sending clean comment data:", JSON.stringify(cleanData));

        return {
          url: `/api/tickets/${id}/comments`,
          method: "POST",
          body: JSON.stringify(cleanData),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
        };
      },
      invalidatesTags: (result, error, { id }) => [{ type: "Tickets", id }],
      // Add transformResponse to log the response
      transformResponse: (response) => {
        console.log("Comment addition response:", response);
        return response;
      },
      // Add transformErrorResponse to log the error
      transformErrorResponse: (response) => {
        console.error("Comment addition error:", response);
        return response;
      },
    }),

    // Assign ticket to user
    assignTicket: builder.mutation<
      Ticket,
      { id: string; data: AssignTicketRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/tickets/${id}/assign`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Tickets", id },
        { type: "Tickets", id: "LIST" },
      ],
    }),

    // Assign ticket to team
    assignTicketToTeam: builder.mutation<
      Ticket,
      { id: string; data: AssignTeamRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/tickets/${id}/assign-team`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Tickets", id },
        { type: "Tickets", id: "LIST" },
      ],
    }),

    // Get ticket statistics
    getTicketStatistics: builder.query<any, void>({
      query: () => ({
        url: "/api/tickets/statistics",
        method: "GET",
      }),
      providesTags: ["TicketStats"],
    }),

    // Get tickets created by the current user
    getMyCreatedTickets: builder.query<
      PaginatedResponse<Ticket>,
      { page?: number; limit?: number }
    >({
      query: ({ page = 1, limit = 20 }) => {
        const queryParams = new URLSearchParams();
        queryParams.append("page", page.toString());
        queryParams.append("limit", limit.toString());
        queryParams.append("createdByMe", "true");

        return {
          url: `/api/tickets/created-by-me?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ _id }) => ({
                type: "Tickets" as const,
                id: _id,
              })),
              { type: "Tickets" as const, id: "CREATED_BY_ME" },
            ]
          : [{ type: "Tickets" as const, id: "CREATED_BY_ME" }],
    }),

    // Get tickets for my team (for team leads)
    getMyTeamTickets: builder.query<
      PaginatedResponse<Ticket>,
      { page?: number; limit?: number; filters?: TicketFilters }
    >({
      query: ({ page = 1, limit = 20, filters = {} }) => {
        const queryParams = new URLSearchParams();
        queryParams.append("page", page.toString());
        queryParams.append("limit", limit.toString());

        // Add any filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            queryParams.append(key, value);
          }
        });

        return {
          url: `/api/tickets/my-team?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ _id }) => ({
                type: "Tickets" as const,
                id: _id,
              })),
              { type: "Tickets" as const, id: "MY_TEAM" },
            ]
          : [{ type: "Tickets" as const, id: "MY_TEAM" }],
    }),
  }),
});

export const {
  useGetTicketsQuery,
  useGetTicketByIdQuery,
  useGetTicketAuditLogQuery,
  useCreateTicketMutation,
  useUpdateTicketMutation,
  useAddCommentMutation,
  useAssignTicketMutation,
  useAssignTicketToTeamMutation,
  useGetTicketStatisticsQuery,
  useGetMyCreatedTicketsQuery,
  useGetMyTeamTicketsQuery,
} = ticketApi;

export { ticketApi };
