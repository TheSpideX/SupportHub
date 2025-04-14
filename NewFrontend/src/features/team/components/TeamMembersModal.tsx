import React, { useState, useEffect, useRef } from "react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";
import { FaUserPlus } from "react-icons/fa";
import InvitationCodeManager from "./InvitationCodeManager";
import VirtualizedMembersList from "./VirtualizedMembersList";
import { useResizeObserver } from "@/hooks/useResizeObserver";

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  onAddMember?: () => void;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
  leadId: string;
}

const TeamMembersModal: React.FC<TeamMembersModalProps> = ({
  isOpen,
  onClose,
  teamId,
  onAddMember,
}) => {
  const {
    fetchTeamById,
    handleRemoveTeamMember: removeTeamMember,
    handleChangeTeamLead: changeTeamLead,
    isLoading,
  } = useTeamManagement();

  const [team, setTeam] = useState<Team | null>(null);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [actionInProgress, setActionInProgress] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [membersPerPage] = useState(10);
  const [displayedMembers, setDisplayedMembers] = useState<TeamMember[]>([]);

  // Container ref for virtualized list
  const { ref: containerRef, dimensions } = useResizeObserver<HTMLDivElement>();

  // Load team data when modal opens
  useEffect(() => {
    if (isOpen && teamId) {
      loadTeamData();
      // Reset pagination when modal opens
      setCurrentPage(1);
    }
  }, [isOpen, teamId]);

  // Update displayed members when team or pagination changes
  useEffect(() => {
    if (team && team.members) {
      const indexOfLastMember = currentPage * membersPerPage;
      const indexOfFirstMember = indexOfLastMember - membersPerPage;
      setDisplayedMembers(
        team.members.slice(indexOfFirstMember, indexOfLastMember)
      );
    }
  }, [team, currentPage, membersPerPage]);

  const loadTeamData = async () => {
    setIsLoadingTeam(true);
    try {
      const teamData = await fetchTeamById(teamId);
      if (teamData) {
        // Convert API team to UI team format
        setTeam({
          id: teamData._id || teamData.id,
          name: teamData.name,
          description: teamData.description,
          members: (teamData.members || []).map((member: any) => {
            // Extract user data safely
            const userId =
              member.userId ||
              (member.user && (member.user._id || member.user.id)) ||
              member.id;

            // Get user profile data
            let userName = "Unknown";
            let userEmail = "";

            if (member.user) {
              // If user object is populated
              if (member.user.profile) {
                const firstName = member.user.profile.firstName || "";
                const lastName = member.user.profile.lastName || "";
                userName = `${firstName} ${lastName}`.trim() || "Unknown";
              } else if (member.user.name) {
                userName = member.user.name;
              }

              userEmail = member.user.email || "";
            } else if (member.name) {
              // If name is directly on the member
              userName = member.name;
            } else if (
              userId === teamData.createdBy?._id ||
              userId === teamData.createdBy?.id ||
              userId === teamData.createdBy
            ) {
              // If this is the creator and we have creator info
              userName = "Team Creator";
            }

            if (member.email) {
              userEmail = member.email;
            }

            // Determine role with better display name
            let userRole = member.role || "member";
            if (userRole === "lead") {
              userRole = "Team Lead";
            } else if (userRole === "member") {
              userRole = "Member";
            }

            console.log("Processing member:", {
              member,
              userId,
              userName,
              userEmail,
              userRole,
            });

            return {
              id: userId,
              name: userName,
              email: userEmail,
              role: userRole,
            };
          }),
          leadId: teamData.leadId,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load team data");
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!team) return;

    // Prevent removing the team lead
    if (memberId === team.leadId) {
      toast.error("Cannot remove the team lead. Assign a new lead first.");
      return;
    }

    setActionInProgress(memberId);
    try {
      await removeTeamMember(team.id, memberId);
      toast.success("Team member removed successfully");
      loadTeamData(); // Reload team data
    } catch (error: any) {
      toast.error(error.message || "Failed to remove team member");
    } finally {
      setActionInProgress("");
    }
  };

  const handlePromoteToLead = async (memberId: string) => {
    if (!team) return;

    setActionInProgress(memberId);
    try {
      // Ensure memberId is a string
      const memberIdString = String(memberId);
      console.log("Promoting member to lead:", {
        teamId: team.id,
        newLeadId: memberIdString,
      });

      await changeTeamLead(team.id, memberIdString);
      toast.success("Team lead changed successfully");
      loadTeamData(); // Reload team data
    } catch (error: any) {
      console.error("Error changing team lead:", error);
      toast.error(error.message || "Failed to change team lead");
    } finally {
      setActionInProgress("");
    }
  };

  // Handle close
  const handleClose = () => {
    // Reset state before closing
    setTeam(null);
    setActionInProgress("");
    onClose();
  };

  return (
    <SafeModal isOpen={isOpen} onClose={handleClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle className="text-xl font-semibold">
          {team ? `${team.name} - Team Members` : "Team Members"}
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          Manage team members and their roles
        </DialogDescription>
      </DialogHeader>

      {isLoadingTeam ? (
        <div className="py-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">
                Members ({team?.members.length || 0})
              </h3>
              <div className="text-sm text-gray-400 flex items-center">
                <span className="mr-2">Team Type:</span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    team?.teamType === "technical"
                      ? "bg-purple-900 text-purple-200"
                      : "bg-blue-900 text-blue-200"
                  }`}
                >
                  {team?.teamType === "technical"
                    ? "Technical Team"
                    : "Support Team"}
                </span>
              </div>
            </div>
            <Button
              onClick={onAddMember}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <FaUserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </div>

          <div className="overflow-x-auto" ref={containerRef}>
            {team && (
              <VirtualizedMembersList
                members={displayedMembers}
                teamLeadId={team.leadId}
                onRemoveMember={handleRemoveMember}
                onMakeTeamLead={handlePromoteToLead}
                actionInProgress={actionInProgress}
                height={400}
                maxHeight={500} // Limit the maximum height to prevent modal overflow
                width={dimensions?.width || "100%"}
              />
            )}
          </div>

          {/* Pagination Controls */}
          {team && team.members.length > membersPerPage && (
            <div className="flex justify-between items-center mt-4 text-sm">
              <div className="text-gray-400">
                Showing{" "}
                {displayedMembers.length > 0
                  ? (currentPage - 1) * membersPerPage + 1
                  : 0}{" "}
                to {Math.min(currentPage * membersPerPage, team.members.length)}{" "}
                of {team.members.length} members
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-1 h-8 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={currentPage * membersPerPage >= team.members.length}
                  className="px-3 py-1 h-8 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Invitation Code Manager */}
          {team && <InvitationCodeManager teamId={team.id} />}
        </>
      )}
    </SafeModal>
  );
};

export default TeamMembersModal;
