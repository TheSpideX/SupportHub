import { apiClient } from "./apiClient";
import { API_ROUTES } from "@/config/routes";

// Define API routes for teams
const TEAM_API = {
  BASE: "/api/teams",
  GET_ALL: "/api/teams",
  GET_BY_ID: (id: string) => `/api/teams/${id}`,
  CREATE: "/api/teams",
  UPDATE: (id: string) => `/api/teams/${id}`,
  DELETE: (id: string) => `/api/teams/${id}`,
  MY_TEAMS: "/api/teams/my-teams",
  MEMBERSHIP: (id: string) => `/api/teams/${id}/membership`,
  ADD_MEMBER: (id: string) => `/api/teams/${id}/members`,
  REMOVE_MEMBER: (id: string, memberId: string) =>
    `/api/teams/${id}/members/${memberId}`,
  CHANGE_LEAD: (id: string) => `/api/teams/${id}/lead`,
  CREATE_INVITATION: (teamId: string) => `/api/teams/${teamId}/invitations`,
  GET_INVITATIONS: (teamId: string) => `/api/teams/${teamId}/invitations`,

  // Invitation code routes
  GENERATE_INVITATION_CODE: (teamId: string) =>
    `/api/teams/${teamId}/invitation-codes`,
  LIST_INVITATION_CODES: (teamId: string) =>
    `/api/teams/${teamId}/invitation-codes`,
  REVOKE_INVITATION_CODE: (teamId: string, codeId: string) =>
    `/api/teams/${teamId}/invitation-codes/${codeId}`,
  VALIDATE_INVITATION_CODE: (code: string) =>
    `/api/teams/invitation-codes/${code}/validate`,
};

// Define API routes for invitations
const INVITATION_API = {
  VERIFY: (code: string) => `/api/invitations/verify/${code}`,
  ACCEPT: (code: string) => `/api/invitations/accept/${code}`,
  REVOKE: (id: string) => `/api/invitations/${id}`,
  RESEND: (id: string) => `/api/invitations/${id}/resend`,
  MY_INVITATIONS: "/api/invitations/my-invitations",
};

// Define types
export interface TeamMember {
  userId: string;
  role: "lead" | "member";
  joinedAt: string;
  invitedBy: string;
  user?: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    email: string;
  };
}

