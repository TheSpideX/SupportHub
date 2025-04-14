import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/buttons/Button";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";
import { FaUserPlus, FaUserMinus, FaCrown, FaEllipsisH } from "react-icons/fa";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  // Load team data when modal opens
  useEffect(() => {
    if (isOpen && teamId) {
      loadTeamData();
    }
  }, [isOpen, teamId]);

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

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="bg-gray-900 text-white border-gray-800 max-w-3xl">
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
              </div>
              <Button
                onClick={onAddMember}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FaUserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {team?.members.length ? (
                    team.members.map((member) => (
                      <tr
                        key={member.id}
                        className="border-b border-gray-800/30"
                      >
                        <td className="px-4 py-3 flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-blue-300 mr-3">
                            {member.name.charAt(0) +
                              (member.name.split(" ")[1]?.charAt(0) || "")}
                          </div>
                          <div>
                            <div className="font-medium text-white flex items-center">
                              {member.name}
                              {member.id === team.leadId && (
                                <FaCrown
                                  className="ml-2 h-3 w-3 text-yellow-500"
                                  title="Team Lead"
                                />
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {member.email}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {member.role}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                              >
                                <FaEllipsisH className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-gray-800 border-gray-700 text-white">
                              {member.id !== team.leadId && (
                                <DropdownMenuItem
                                  onClick={() => handlePromoteToLead(member.id)}
                                  disabled={actionInProgress === member.id}
                                  className="hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <FaCrown className="h-4 w-4 mr-2 text-yellow-500" />
                                  Make Team Lead
                                </DropdownMenuItem>
                              )}
                              {member.id !== team.leadId && (
                                <DropdownMenuItem
                                  onClick={() => handleRemoveMember(member.id)}
                                  disabled={actionInProgress === member.id}
                                  className="text-red-400 hover:bg-gray-700 focus:bg-gray-700"
                                >
                                  <FaUserMinus className="h-4 w-4 mr-2" />
                                  Remove from Team
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-gray-400"
                      >
                        No team members found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TeamMembersModal;
