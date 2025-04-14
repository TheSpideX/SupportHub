import { useState, useCallback } from "react";
import { useTeam } from "../context/TeamContext";
import { Team, TeamMember, Invitation, teamApi } from "@/api/teamApi";
import { useToast } from "@/hooks/useToast";

export const useTeamManagement = () => {
  const {
    teams,
    myTeams,
    currentTeam,
    isLoading,
    error,
    fetchTeams,
    fetchMyTeams,
    fetchTeamById,
    createTeam,
    updateTeam,
    deleteTeam,
    addTeamMember,
    removeTeamMember,
    changeTeamLead,
    teamInvitations,
    createInvitation,
    fetchTeamInvitations,
    revokeInvitation,
    resendInvitation,
    setCurrentTeam,
  } = useTeam();

  const { showToast } = useToast();

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedInvitation, setSelectedInvitation] =
    useState<Invitation | null>(null);

  // Handle team creation
  const handleCreateTeam = useCallback(
    async (teamData: { name: string; description?: string }) => {
      try {
        const newTeam = await createTeam(teamData);

        if (newTeam) {
          showToast({
            title: "Team Created",
            description: `Team "${newTeam.name}" has been created successfully.`,
            status: "success",
          });

          return newTeam;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to create team",
          status: "error",
        });

        return null;
      }
    },
    [createTeam, showToast]
  );

  // Handle team update
  const handleUpdateTeam = useCallback(
    async (id: string, teamData: { name?: string; description?: string }) => {
      try {
        const updatedTeam = await updateTeam(id, teamData);

        if (updatedTeam) {
          showToast({
            title: "Team Updated",
            description: `Team "${updatedTeam.name}" has been updated successfully.`,
            status: "success",
          });

          return updatedTeam;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to update team",
          status: "error",
        });

        return null;
      }
    },
    [updateTeam, showToast]
  );

  // Handle team deletion
  const handleDeleteTeam = useCallback(
    async (id: string) => {
      try {
        const success = await deleteTeam(id);

        if (success) {
          showToast({
            title: "Team Deleted",
            description: "Team has been deleted successfully.",
            status: "success",
          });

          return true;
        }

        return false;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to delete team",
          status: "error",
        });

        return false;
      }
    },
    [deleteTeam, showToast]
  );

  // Handle adding team member
  const handleAddTeamMember = useCallback(
    async (
      teamId: string,
      memberData: { userId: string; role?: "lead" | "member" }
    ) => {
      try {
        const updatedTeam = await addTeamMember(teamId, memberData);

        if (updatedTeam) {
          showToast({
            title: "Member Added",
            description: "Team member has been added successfully.",
            status: "success",
          });

          return updatedTeam;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to add team member",
          status: "error",
        });

        return null;
      }
    },
    [addTeamMember, showToast]
  );

  // Handle removing team member
  const handleRemoveTeamMember = useCallback(
    async (teamId: string, memberId: string) => {
      try {
        const updatedTeam = await removeTeamMember(teamId, memberId);

        if (updatedTeam) {
          showToast({
            title: "Member Removed",
            description: "Team member has been removed successfully.",
            status: "success",
          });

          return updatedTeam;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to remove team member",
          status: "error",
        });

        return null;
      }
    },
    [removeTeamMember, showToast]
  );

  // Handle changing team lead
  const handleChangeTeamLead = useCallback(
    async (teamId: string, newLeadId: string) => {
      try {
        const updatedTeam = await changeTeamLead(teamId, newLeadId);

        if (updatedTeam) {
          showToast({
            title: "Team Lead Changed",
            description: "Team lead has been changed successfully.",
            status: "success",
          });

          return updatedTeam;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to change team lead",
          status: "error",
        });

        return null;
      }
    },
    [changeTeamLead, showToast]
  );

  // Handle creating invitation
  const handleCreateInvitation = useCallback(
    async (
      teamId: string,
      invitationData: { email: string; role?: "lead" | "member" }
    ) => {
      try {
        const newInvitation = await createInvitation(teamId, invitationData);

        if (newInvitation) {
          showToast({
            title: "Invitation Sent",
            description: `Invitation has been sent to ${invitationData.email}.`,
            status: "success",
          });

          return newInvitation;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to send invitation",
          status: "error",
        });

        return null;
      }
    },
    [createInvitation, showToast]
  );

  // Handle revoking invitation
  const handleRevokeInvitation = useCallback(
    async (id: string) => {
      try {
        const revokedInvitation = await revokeInvitation(id);

        if (revokedInvitation) {
          showToast({
            title: "Invitation Revoked",
            description: "Invitation has been revoked successfully.",
            status: "success",
          });

          return revokedInvitation;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to revoke invitation",
          status: "error",
        });

        return null;
      }
    },
    [revokeInvitation, showToast]
  );

  // Handle resending invitation
  const handleResendInvitation = useCallback(
    async (id: string) => {
      try {
        const resentInvitation = await resendInvitation(id);

        if (resentInvitation) {
          showToast({
            title: "Invitation Resent",
            description: "Invitation has been resent successfully.",
            status: "success",
          });

          return resentInvitation;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to resend invitation",
          status: "error",
        });

        return null;
      }
    },
    [resendInvitation, showToast]
  );

  // Load team details
  const loadTeamDetails = useCallback(
    async (id: string) => {
      try {
        const team = await fetchTeamById(id);

        if (team) {
          setSelectedTeam(team);
          return team;
        }

        return null;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to load team details",
          status: "error",
        });

        return null;
      }
    },
    [fetchTeamById, showToast]
  );

  // Load team invitations
  const loadTeamInvitations = useCallback(
    async (teamId: string) => {
      try {
        await fetchTeamInvitations(teamId);
        return true;
      } catch (err: any) {
        showToast({
          title: "Error",
          description: err.message || "Failed to load team invitations",
          status: "error",
        });

        return false;
      }
    },
    [fetchTeamInvitations, showToast]
  );

  return {
    // State
    teams,
    myTeams,
    currentTeam,
    selectedTeam,
    selectedMember,
    selectedInvitation,
    teamInvitations,
    isLoading,
    error,

    // Setters
    setSelectedTeam,
    setSelectedMember,
    setSelectedInvitation,
    setCurrentTeam,

    // Team operations
    fetchTeams,
    fetchMyTeams,
    fetchTeamById,
    loadTeamDetails,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,

    // Member operations
    handleAddTeamMember,
    handleRemoveTeamMember,
    handleChangeTeamLead,

    // Invitation operations
    loadTeamInvitations,
    handleCreateInvitation,
    handleRevokeInvitation,
    handleResendInvitation,

    // Invitation code operations
    generateInvitationCode: async (
      teamId: string,
      role: "lead" | "member" = "member"
    ) => {
      try {
        const code = await teamApi.generateInvitationCode(teamId, role);
        showToast({
          title: "Success",
          description: `Invitation code generated for ${role} role`,
          status: "success",
        });
        return code;
      } catch (error: any) {
        showToast({
          title: "Error",
          description: error.message || "Failed to generate invitation code",
          status: "error",
        });
        throw error;
      }
    },

    listInvitationCodes: async (teamId: string) => {
      try {
        const codes = await teamApi.listInvitationCodes(teamId);
        return codes;
      } catch (error: any) {
        showToast({
          title: "Error",
          description: error.message || "Failed to list invitation codes",
          status: "error",
        });
        throw error;
      }
    },

    revokeInvitationCode: async (teamId: string, codeId: string) => {
      try {
        await teamApi.revokeInvitationCode(teamId, codeId);
        showToast({
          title: "Success",
          description: "Invitation code revoked successfully",
          status: "success",
        });
        return true;
      } catch (error: any) {
        showToast({
          title: "Error",
          description: error.message || "Failed to revoke invitation code",
          status: "error",
        });
        throw error;
      }
    },

    // Fetch users for bulk operations
    fetchUsers: async () => {
      try {
        // In a real implementation, this would call an API endpoint
        // For now, we'll return mock data
        const response = await fetch("/api/users").catch(() => ({ ok: false }));

        // If the API call fails, use mock data
        if (!response.ok) {
          console.log("Using mock user data");
          return [
            {
              id: "user1",
              name: "John Doe",
              email: "john@example.com",
              role: "admin",
            },
            {
              id: "user2",
              name: "Jane Smith",
              email: "jane@example.com",
              role: "member",
            },
            {
              id: "user3",
              name: "Bob Johnson",
              email: "bob@example.com",
              role: "member",
            },
            {
              id: "user4",
              name: "Alice Williams",
              email: "alice@example.com",
              role: "lead",
            },
            {
              id: "user5",
              name: "Charlie Brown",
              email: "charlie@example.com",
              role: "member",
            },
            {
              id: "user6",
              name: "Diana Prince",
              email: "diana@example.com",
              role: "member",
            },
            {
              id: "user7",
              name: "Ethan Hunt",
              email: "ethan@example.com",
              role: "member",
            },
            {
              id: "user8",
              name: "Fiona Apple",
              email: "fiona@example.com",
              role: "member",
            },
          ];
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error fetching users:", error);
        showToast({
          title: "Error",
          description: "Failed to fetch users",
          status: "error",
        });

        // Return mock data as fallback
        return [
          {
            id: "user1",
            name: "John Doe",
            email: "john@example.com",
            role: "admin",
          },
          {
            id: "user2",
            name: "Jane Smith",
            email: "jane@example.com",
            role: "member",
          },
          {
            id: "user3",
            name: "Bob Johnson",
            email: "bob@example.com",
            role: "member",
          },
          {
            id: "user4",
            name: "Alice Williams",
            email: "alice@example.com",
            role: "lead",
          },
          {
            id: "user5",
            name: "Charlie Brown",
            email: "charlie@example.com",
            role: "member",
          },
        ];
      }
    },
  };
};