export interface Team {
  _id: string;
  name: string;
  description: string;
  teamType: "technical" | "support";
  createdBy: string;
  leadId: string;
  members: TeamMember[];
  metrics: {
    ticketsAssigned: number;
    ticketsResolved: number;
    averageResolutionTime: number;
    lastMetricsUpdate: string;
  };
  isActive: boolean;
  invitationCodes?: InvitationCode[];
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  _id: string;
  code: string;
  teamId: string;
  email: string;
  role: "lead" | "member";
  invitedBy: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationCode {
  _id: string;
  code: string;
  role: "lead" | "member";
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: string;
}

// Team API functions
export const teamApi = {
  // Get all teams
  getAllTeams: async (page = 1, limit = 10) => {
    const response = await apiClient.get(TEAM_API.GET_ALL, {
      params: { page, limit },
    });
    return response.data;
  },

  // Get team by ID
  getTeamById: async (id: string) => {
    const response = await apiClient.get(TEAM_API.GET_BY_ID(id));
    return response.data;
  },

  // Create team
  createTeam: async (teamData: { name: string; description?: string }) => {
    const response = await apiClient.post(TEAM_API.CREATE, teamData);
    return response.data;
  },

  // Update team
  updateTeam: async (
    id: string,
    teamData: { name?: string; description?: string }
  ) => {
    const response = await apiClient.put(TEAM_API.UPDATE(id), teamData);
    return response.data;
  },

  // Delete team
  deleteTeam: async (id: string) => {
    const response = await apiClient.delete(TEAM_API.DELETE(id));
    return response.data;
  },

  // Get current user's teams
  getMyTeams: async () => {
    const response = await apiClient.get(TEAM_API.MY_TEAMS);
    return response.data;
  },

  // Check team membership
  checkTeamMembership: async (id: string) => {
    const response = await apiClient.get(TEAM_API.MEMBERSHIP(id));
    return response.data;
  },

  // Add team member
  addTeamMember: async (
    id: string,
    memberData: { userId: string; role?: "lead" | "member" }
  ) => {
    const response = await apiClient.post(TEAM_API.ADD_MEMBER(id), memberData);
    return response.data;
  },

  // Remove team member
  removeTeamMember: async (id: string, memberId: string) => {
    const response = await apiClient.delete(
      TEAM_API.REMOVE_MEMBER(id, memberId)
    );
    return response.data;
  },

  // Change team lead
  changeTeamLead: async (id: string, newLeadId: string) => {
    // Ensure newLeadId is a string
    const newLeadIdStr = String(newLeadId);
    console.log("API call - Change team lead:", {
      id,
      newLeadId: newLeadIdStr,
    });

    const response = await apiClient.put(TEAM_API.CHANGE_LEAD(id), {
      newLeadId: newLeadIdStr,
    });
    return response.data;
  },

  // Create invitation
  createInvitation: async (
    teamId: string,
    invitationData: { email: string; role?: "lead" | "member" }
  ) => {
    const response = await apiClient.post(
      TEAM_API.CREATE_INVITATION(teamId),
      invitationData
    );
    return response.data;
  },

  // Get team invitations
  getTeamInvitations: async (
    teamId: string,
    page = 1,
    limit = 10,
    status?: string
  ) => {
    const response = await apiClient.get(TEAM_API.GET_INVITATIONS(teamId), {
      params: { page, limit, status },
    });
    return response.data;
  },

  // Invitation code operations
  generateInvitationCode: async (teamId: string, role: "lead" | "member") => {
    try {
      const response = await apiClient.post(
        TEAM_API.GENERATE_INVITATION_CODE(teamId),
        { role }
      );
      return response.data.data;
    } catch (error) {
      console.error("Error generating invitation code:", error);
      throw error;
    }
  },

  listInvitationCodes: async (teamId: string) => {
    try {
      const response = await apiClient.get(
        TEAM_API.LIST_INVITATION_CODES(teamId)
      );
      return response.data.data;
    } catch (error) {
      console.error("Error listing invitation codes:", error);
      throw error;
    }
  },

  revokeInvitationCode: async (teamId: string, codeId: string) => {
    try {
      const response = await apiClient.delete(
        TEAM_API.REVOKE_INVITATION_CODE(teamId, codeId)
      );
      return response.data.success;
    } catch (error) {
      console.error("Error revoking invitation code:", error);
      throw error;
    }
  },

  validateInvitationCode: async (code: string) => {
    try {
      const response = await apiClient.get(
        TEAM_API.VALIDATE_INVITATION_CODE(code)
      );
      return response.data.data;
    } catch (error) {
      console.error("Error validating invitation code:", error);
      throw error;
    }
  },
};

// Invitation API functions
export const invitationApi = {
  // Verify invitation
  verifyInvitation: async (code: string) => {
    const response = await apiClient.get(INVITATION_API.VERIFY(code));
    return response.data;
  },

  // Accept invitation
  acceptInvitation: async (code: string) => {
    const response = await apiClient.post(INVITATION_API.ACCEPT(code));
    return response.data;
  },

  // Revoke invitation
  revokeInvitation: async (id: string) => {
    const response = await apiClient.delete(INVITATION_API.REVOKE(id));
    return response.data;
  },

  // Resend invitation
  resendInvitation: async (id: string) => {
    const response = await apiClient.post(INVITATION_API.RESEND(id));
    return response.data;
  },

  // Get current user's invitations
  getMyInvitations: async () => {
    const response = await apiClient.get(INVITATION_API.MY_INVITATIONS);
    return response.data;
  },
};

export default { teamApi, invitationApi };
