import { api } from "@/lib/api";
import { Team } from "./teamApi";

export const teamApiRTK = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all teams
    getTeams: builder.query<Team[], void>({
      query: () => ({
        url: "/api/teams",
        method: "GET",
      }),
      providesTags: ["Teams"],
    }),

    // Get team by ID
    getTeamById: builder.query<Team, string>({
      query: (id) => ({
        url: `/api/teams/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Teams" as const, id }],
    }),

    // Create team
    createTeam: builder.mutation<
      Team,
      { name: string; description?: string; teamType?: "technical" | "support" }
    >({
      query: (data) => ({
        url: "/api/teams",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Teams"],
    }),

    // Update team
    updateTeam: builder.mutation<
      Team,
      {
        id: string;
        data: {
          name?: string;
          description?: string;
          teamType?: "technical" | "support";
        };
      }
    >({
      query: ({ id, data }) => ({
        url: `/api/teams/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Teams" as const, id },
        "Teams",
      ],
    }),

    // Delete team
    deleteTeam: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/teams/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Teams"],
    }),

    // Generate invite code
    generateInviteCode: builder.mutation<
      { code: string; expiresAt: string },
      { teamId: string; role: "lead" | "member" }
    >({
      query: (data) => ({
        url: `/api/teams/${data.teamId}/invitation-codes`,
        method: "POST",
        body: { role: data.role },
      }),
    }),

    // Get team analytics
    getTeamAnalytics: builder.query<any, string>({
      query: (id) => ({
        url: `/api/teams/${id}/analytics`,
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetTeamsQuery,
  useGetTeamByIdQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useGenerateInviteCodeMutation,
  useGetTeamAnalyticsQuery,
} = teamApiRTK;
