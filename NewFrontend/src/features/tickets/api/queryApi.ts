import { api } from "@/lib/api";

export interface Query {
  _id: string;
  queryNumber: string;
  subject: string;
  description: string;
  status: "new" | "under_review" | "converted" | "resolved" | "closed";
  category: "general" | "technical" | "billing" | "feature_request" | "other";
  createdAt: string;
  updatedAt: string;
  customerId: {
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
  convertedToTicket?: {
    _id: string;
    ticketNumber: string;
    status: string;
  };
  convertedBy?: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    email: string;
  };
  convertedAt?: string;
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
}

export interface CreateQueryRequest {
  subject: string;
  description: string;
  category: "general" | "technical" | "billing" | "feature_request" | "other";
  customer?: {
    userId?: string;
    email?: string;
    name?: string;
  };
}

export interface UpdateQueryRequest {
  subject?: string;
  description?: string;
  status?: "new" | "under_review" | "converted" | "resolved" | "closed";
  category?: "general" | "technical" | "billing" | "feature_request" | "other";
  assignedTo?: string;
}

export interface AddCommentRequest {
  text: string;
  isInternal?: boolean;
}

export interface AssignQueryRequest {
  assigneeId: string;
}

export interface ConvertToTicketRequest {
  title?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  priority?: "low" | "medium" | "high" | "critical";
  type?: "incident" | "problem" | "change_request" | "service_request";
  primaryTeam?: string;
  assignedTo?: string;
}

export interface QueryFilters {
  status?: string;
  category?: string;
  customerId?: string;
  assignedTo?: string;
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

const queryApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get queries with filters
    getQueries: builder.query<
      PaginatedResponse<Query>,
      { filters?: QueryFilters; page?: number; limit?: number }
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
          url: `/api/queries?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ _id }) => ({
                type: "Queries" as const,
                id: _id,
              })),
              { type: "Queries" as const, id: "LIST" },
            ]
          : [{ type: "Queries" as const, id: "LIST" }],
    }),

    // Get customer's own queries
    getMyQueries: builder.query<
      PaginatedResponse<Query>,
      { page?: number; limit?: number }
    >({
      query: ({ page = 1, limit = 20 }) => {
        const queryParams = new URLSearchParams();
        queryParams.append("page", page.toString());
        queryParams.append("limit", limit.toString());

        return {
          url: `/api/queries/my-queries?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ _id }) => ({
                type: "Queries" as const,
                id: _id,
              })),
              { type: "Queries" as const, id: "MY_LIST" },
            ]
          : [{ type: "Queries" as const, id: "MY_LIST" }],
    }),

    // Get queries assigned to me (for support team members)
    getMyAssignedQueries: builder.query<
      PaginatedResponse<Query>,
      { page?: number; limit?: number }
    >({
      query: ({ page = 1, limit = 20 }) => {
        const queryParams = new URLSearchParams();
        queryParams.append("page", page.toString());
        queryParams.append("limit", limit.toString());

        return {
          url: `/api/queries/assigned-to-me?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ _id }) => ({
                type: "Queries" as const,
                id: _id,
              })),
              { type: "Queries" as const, id: "ASSIGNED_TO_ME" },
            ]
          : [{ type: "Queries" as const, id: "ASSIGNED_TO_ME" }],
    }),

    // Get team queries (for team leads)
    getTeamQueries: builder.query<
      PaginatedResponse<Query>,
      { page?: number; limit?: number; filters?: QueryFilters }
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
          url: `/api/queries/team?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ _id }) => ({
                type: "Queries" as const,
                id: _id,
              })),
              { type: "Queries" as const, id: "TEAM_QUERIES" },
            ]
          : [{ type: "Queries" as const, id: "TEAM_QUERIES" }],
    }),

    // Get query by ID
    getQueryById: builder.query<Query, string>({
      query: (id) => ({
        url: `/api/queries/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Queries" as const, id }],
    }),

    // Create query
    createQuery: builder.mutation<Query, CreateQueryRequest>({
      query: (data) => {
        console.log("API layer sending query data:", JSON.stringify(data));
        return {
          url: "/api/queries",
          method: "POST",
          body: data,
          headers: {
            "Content-Type": "application/json",
          },
        };
      },
      invalidatesTags: [
        { type: "Queries", id: "LIST" },
        { type: "Queries", id: "MY_LIST" },
      ],
      // Add transformResponse to log the response
      transformResponse: (response) => {
        console.log("Query creation response:", response);
        return response;
      },
      // Add transformErrorResponse to log the error
      transformErrorResponse: (response) => {
        console.error("Query creation error:", response);
        return response;
      },
    }),

    // Update query
    updateQuery: builder.mutation<
      Query,
      { id: string; data: UpdateQueryRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/queries/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Queries", id },
        { type: "Queries", id: "LIST" },
        { type: "Queries", id: "MY_LIST" },
      ],
    }),

    // Add comment to query
    addComment: builder.mutation<
      Query,
      { id: string; data: AddCommentRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/queries/${id}/comments`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Queries", id }],
    }),

    // Assign query to support team member
    assignQuery: builder.mutation<
      Query,
      { id: string; data: AssignQueryRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/queries/${id}/assign`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Queries", id },
        { type: "Queries", id: "LIST" },
      ],
    }),

    // Convert query to ticket
    convertToTicket: builder.mutation<
      { ticket: any; query: Query },
      { id: string; data: ConvertToTicketRequest }
    >({
      query: ({ id, data }) => ({
        url: `/api/queries/${id}/convert`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Queries", id },
        { type: "Queries", id: "LIST" },
        { type: "Queries", id: "MY_LIST" },
        { type: "Tickets", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetQueriesQuery,
  useGetMyQueriesQuery,
  useGetMyAssignedQueriesQuery,
  useGetTeamQueriesQuery,
  useGetQueryByIdQuery,
  useCreateQueryMutation,
  useUpdateQueryMutation,
  useAddCommentMutation,
  useAssignQueryMutation,
  useConvertToTicketMutation,
} = queryApi;

export { queryApi };
