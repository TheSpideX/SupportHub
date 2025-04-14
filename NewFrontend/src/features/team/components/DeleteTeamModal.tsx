import React, { useState } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";
import { FaExclamationTriangle } from "react-icons/fa";

interface DeleteTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName?: string;
  onSuccess?: () => void;
}

const DeleteTeamModal: React.FC<DeleteTeamModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  onSuccess,
}) => {
  const { handleDeleteTeam: deleteTeam, isLoading } = useTeamManagement();
  const [confirmText, setConfirmText] = useState("");

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmText(e.target.value);
  };

  const handleDeleteTeam = async () => {
    try {
      const success = await deleteTeam(teamId);

      if (success) {
        toast.success("Team deleted successfully");

        // Call onSuccess callback to refresh team lists
        if (onSuccess) {
          console.log("Calling onSuccess after team deletion");
          onSuccess();
        }

        // Close the modal
        onClose();
      } else {
        toast.error("Failed to delete team");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete team");
    }
  };

  const isConfirmValid = confirmText.toLowerCase() === "delete";

  // Handle close
  const handleClose = () => {
    // Reset form state
    setConfirmText("");

    // Call onClose
    onClose();
  };

  return (
    <SafeModal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center text-red-500">
          <FaExclamationTriangle className="mr-2 h-5 w-5" />
          Delete Team
        </div>
      }
      description={`This action cannot be undone. This will permanently delete the${
        teamName ? ` "${teamName}"` : ""
      } team and remove all associated data.`}
      className="max-w-md"
    >
      <div className="space-y-4 mt-2">
        <div className="bg-gray-800/50 p-4 rounded-md border border-red-500/20">
          <p className="text-sm text-gray-300">
            Please type{" "}
            <span className="font-semibold text-red-400">delete</span> to
            confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={handleConfirmChange}
            className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="Type 'delete' to confirm"
          />
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
            onClick={handleDeleteTeam}
            disabled={!isConfirmValid || isLoading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-gray-400"
          >
            {isLoading ? "Deleting..." : "Delete Team"}
          </Button>
        </DialogFooter>
      </div>
    </SafeModal>
  );
};

export default DeleteTeamModal;
