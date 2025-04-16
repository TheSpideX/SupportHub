import { api } from "@/lib/api";

export const slaApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all SLA policies
    getSLAPolicies: builder.query({
      query: () => "/api/sla/policies",
      providesTags: ["SLAPolicies"],
    }),

    // Get SLA policy by ID
    getSLAPolicyById: builder.query({
      query: (id) => `/api/sla/policies/${id}`,
      providesTags: (result, error, id) => [{ type: "SLAPolicies", id }],
    }),

    // Create SLA policy
    createSLAPolicy: builder.mutation({
      query: (data) => ({
        url: "/api/sla/policies",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["SLAPolicies"],
    }),

    // Update SLA policy
    updateSLAPolicy: builder.mutation({
      query: ({ id, data }) => ({
        url: `/api/sla/policies/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "SLAPolicies", id },
        "SLAPolicies",
      ],
    }),

    // Delete SLA policy
    deleteSLAPolicy: builder.mutation({
      query: (id) => ({
        url: `/api/sla/policies/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SLAPolicies"],
    }),

    // Apply SLA policy to ticket
    applySLAPolicy: builder.mutation({
      query: ({ ticketId, policyId }) => ({
        url: `/api/sla/apply/${ticketId}`,
        method: "POST",
        body: { policyId },
      }),
      invalidatesTags: (result, error, { ticketId }) => [
        { type: "Tickets", id: ticketId },
        "Tickets",
      ],
    }),

    // Pause SLA for ticket
    pauseSLA: builder.mutation({
      query: ({ ticketId, reason }) => ({
        url: `/api/sla/pause/${ticketId}`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (result, error, { ticketId }) => [
        { type: "Tickets", id: ticketId },
        "Tickets",
      ],
    }),

    // Resume SLA for ticket
    resumeSLA: builder.mutation({
      query: (ticketId) => ({
        url: `/api/sla/resume/${ticketId}`,
        method: "POST",
      }),
      invalidatesTags: (result, error, ticketId) => [
        { type: "Tickets", id: ticketId },
        "Tickets",
      ],
    }),

    // Check SLA breaches (admin only)
    checkSLABreaches: builder.mutation({
      query: () => ({
        url: "/api/sla/check-breaches",
        method: "POST",
      }),
      invalidatesTags: ["SLABreaches"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSLAPoliciesQuery,
  useGetSLAPolicyByIdQuery,
  useCreateSLAPolicyMutation,
  useUpdateSLAPolicyMutation,
  useDeleteSLAPolicyMutation,
  useApplySLAPolicyMutation,
  usePauseSLAMutation,
  useResumeSLAMutation,
  useCheckSLABreachesMutation,
} = slaApi;
