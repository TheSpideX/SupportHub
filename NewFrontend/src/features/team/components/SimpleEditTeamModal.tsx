import React, { useState, useEffect } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";
import { FaEdit } from "react-icons/fa";

interface EditTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  initialData: {
    name: string;
    description: string;
  };
  onSuccess?: () => void;
}

const SimpleEditTeamModal: React.FC<EditTeamModalProps> = ({
  isOpen,
  onClose,
  teamId,
  initialData,
  onSuccess,
}) => {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const [errors, setErrors] = useState({
    name: "",
    description: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const { handleUpdateTeam } = useTeamManagement();

  // Load team data when modal opens
  useEffect(() => {
    if (isOpen && teamId) {
      // Set initial data
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
      });

      // No need to fetch team data just for the team type since we're not allowing it to be changed
    }
  }, [isOpen, teamId, initialData]);

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
    };

    if (!formData.name.trim()) {
      newErrors.name = "Team name is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
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
      await handleUpdateTeam(teamId, {
        name: formData.name,
        description: formData.description,
      });

      toast.success("Team updated successfully");

      // Call success callback first to trigger data refresh
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after a small delay to ensure refresh has started
      setTimeout(() => {
        onClose();
      }, 50);
    } catch (error: any) {
      toast.error(error.message || "Failed to update team");
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
    });
    setErrors({
      name: "",
      description: "",
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
          <FaEdit className="mr-2 h-4 w-4" />
          Edit Team
        </div>
      }
      description="Update team information."
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

        {/* Team Type is not editable */}

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
            {isLoading ? "Updating..." : "Update Team"}
          </Button>
        </DialogFooter>
      </form>
    </SafeModal>
  );
};

export default SimpleEditTeamModal;
