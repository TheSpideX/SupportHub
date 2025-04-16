import React, { useState, useEffect } from "react";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";
import { FaUserPlus, FaSearch, FaSpinner } from "react-icons/fa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useGetUsersQuery } from "@/api/userApiRTK";
import { Checkbox } from "@/components/ui/Checkbox";

interface AddExistingMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName?: string;
  onSuccess?: () => void;
}

const AddExistingMemberModal: React.FC<AddExistingMemberModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  onSuccess,
}) => {
  const {
    handleAddTeamMember,
    fetchTeamById,
    isLoading: isTeamLoading,
  } = useTeamManagement();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all users
  const { data: usersData, isLoading: isUsersLoading } = useGetUsersQuery({
    role: "support", // Only get support users
  });

  // Fetch team members when the modal opens
  useEffect(() => {
    if (isOpen && teamId) {
      const loadTeamMembers = async () => {
        try {
          const team = await fetchTeamById(teamId);
          if (team && team.members) {
            // Extract member IDs
            const memberIds = team.members.map(
              (member: any) => member.userId._id || member.userId
            );
            setTeamMembers(memberIds);
          }
        } catch (error) {
          console.error("Error loading team members:", error);
          toast.error("Failed to load team members");
        }
      };

      loadTeamMembers();
    }
  }, [isOpen, teamId, fetchTeamById]);

  // Filter users who are not already in the team
  const availableUsers =
    usersData?.data?.filter(
      (user) =>
        !teamMembers.includes(user._id) &&
        (searchQuery === "" ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.profile?.firstName + " " + user.profile?.lastName)
            .toLowerCase()
            .includes(searchQuery.toLowerCase()))
    ) || [];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleRoleChange = (value: string) => {
    setSelectedRole(value);
  };

  const handleUserSelect = (userId: string) => {
    if (!userId) return; // Guard against empty userId

    setSelectedUsers((prev) => {
      // Check if user is already selected
      const isSelected = prev.includes(userId);

      if (isSelected) {
        // Remove user from selection
        return prev.filter((id) => id !== userId);
      } else {
        // Add user to selection
        return [...prev, userId];
      }
    });
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setIsSubmitting(true);

    try {
      // Add each selected user to the team
      for (const userId of selectedUsers) {
        await handleAddTeamMember(teamId, {
          userId,
          role: selectedRole as "member" | "lead",
        });
      }

      toast.success(
        `${selectedUsers.length} member(s) added to the team successfully!`
      );

      // Reset state
      setSelectedUsers([]);
      setSearchQuery("");

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to add members to team");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setSelectedUsers([]);
    setSearchQuery("");
    setSelectedRole("member");

    // Close modal
    onClose();
  };

  const isLoading = isUsersLoading || isTeamLoading;

  return (
    <SafeModal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-2xl"
      title="Add Existing Members"
      description={
        teamName
          ? `Add existing support members to ${teamName}`
          : "Add existing support members to the team"
      }
    >
      <div className="space-y-4 mt-4">
        {/* Search and filter */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="h-4 w-4 text-gray-500" />
          </div>
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="bg-gray-800 border-gray-700 pl-10"
          />
        </div>

        {/* Role selection */}
        <div className="space-y-2">
          <label
            htmlFor="role"
            className="block text-sm font-medium text-gray-300"
          >
            Role for selected members
          </label>
          <Select value={selectedRole} onValueChange={handleRoleChange}>
            <SelectTrigger className="bg-gray-800 border-gray-700">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="member">Team Member</SelectItem>
              <SelectItem value="lead">Team Lead</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User list */}
        <div className="border border-gray-700 rounded-md overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-6">
                <FaSpinner className="animate-spin h-6 w-6 text-blue-500" />
                <span className="ml-2 text-gray-300">Loading users...</span>
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                {searchQuery
                  ? "No matching users found"
                  : "No available users to add"}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                    >
                      <Checkbox
                        checked={
                          availableUsers.length > 0 &&
                          selectedUsers.length === availableUsers.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            // Select all available users
                            const allUserIds = availableUsers.map(
                              (user) => user._id
                            );
                            setSelectedUsers(allUserIds);
                          } else {
                            // Deselect all users
                            setSelectedUsers([]);
                          }
                        }}
                        aria-label="Select all users"
                      />
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                    >
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {availableUsers.map((user) => (
                    <tr
                      key={user._id}
                      className={`hover:bg-gray-700 cursor-pointer ${
                        selectedUsers.includes(user._id) ? "bg-blue-900/30" : ""
                      }`}
                      onClick={(e) => {
                        // Only handle row clicks, not checkbox clicks
                        if (
                          e.target instanceof HTMLElement &&
                          !e.target.closest('input[type="checkbox"]')
                        ) {
                          handleUserSelect(user._id);
                        }
                      }}
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedUsers.includes(user._id)}
                          onCheckedChange={(checked) => {
                            // Handle checkbox clicks separately
                            if (checked) {
                              if (!selectedUsers.includes(user._id)) {
                                setSelectedUsers((prev) => [...prev, user._id]);
                              }
                            } else {
                              setSelectedUsers((prev) =>
                                prev.filter((id) => id !== user._id)
                              );
                            }
                          }}
                          aria-label={`Select ${user.profile?.firstName} ${user.profile?.lastName}`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">
                          {user.profile?.firstName} {user.profile?.lastName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">
                          {user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{user.role}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="pt-2">
          <p className="text-sm text-gray-400">
            {selectedUsers.length} user(s) selected
          </p>
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedUsers.length === 0}
            className="bg-blue-600 hover:bg-blue-700 flex items-center"
          >
            {isSubmitting ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Adding...
              </>
            ) : (
              <>
                <FaUserPlus className="mr-2" />
                Add Selected Members
              </>
            )}
          </Button>
        </DialogFooter>
      </div>
    </SafeModal>
  );
};

export default AddExistingMemberModal;
