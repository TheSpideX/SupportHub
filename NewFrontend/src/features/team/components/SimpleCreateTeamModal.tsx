import React, { useState } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";
import { FaPlus } from "react-icons/fa";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SimpleCreateTeamModal: React.FC<CreateTeamModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    teamType: "support" as "support" | "technical",
  });

  const [errors, setErrors] = useState({
    name: "",
    description: "",
    teamType: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const { handleCreateTeam } = useTeamManagement();

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {
      name: "",
      description: "",
      teamType: "",
    };

    if (!formData.name.trim()) {
      newErrors.name = "Team name is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!formData.teamType) {
      newErrors.teamType = "Team type is required";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      await handleCreateTeam({
        name: formData.name,
        description: formData.description,
        teamType: formData.teamType,
      });

      toast.success("Team created successfully");

      // Reset form
      setFormData({
        name: "",
        description: "",
        teamType: "support",
      });

      // Call success callback first to trigger data refresh
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after a small delay to ensure refresh has started
      setTimeout(() => {
        onClose();
      }, 50);
    } catch (error: any) {
      toast.error(error.message || "Failed to create team");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    // Reset form state
    setFormData({
      name: "",
      description: "",
      teamType: "support",
    });
    setErrors({
      name: "",
      description: "",
      teamType: "",
    });

    // Call onClose
    onClose();
  };

  return (
    <SafeModal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center">
          <FaPlus className="mr-2 h-4 w-4" />
          Create New Team
        </div>
      }
      description="Create a new team and assign members to it."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Team Name */}
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-200"
          >
            Team Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-3 py-2 bg-gray-800 border ${
              errors.name ? "border-red-500" : "border-gray-700"
            } rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="Enter team name"
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        {/* Team Description */}
        <div className="space-y-2">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-200"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className={`w-full px-3 py-2 bg-gray-800 border ${
              errors.description ? "border-red-500" : "border-gray-700"
            } rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="Enter team description"
          />
          {errors.description && (
            <p className="text-sm text-red-500">{errors.description}</p>
          )}
        </div>

        {/* Team Type */}
        <div className="space-y-2">
          <label
            htmlFor="teamType"
            className="block text-sm font-medium text-gray-200"
          >
            Team Type
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Technical Team */}
            <div
              className={`cursor-pointer rounded-lg border p-4 ${
                formData.teamType === "technical"
                  ? "bg-purple-900/30 border-purple-500"
                  : "bg-gray-800/50 border-gray-700 hover:bg-gray-800"
              }`}
              onClick={() =>
                setFormData((prev) => ({ ...prev, teamType: "technical" }))
              }
            >
              <div className="font-medium text-white mb-1">Technical Team</div>
              <div className="text-sm text-gray-400">
                Handles technical issues and bug fixes
              </div>
            </div>

            {/* Support Team */}
            <div
              className={`cursor-pointer rounded-lg border p-4 ${
                formData.teamType === "support"
                  ? "bg-blue-900/30 border-blue-500"
                  : "bg-gray-800/50 border-gray-700 hover:bg-gray-800"
              }`}
              onClick={() =>
                setFormData((prev) => ({ ...prev, teamType: "support" }))
              }
            >
              <div className="font-medium text-white mb-1">Support Team</div>
              <div className="text-sm text-gray-400">
                Handles customer queries and support
              </div>
            </div>
          </div>
          {errors.teamType && (
            <p className="text-sm text-red-500">{errors.teamType}</p>
          )}
        </div>

        {/* Form Actions */}
        <DialogFooter className="pt-4">
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
            {isLoading ? "Creating..." : "Create Team"}
          </Button>
        </DialogFooter>
      </form>
    </SafeModal>
  );
};

export default SimpleCreateTeamModal;
