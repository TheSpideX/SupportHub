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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTeamManagement } from "../hooks/useTeamManagement";
import { toast } from "react-hot-toast";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { handleCreateTeam: createTeam, isLoading } = useTeamManagement();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    teamType: "support", // Default to support team
  });

  const [errors, setErrors] = useState({
    name: "",
    description: "",
    teamType: "",
  });

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
    const newErrors = { name: "", description: "", teamType: "" };

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

    if (
      !formData.teamType ||
      !["technical", "support"].includes(formData.teamType)
    ) {
      newErrors.teamType = "Please select a valid team type";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await createTeam({
        name: formData.name,
        description: formData.description,
        teamType: formData.teamType,
      });

      toast.success("Team created successfully!");
      setFormData({ name: "", description: "", teamType: "support" });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create team");
    }
  };

  const handleClose = () => {
    // Reset form state
    setFormData({ name: "", description: "", teamType: "support" });
    setErrors({ name: "", description: "", teamType: "" });
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
          <DialogTitle className="text-xl font-semibold">
            Create New Team
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a new team to manage support tickets and members.
          </DialogDescription>
        </DialogHeader>

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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Team Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Support Team Card */}
              <div
                onClick={() =>
                  setFormData({ ...formData, teamType: "support" })
                }
                className={`cursor-pointer rounded-lg p-4 transition-all ${
                  formData.teamType === "support"
                    ? "bg-blue-900/50 border-2 border-blue-500 shadow-lg shadow-blue-900/20"
                    : "bg-gray-800 border border-gray-700 hover:bg-gray-750"
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      formData.teamType === "support"
                        ? "bg-blue-500"
                        : "bg-gray-700"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-white"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-2 0c0 .993-.241 1.929-.668 2.754l-1.524-1.525a3.997 3.997 0 00.078-2.183l1.562-1.562C15.802 8.249 16 9.1 16 10zm-5.165 3.913l1.58 1.58A5.98 5.98 0 0110 16a5.976 5.976 0 01-2.516-.552l1.562-1.562a4.006 4.006 0 001.789.027zm-4.677-2.796a4.002 4.002 0 01-.041-2.08l-.08.08-1.53-1.533A5.98 5.98 0 004 10c0 .954.223 1.856.619 2.657l1.54-1.54zm1.088-6.45A5.974 5.974 0 0110 4c.954 0 1.856.223 2.657.619l-1.54 1.54a4.002 4.002 0 00-2.346.033L7.246 4.668zM12 10a2 2 0 11-4 0 2 2 0 014 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3
                      className={`text-sm font-medium ${
                        formData.teamType === "support"
                          ? "text-blue-100"
                          : "text-gray-200"
                      }`}
                    >
                      Support Team
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Customer communication and issue management
                    </p>
                  </div>
                </div>
              </div>

              {/* Technical Team Card */}
              <div
                onClick={() =>
                  setFormData({ ...formData, teamType: "technical" })
                }
                className={`cursor-pointer rounded-lg p-4 transition-all ${
                  formData.teamType === "technical"
                    ? "bg-purple-900/50 border-2 border-purple-500 shadow-lg shadow-purple-900/20"
                    : "bg-gray-800 border border-gray-700 hover:bg-gray-750"
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      formData.teamType === "technical"
                        ? "bg-purple-500"
                        : "bg-gray-700"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-white"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3
                      className={`text-sm font-medium ${
                        formData.teamType === "technical"
                          ? "text-purple-100"
                          : "text-gray-200"
                      }`}
                    >
                      Technical Team
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Technical problem solving and implementation
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {errors.teamType && (
              <p className="text-sm text-red-500 mt-1">{errors.teamType}</p>
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
              <p className="text-sm text-red-500 mt-1">{errors.description}</p>
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
              {isLoading ? "Creating..." : "Create Team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTeamModal;
