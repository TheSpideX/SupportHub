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
      console.log("Team data received:", teamData);

      // Log the members structure for debugging
      if (teamData && teamData.members) {
        console.log("Team members structure:", teamData.members[0]);
      }

      if (teamData) {
        // Convert API team to UI team format
        setTeam({
          id: teamData._id || teamData.id,
          name: teamData.name,
          description: teamData.description,
          members: (teamData.members || []).map((member: any) => {
            // Extract user data safely - handle both nested structures
            let userId,
              userProfile,
              userEmail,
              userName = "Unknown";

            console.log("Processing member:", member);

            // Handle case where member is just an ID (no userId field)
            if (!member.userId && member._id && !member.user) {
              // This is a member without populated user data
              userId = member._id;
              userName = `Member ${member._id.substring(0, 6)}...`;
              userEmail = "";
              console.log("Member without populated user data:", member._id);
            }
            // Check if userId is an object (populated) or a string
            else if (member.userId && typeof member.userId === "object") {
              // Case: userId is populated with user object
              userId = member.userId._id || member.userId.id;
              userProfile = member.userId.profile;
              userEmail = member.userId.email || "";

              // Get name from profile or fullName
              if (userProfile) {
                const firstName = userProfile.firstName || "";
                const lastName = userProfile.lastName || "";
                userName =
                  `${firstName} ${lastName}`.trim() ||
                  member.userId.fullName ||
                  "Unknown";
              } else if (member.userId.fullName) {
                userName = member.userId.fullName;
              } else if (member.userId.name) {
                userName = member.userId.name;
              }
            } else if (member.user) {
              // Legacy case: user field is populated
              userId = member.user._id || member.user.id;
              userEmail = member.user.email || "";

              if (member.user.profile) {
                const firstName = member.user.profile.firstName || "";
                const lastName = member.user.profile.lastName || "";
                userName =
                  `${firstName} ${lastName}`.trim() ||
                  member.user.fullName ||
                  "Unknown";
              } else if (member.user.name) {
                userName = member.user.name;
              } else if (member.user.fullName) {
                userName = member.user.fullName;
              }
            } else {
              // Fallback to direct member properties
              userId = member.userId || member.id || member._id;
              userName = member.name || "Unknown";
              userEmail = member.email || "";
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
          leadId:
            teamData.leadId?._id || teamData.leadId?.id || teamData.leadId,
        });
      }
    } catch (error: any) {
      console.error("Error loading team data:", error);
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
    <SafeModal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-4xl"
      title={
        <div className="flex items-center space-x-2">
          <span className="text-xl font-semibold">
            {team ? `${team.name}` : "Team"}
          </span>
          <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">
            {team?.members?.length || 0} Members
          </span>
        </div>
      }
      description={
        team
          ? `Manage members and invitation codes for ${team.name}`
          : "Manage team members and invitation codes"
      }
    >
      {isLoadingTeam ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-400 text-sm">Loading team information...</p>
        </div>
      ) : !team ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="bg-gray-800 rounded-full p-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-400">Team information could not be loaded</p>
          <Button
            onClick={loadTeamData}
            className="mt-2 bg-blue-600 hover:bg-blue-700"
          >
            Try Again
          </Button>
        </div>
      ) : (
        <div>
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <div className="bg-blue-500/20 rounded-full p-2 mr-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">
                    Team Members
                  </h3>
                  <div className="flex items-center mt-1">
                    <span className="text-sm text-gray-400 mr-2">
                      {team?.members.length || 0} members
                    </span>
                    <span className="mx-2 text-gray-600">•</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        team?.teamType === "technical"
                          ? "bg-purple-900/50 text-purple-200"
                          : "bg-blue-900/50 text-blue-200"
                      }`}
                    >
                      {team?.teamType === "technical"
                        ? "Technical Team"
                        : "Support Team"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={onAddMember}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <FaUserPlus className="mr-2 h-4 w-4" />
                  Invite New Member
                </Button>
                <Button
                  onClick={() => {
                    onClose();
                    // Small delay to ensure this modal is closed before opening the next one
                    setTimeout(() => {
                      if (typeof onAddMember === "function") {
                        onAddMember();
                      }
                    }, 50);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <FaUserPlus className="mr-2 h-4 w-4" />
                  Add Existing Member
                </Button>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-lg border border-gray-700"
              ref={containerRef}
            >
              {team && team.members.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center bg-gray-800/30 text-center">
                  <div className="bg-gray-700/50 rounded-full p-3 mb-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-300 mb-1">
                    No team members yet
                  </h3>
                  <p className="text-gray-500 max-w-sm mb-4">
                    Start building your team by adding members or generating
                    invitation codes.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={onAddMember}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <FaUserPlus className="mr-2 h-4 w-4" />
                      Invite New Member
                    </Button>
                    <Button
                      onClick={() => {
                        onClose();
                        // Small delay to ensure this modal is closed before opening the next one
                        setTimeout(() => {
                          if (typeof onAddMember === "function") {
                            onAddMember();
                          }
                        }, 50);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <FaUserPlus className="mr-2 h-4 w-4" />
                      Add Existing Member
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800/30">
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
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {team && team.members.length > membersPerPage && (
              <div className="flex justify-between items-center mt-4 p-2 bg-gray-800/30 rounded-lg border border-gray-700/50 text-sm">
                <div className="text-gray-400 px-2">
                  <span className="hidden sm:inline">Showing </span>
                  <span className="font-medium text-gray-300">
                    {displayedMembers.length > 0
                      ? (currentPage - 1) * membersPerPage + 1
                      : 0}
                  </span>
                  <span className="mx-1">-</span>
                  <span className="font-medium text-gray-300">
                    {Math.min(
                      currentPage * membersPerPage,
                      team.members.length
                    )}
                  </span>
                  <span className="mx-1">of</span>
                  <span className="font-medium text-gray-300">
                    {team.members.length}
                  </span>
                  <span className="hidden sm:inline"> members</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="px-3 py-1 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </Button>
                  <Button
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    disabled={
                      currentPage * membersPerPage >= team.members.length
                    }
                    className="px-3 py-1 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Invitation Code Manager */}
          {team && (
            <div className="mt-6 bg-gray-800/50 rounded-lg border border-gray-700 p-4">
              <div className="mb-4">
                <div className="flex items-center mb-2">
                  <div className="bg-purple-500/20 rounded-full p-2 mr-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-purple-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">
                      Invitation Codes
                    </h3>
                    <p className="text-sm text-gray-400">
                      Generate and manage invitation codes for new team members
                    </p>
                  </div>
                </div>
              </div>
              <InvitationCodeManager teamId={team.id} />
            </div>
          )}
        </div>
      )}
    </SafeModal>
  );
};

export default TeamMembersModal;
