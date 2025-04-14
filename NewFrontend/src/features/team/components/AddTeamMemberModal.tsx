import React, { useState } from "react";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { Input } from "@/components/ui/input";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";
import { FaEnvelope } from "react-icons/fa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName?: string;
  onSuccess?: () => void;
}

const AddTeamMemberModal: React.FC<AddTeamMemberModalProps> = ({
  isOpen,
  onClose,
  teamId,
  teamName,
  onSuccess,
}) => {
  const { handleCreateInvitation: createInvitation, isLoading } =
    useTeamManagement();

  const [formData, setFormData] = useState({
    email: "",
    role: "member",
  });

  const [errors, setErrors] = useState({
    email: "",
    role: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      role: value,
    }));

    // Clear error
    if (errors.role) {
      setErrors((prev) => ({
        ...prev,
        role: "",
      }));
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: "", role: "" };

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
      isValid = false;
    }

    if (!formData.role) {
      newErrors.role = "Role is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await createInvitation(teamId, {
        email: formData.email,
        role: formData.role as "member" | "lead",
      });

      toast.success("Invitation sent successfully!");
      setFormData({ email: "", role: "member" });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    }
  };

  const handleClose = () => {
    // Reset form state
    setFormData({ email: "", role: "member" });
    setErrors({ email: "", role: "" });

    // Call onClose directly
    onClose();
  };

  return (
    <SafeModal isOpen={isOpen} onClose={handleClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-xl font-semibold">
          Add Team Member
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          {teamName
            ? `Invite a new member to join ${teamName}`
            : "Invite a new member to join the team"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-300"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaEnvelope className="h-4 w-4 text-gray-500" />
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="colleague@example.com"
              className={`bg-gray-800 border-gray-700 pl-10 ${
                errors.email ? "border-red-500" : ""
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-500 mt-1">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="role"
            className="block text-sm font-medium text-gray-300"
          >
            Role
          </label>
          <Select value={formData.role} onValueChange={handleRoleChange}>
            <SelectTrigger
              className={`bg-gray-800 border-gray-700 ${
                errors.role ? "border-red-500" : ""
              }`}
            >
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="member">Team Member</SelectItem>
              <SelectItem value="lead">Team Lead</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && (
            <p className="text-sm text-red-500 mt-1">{errors.role}</p>
          )}
        </div>

        <div className="pt-2">
          <p className="text-sm text-gray-400">
            An invitation email will be sent to this address. The recipient will
            need to accept the invitation to join the team.
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
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </form>
    </SafeModal>
  );
};

export default AddTeamMemberModal;
