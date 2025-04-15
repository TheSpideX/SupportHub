import React, { useState } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { toast } from "react-hot-toast";
import { userApi, User } from "@/api/userApi";
import { FaExclamationTriangle, FaTrash } from "react-icons/fa";

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User;
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user,
}) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      await userApi.deleteUser(user.id);
      toast.success("User deleted successfully");
      onSuccess();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <SafeModal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center">
          <FaTrash className="text-red-500 mr-2 h-4 w-4" />
          Delete User
        </div>
      }
      className="max-w-md"
      description="Are you sure you want to delete this user? This action cannot be undone."
    >
      <div className="mt-4">
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <div className="flex flex-col space-y-1">
            <p className="text-white font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-gray-300">{user.email}</p>
            <p className="text-gray-400">Role: {user.role}</p>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="border-gray-600 text-gray-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? "Deleting..." : "Delete User"}
          </Button>
        </div>
      </div>
    </SafeModal>
  );
};

export default DeleteUserModal;
