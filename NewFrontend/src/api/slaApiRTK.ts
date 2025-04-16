import { api } from '@/lib/api';

export interface SLAPolicy {
  _id: string;
  name: string;
  description: string;
  responseTime: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  resolutionTime: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  businessHours: {
    start: string;
    end: string;
    days: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApplySLAPolicyRequest {
  policyId: string;
}

export interface PauseSLARequest {
  reason: string;
}

export const slaApiRTK = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all SLA policies
    getSLAPolicies: builder.query<SLAPolicy[], void>({
      query: () => ({
        url: '/api/sla/policies',
        method: 'GET',
      }),
      providesTags: ['SLAPolicies'],
    }),
    
    // Get SLA policy by ID
    getSLAPolicyById: builder.query<SLAPolicy, string>({
      query: (id) => ({
        url: `/api/sla/policies/${id}`,
        method: 'GET',
      }),
      providesTags: (result, error, id) => [{ type: 'SLAPolicies' as const, id }],
    }),
    
    // Create SLA policy
    createSLAPolicy: builder.mutation<SLAPolicy, Partial<SLAPolicy>>({
      query: (data) => ({
        url: '/api/sla/policies',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['SLAPolicies'],
    }),
    
    // Update SLA policy
    updateSLAPolicy: builder.mutation<SLAPolicy, { id: string; data: Partial<SLAPolicy> }>({
      query: ({ id, data }) => ({
        url: `/api/sla/policies/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'SLAPolicies' as const, id },
        'SLAPolicies',
      ],
    }),
    
    // Delete SLA policy
    deleteSLAPolicy: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/sla/policies/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SLAPolicies'],
    }),
    
    // Apply SLA policy to ticket
    applyPolicyToTicket: builder.mutation<void, { ticketId: string; data: ApplySLAPolicyRequest }>({
      query: ({ ticketId, data }) => ({
        url: `/api/tickets/${ticketId}/sla`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { ticketId }) => [{ type: 'Tickets' as const, id: ticketId }],
    }),
    
    // Pause SLA for ticket
    pauseSLA: builder.mutation<void, { ticketId: string; data: PauseSLARequest }>({
      query: ({ ticketId, data }) => ({
        url: `/api/tickets/${ticketId}/sla/pause`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { ticketId }) => [{ type: 'Tickets' as const, id: ticketId }],
    }),
    
    // Resume SLA for ticket
    resumeSLA: builder.mutation<void, string>({
      query: (ticketId) => ({
        url: `/api/tickets/${ticketId}/sla/resume`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, ticketId) => [{ type: 'Tickets' as const, id: ticketId }],
    }),
    
    // Get SLA breaches
    getSLABreaches: builder.query<any[], void>({
      query: () => ({
        url: '/api/sla/breaches',
        method: 'GET',
      }),
      providesTags: ['SLABreaches'],
    }),
  }),
});

export const {
  useGetSLAPoliciesQuery,
  useGetSLAPolicyByIdQuery,
  useCreateSLAPolicyMutation,
  useUpdateSLAPolicyMutation,
  useDeleteSLAPolicyMutation,
  useApplyPolicyToTicketMutation,
  usePauseSLAMutation,
  useResumeSLAMutation,
  useGetSLABreachesQuery,
} = slaApiRTK;
