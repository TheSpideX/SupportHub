import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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

  const handleDelete = async () => {
    try {
      await deleteTeam(teamId);
      toast.success("Team deleted successfully");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete team");
    }
  };

  const isConfirmValid = confirmText.toLowerCase() === "delete";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="bg-gray-900 text-white border-gray-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center text-red-500">
            <FaExclamationTriangle className="mr-2 h-5 w-5" />
            Delete Team
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            This action cannot be undone. This will permanently delete the
            {teamName ? ` "${teamName}"` : ""} team and remove all associated
            data.
          </DialogDescription>
        </DialogHeader>

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
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!isConfirmValid || isLoading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:text-gray-400"
            >
              {isLoading ? "Deleting..." : "Delete Team"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTeamModal;
