import React, { useState } from "react";
import { DialogFooter } from "@/components/ui/dialog";
import SafeModal from "@/components/ui/modal/SafeModal";
import { Button } from "@/components/ui/buttons/Button";
import { useOrganizationManagement } from "../hooks/useOrganizationManagement";
import { toast } from "react-hot-toast";
import { FaPlus } from "react-icons/fa";

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "business" as "business" | "educational" | "nonprofit" | "government" | "other",
  });

  const [errors, setErrors] = useState({
    name: "",
    description: "",
    type: "",
  });

  const { handleCreateOrganization, isLoading } = useOrganizationManagement();

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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

  // Validate form
  const validateForm = () => {
    let valid = true;
    const newErrors = { ...errors };

    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required";
      valid = false;
    } else if (formData.name.length < 2) {
      newErrors.name = "Organization name must be at least 2 characters";
      valid = false;
    } else if (formData.name.length > 100) {
      newErrors.name = "Organization name cannot exceed 100 characters";
      valid = false;
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = "Description cannot exceed 500 characters";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const success = await handleCreateOrganization({
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
      });

      if (success) {
        // Reset form
        setFormData({
          name: "",
          description: "",
          type: "business",
        });

        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create organization");
    }
  };

  // Handle close
  const handleClose = () => {
    // Reset form state
    setFormData({
      name: "",
      description: "",
      type: "business",
    });
    setErrors({
      name: "",
      description: "",
      type: "",
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
          Create New Organization
        </div>
      }
      description="Create a new organization to manage teams and customers."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Organization Name */}
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-200"
          >
            Organization Name
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
            placeholder="Enter organization name"
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        {/* Organization Type */}
        <div className="space-y-2">
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-200"
          >
            Organization Type
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className={`w-full px-3 py-2 bg-gray-800 border ${
              errors.type ? "border-red-500" : "border-gray-700"
            } rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="business">Business</option>
            <option value="educational">Educational</option>
            <option value="nonprofit">Non-profit</option>
            <option value="government">Government</option>
            <option value="other">Other</option>
          </select>
          {errors.type && <p className="text-sm text-red-500">{errors.type}</p>}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-200"
          >
            Description (Optional)
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
            placeholder="Enter organization description"
          />
          {errors.description && (
            <p className="text-sm text-red-500">{errors.description}</p>
          )}
        </div>

        {/* Form Actions */}
        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Organization"}
          </Button>
        </DialogFooter>
      </form>
    </SafeModal>
  );
};

export default CreateOrganizationModal;
