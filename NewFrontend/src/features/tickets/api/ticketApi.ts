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
      }) => response.data,
      providesTags: (result, error, id) => [
        { type: "TicketAuditLog" as const, id },
      ],
    }),

    // Create ticket
    createTicket: builder.mutation<Ticket, CreateTicketRequest>({
      query: (data) => ({
        url: "/api/tickets",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [{ type: "Tickets", id: "LIST" }],
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
        return {
          url: `/api/tickets/${id}/comments`,
          method: "POST",
          body: data,
          headers: {
            "Content-Type": "application/json",
          },
        };
      },
      invalidatesTags: (result, error, { id }) => [{ type: "Tickets", id }],
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
} = ticketApi;

export { ticketApi };
