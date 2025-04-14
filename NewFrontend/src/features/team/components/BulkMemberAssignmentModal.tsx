import React, { useState, useEffect } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/Checkbox";
import { FaUserPlus, FaSpinner } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useTeamManagement } from "@/features/team/hooks/useTeamManagement";
import { extendedTeamApi as teamApi } from "@/api/teamApi";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type BulkMemberAssignmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedTeamIds: string[];
  onSuccess: () => void;
};

const BulkMemberAssignmentModal: React.FC<BulkMemberAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedTeamIds,
  onSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { fetchUsers } = useTeamManagement();

  // Fetch available users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    } else {
      // Reset state when modal closes
      setSearchQuery("");
      setSelectedUsers([]);
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // This would be replaced with an actual API call
      const users = await fetchUsers();
      setAvailableUsers(users);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load available users");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = availableUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((user) => user.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the new bulk add members API endpoint
      const result = await teamApi.bulkAddMembers(
        selectedTeamIds,
        selectedUsers
      );

      // Extract results from the API response
      const successful = result.results.successful.length;
      const failed = result.results.failed.length;
      const unauthorized = result.results.unauthorized.length;

      if (failed > 0 || unauthorized > 0) {
        toast.error(
          `Added members to ${successful} teams. Failed: ${failed}, Unauthorized: ${unauthorized}`
        );
      } else {
        toast.success(
          `Added ${selectedUsers.length} users to ${successful} teams`
        );
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to assign members:", error);
      toast.error("Failed to assign members to teams");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center">
          <FaUserPlus className="mr-2 h-4 w-4" />
          Bulk Assign Members
        </div>
      }
      description={`Assign members to ${selectedTeamIds.length} selected teams`}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="search-users">Search Users</Label>
          <Input
            id="search-users"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>

        <div className="border border-gray-700 rounded-md overflow-hidden">
          <div className="bg-gray-800 p-3 flex items-center justify-between border-b border-gray-700">
            <div className="flex items-center">
              <Checkbox
                id="select-all-users"
                checked={
                  filteredUsers.length > 0 &&
                  selectedUsers.length === filteredUsers.length
                }
                onCheckedChange={toggleSelectAll}
                className="mr-2 border-gray-600"
              />
              <Label htmlFor="select-all-users" className="cursor-pointer">
                Select All
              </Label>
            </div>
            <div className="text-sm text-gray-400">
              {selectedUsers.length} of {filteredUsers.length} selected
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <FaSpinner className="animate-spin h-6 w-6 text-blue-500" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No users found matching your search
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 flex items-center hover:bg-gray-800/50"
                  >
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                      className="mr-3 border-gray-600"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`user-${user.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {user.name}
                      </Label>
                      <div className="text-sm text-gray-400 truncate">
                        {user.email}
                      </div>
                    </div>
                    <div className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                      {user.role}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={selectedUsers.length === 0 || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>Assign to {selectedTeamIds.length} Teams</>
            )}
          </Button>
        </DialogFooter>
      </form>
    </SafeModal>
  );
};

export default BulkMemberAssignmentModal;
