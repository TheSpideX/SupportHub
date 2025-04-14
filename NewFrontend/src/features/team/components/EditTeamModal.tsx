import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/buttons/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";

interface EditTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  initialData?: {
    name: string;
    description: string;
  };
  onSuccess?: () => void;
}

const EditTeamModal: React.FC<EditTeamModalProps> = ({
  isOpen,
  onClose,
  teamId,
  initialData,
  onSuccess,
}) => {
  const {
    handleUpdateTeam: updateTeam,
    isLoading,
    fetchTeamById,
  } = useTeamManagement();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const [errors, setErrors] = useState({
    name: "",
    description: "",
  });

  const [isLoadingTeam, setIsLoadingTeam] = useState(false);

  // Load team data when modal opens
  useEffect(() => {
    if (isOpen && teamId) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          description: initialData.description,
        });
      } else {
        loadTeamData();
      }
    }
  }, [isOpen, teamId, initialData]);

  const loadTeamData = async () => {
    setIsLoadingTeam(true);
    try {
      const team = await fetchTeamById(teamId);
      if (team) {
        setFormData({
          name: team.name,
          description: team.description,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load team data");
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
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

  const validateForm = () => {
    let isValid = true;
    const newErrors = { name: "", description: "" };

    if (!formData.name.trim()) {
      newErrors.name = "Team name is required";
      isValid = false;
    } else if (formData.name.length < 3) {
      newErrors.name = "Team name must be at least 3 characters";
      isValid = false;
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await updateTeam(teamId, {
        name: formData.name,
        description: formData.description,
      });

      toast.success("Team updated successfully!");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update team");
    }
  };

  const handleClose = () => {
    // Reset form state
    setFormData({ name: "", description: "" });
    setErrors({ name: "", description: "" });

    // Call onClose directly
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="bg-gray-900 text-white border-gray-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Edit Team</DialogTitle>
          <DialogDescription className="text-gray-400">
            Update team information
          </DialogDescription>
        </DialogHeader>

        {isLoadingTeam ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-300"
              >
                Team Name
              </label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Technical Support"
                className={`bg-gray-800 border-gray-700 ${
                  errors.name ? "border-red-500" : ""
                }`}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-300"
              >
                Description
              </label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the team's purpose and responsibilities"
                className={`bg-gray-800 border-gray-700 min-h-[100px] ${
                  errors.description ? "border-red-500" : ""
                }`}
              />
              {errors.description && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.description}
                </p>
              )}
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
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditTeamModal;
