import { api } from '@/lib/api';

export interface SLAPolicy {
  _id: string;
  name: string;
  description?: string;
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
  businessHours?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  holidays?: Array<{
    date: string;
    name: string;
  }>;
  escalationRules?: Array<{
    condition: 'response_approaching' | 'response_breached' | 'resolution_approaching' | 'resolution_breached';
    threshold: number;
    actions: Array<{
      type: 'notify_assignee' | 'notify_team_lead' | 'notify_manager' | 'reassign' | 'increase_priority';
      details?: any;
    }>;
  }>;
  isActive: boolean;
  createdBy: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateSLAPolicyRequest {
  name: string;
  description?: string;
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
  businessHours?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  holidays?: Array<{
    date: string;
    name: string;
  }>;
  escalationRules?: Array<{
    condition: 'response_approaching' | 'response_breached' | 'resolution_approaching' | 'resolution_breached';
    threshold: number;
    actions: Array<{
      type: 'notify_assignee' | 'notify_team_lead' | 'notify_manager' | 'reassign' | 'increase_priority';
      details?: any;
    }>;
  }>;
  isActive?: boolean;
}

export interface UpdateSLAPolicyRequest {
  name?: string;
  description?: string;
  responseTime?: {
    low?: number;
    medium?: number;
    high?: number;
    critical?: number;
  };
  resolutionTime?: {
    low?: number;
    medium?: number;
    high?: number;
    critical?: number;
  };
  businessHours?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  holidays?: Array<{
    date: string;
    name: string;
  }>;
  escalationRules?: Array<{
    condition: 'response_approaching' | 'response_breached' | 'resolution_approaching' | 'resolution_breached';
    threshold: number;
    actions: Array<{
      type: 'notify_assignee' | 'notify_team_lead' | 'notify_manager' | 'reassign' | 'increase_priority';
      details?: any;
    }>;
  }>;
  isActive?: boolean;
}

export interface ApplyPolicyRequest {
  policyId: string;
}

export interface PauseSLARequest {
  reason: string;
}

export const slaApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get SLA policies
    getSLAPolicies: builder.query<SLAPolicy[], void>({
      query: () => ({
        url: '/sla/policies',
        method: 'GET',
      }),
      providesTags: (result) => 
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'SLAPolicies' as const, id: _id })),
              { type: 'SLAPolicies' as const, id: 'LIST' },
            ]
          : [{ type: 'SLAPolicies' as const, id: 'LIST' }],
    }),
    
    // Get SLA policy by ID
    getSLAPolicyById: builder.query<SLAPolicy, string>({
      query: (id) => ({
        url: `/sla/policies/${id}`,
        method: 'GET',
      }),
      providesTags: (result, error, id) => [{ type: 'SLAPolicies' as const, id }],
    }),
    
    // Create SLA policy
    createSLAPolicy: builder.mutation<SLAPolicy, CreateSLAPolicyRequest>({
      query: (data) => ({
        url: '/sla/policies',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'SLAPolicies', id: 'LIST' }],
    }),
    
    // Update SLA policy
    updateSLAPolicy: builder.mutation<SLAPolicy, { id: string; data: UpdateSLAPolicyRequest }>({
      query: ({ id, data }) => ({
        url: `/sla/policies/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'SLAPolicies', id },
        { type: 'SLAPolicies', id: 'LIST' },
      ],
    }),
    
    // Delete SLA policy
    deleteSLAPolicy: builder.mutation<void, string>({
      query: (id) => ({
        url: `/sla/policies/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'SLAPolicies', id },
        { type: 'SLAPolicies', id: 'LIST' },
      ],
    }),
    
    // Apply SLA policy to ticket
    applyPolicyToTicket: builder.mutation<any, { ticketId: string; data: ApplyPolicyRequest }>({
      query: ({ ticketId, data }) => ({
        url: `/sla/apply/${ticketId}`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { ticketId }) => [{ type: 'Tickets', id: ticketId }],
    }),
    
    // Pause SLA for a ticket
    pauseSLA: builder.mutation<any, { ticketId: string; data: PauseSLARequest }>({
      query: ({ ticketId, data }) => ({
        url: `/sla/pause/${ticketId}`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { ticketId }) => [{ type: 'Tickets', id: ticketId }],
    }),
    
    // Resume SLA for a ticket
    resumeSLA: builder.mutation<any, string>({
      query: (ticketId) => ({
        url: `/sla/resume/${ticketId}`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, ticketId) => [{ type: 'Tickets', id: ticketId }],
    }),
    
    // Check SLA breaches
    checkSLABreaches: builder.mutation<any, void>({
      query: () => ({
        url: '/sla/check-breaches',
        method: 'POST',
      }),
      invalidatesTags: ['Tickets'],
    }),
  }),
});
