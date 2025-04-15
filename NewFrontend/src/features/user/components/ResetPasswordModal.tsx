import React, { useState } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { userApi, User } from "@/api/userApi";
import { FaLock } from "react-icons/fa";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user,
}) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    // Check if password contains uppercase, lowercase, number, and special character
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      toast.error(
        "Password must contain uppercase, lowercase, number, and special character"
      );
      return;
    }

    setLoading(true);

    try {
      await userApi.resetUserPassword(user.id, newPassword);
      toast.success("Password reset successfully");
      onSuccess();
      resetForm();
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <SafeModal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center">
          <FaLock className="text-blue-500 mr-2 h-4 w-4" />
          Reset Password
        </div>
      }
      className="max-w-md"
      description={`Reset password for ${user.firstName} ${user.lastName} (${user.email})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white"
            required
          />
          <p className="text-xs text-gray-400">
            Password must contain uppercase, lowercase, number, and special
            character
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white"
            required
          />
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="border-gray-600 text-gray-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </div>
      </form>
    </SafeModal>
  );
};

export default ResetPasswordModal;
