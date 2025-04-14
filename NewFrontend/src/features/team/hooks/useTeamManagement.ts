import { useState, useCallback } from 'react';
import { useTeam } from '../context/TeamContext';
import { Team, TeamMember, Invitation } from '@/api/teamApi';
import { useToast } from '@/hooks/useToast';

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
    setCurrentTeam
  } = useTeam();
  
  const { showToast } = useToast();
  
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  
  // Handle team creation
  const handleCreateTeam = useCallback(async (teamData: { name: string; description?: string }) => {
    try {
      const newTeam = await createTeam(teamData);
      
      if (newTeam) {
        showToast({
          title: 'Team Created',
          description: `Team "${newTeam.name}" has been created successfully.`,
          status: 'success',
        });
        
        return newTeam;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to create team',
        status: 'error',
      });
      
      return null;
    }
  }, [createTeam, showToast]);
  
  // Handle team update
  const handleUpdateTeam = useCallback(async (id: string, teamData: { name?: string; description?: string }) => {
    try {
      const updatedTeam = await updateTeam(id, teamData);
      
      if (updatedTeam) {
        showToast({
          title: 'Team Updated',
          description: `Team "${updatedTeam.name}" has been updated successfully.`,
          status: 'success',
        });
        
        return updatedTeam;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to update team',
        status: 'error',
      });
      
      return null;
    }
  }, [updateTeam, showToast]);
  
  // Handle team deletion
  const handleDeleteTeam = useCallback(async (id: string) => {
    try {
      const success = await deleteTeam(id);
      
      if (success) {
        showToast({
          title: 'Team Deleted',
          description: 'Team has been deleted successfully.',
          status: 'success',
        });
        
        return true;
      }
      
      return false;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to delete team',
        status: 'error',
      });
      
      return false;
    }
  }, [deleteTeam, showToast]);
  
  // Handle adding team member
  const handleAddTeamMember = useCallback(async (teamId: string, memberData: { userId: string; role?: 'lead' | 'member' }) => {
    try {
      const updatedTeam = await addTeamMember(teamId, memberData);
      
      if (updatedTeam) {
        showToast({
          title: 'Member Added',
          description: 'Team member has been added successfully.',
          status: 'success',
        });
        
        return updatedTeam;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to add team member',
        status: 'error',
      });
      
      return null;
    }
  }, [addTeamMember, showToast]);
  
  // Handle removing team member
  const handleRemoveTeamMember = useCallback(async (teamId: string, memberId: string) => {
    try {
      const updatedTeam = await removeTeamMember(teamId, memberId);
      
      if (updatedTeam) {
        showToast({
          title: 'Member Removed',
          description: 'Team member has been removed successfully.',
          status: 'success',
        });
        
        return updatedTeam;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to remove team member',
        status: 'error',
      });
      
      return null;
    }
  }, [removeTeamMember, showToast]);
  
  // Handle changing team lead
  const handleChangeTeamLead = useCallback(async (teamId: string, newLeadId: string) => {
    try {
      const updatedTeam = await changeTeamLead(teamId, newLeadId);
      
      if (updatedTeam) {
        showToast({
          title: 'Team Lead Changed',
          description: 'Team lead has been changed successfully.',
          status: 'success',
        });
        
        return updatedTeam;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to change team lead',
        status: 'error',
      });
      
      return null;
    }
  }, [changeTeamLead, showToast]);
  
  // Handle creating invitation
  const handleCreateInvitation = useCallback(async (teamId: string, invitationData: { email: string; role?: 'lead' | 'member' }) => {
    try {
      const newInvitation = await createInvitation(teamId, invitationData);
      
      if (newInvitation) {
        showToast({
          title: 'Invitation Sent',
          description: `Invitation has been sent to ${invitationData.email}.`,
          status: 'success',
        });
        
        return newInvitation;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to send invitation',
        status: 'error',
      });
      
      return null;
    }
  }, [createInvitation, showToast]);
  
  // Handle revoking invitation
  const handleRevokeInvitation = useCallback(async (id: string) => {
    try {
      const revokedInvitation = await revokeInvitation(id);
      
      if (revokedInvitation) {
        showToast({
          title: 'Invitation Revoked',
          description: 'Invitation has been revoked successfully.',
          status: 'success',
        });
        
        return revokedInvitation;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to revoke invitation',
        status: 'error',
      });
      
      return null;
    }
  }, [revokeInvitation, showToast]);
  
  // Handle resending invitation
  const handleResendInvitation = useCallback(async (id: string) => {
    try {
      const resentInvitation = await resendInvitation(id);
      
      if (resentInvitation) {
        showToast({
          title: 'Invitation Resent',
          description: 'Invitation has been resent successfully.',
          status: 'success',
        });
        
        return resentInvitation;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to resend invitation',
        status: 'error',
      });
      
      return null;
    }
  }, [resendInvitation, showToast]);
  
  // Load team details
  const loadTeamDetails = useCallback(async (id: string) => {
    try {
      const team = await fetchTeamById(id);
      
      if (team) {
        setSelectedTeam(team);
        return team;
      }
      
      return null;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to load team details',
        status: 'error',
      });
      
      return null;
    }
  }, [fetchTeamById, showToast]);
  
  // Load team invitations
  const loadTeamInvitations = useCallback(async (teamId: string) => {
    try {
      await fetchTeamInvitations(teamId);
      return true;
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err.message || 'Failed to load team invitations',
        status: 'error',
      });
      
      return false;
    }
  }, [fetchTeamInvitations, showToast]);
  
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
  };
};
