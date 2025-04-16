import React, { useState, useEffect } from "react";
import {
  FaTicketAlt,
  FaExclamationCircle,
  FaUser,
  FaUsers,
  FaTags,
  FaSave,
} from "react-icons/fa";
import { useUpdateTicketMutation, Ticket } from "../api/ticketApi";
import { useGetTeamsQuery } from "@/api/teamApiRTK";
import { useGetUsersQuery } from "@/api/userApiRTK";
import { toast } from "react-hot-toast";

interface EditTicketFormProps {
  ticket: Ticket;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EditTicketForm: React.FC<EditTicketFormProps> = ({
  ticket,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "",
    priority: "",
    category: "",
    subcategory: "",
    assignedTo: "",
    primaryTeam: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [updateTicket, { isLoading }] = useUpdateTicketMutation();
  const { data: teamsData } = useGetTeamsQuery();
  const { data: usersData } = useGetUsersQuery();

  // Categories with subcategories
  const categories = [
    {
      name: "Infrastructure",
      subcategories: ["Network", "Server", "Cloud", "Storage", "Security"],
    },
    {
      name: "Software",
      subcategories: [
        "Application",
        "Database",
        "Operating System",
        "Integration",
        "API",
      ],
    },
    {
      name: "Hardware",
      subcategories: ["Desktop", "Laptop", "Mobile", "Printer", "Peripheral"],
    },
    {
      name: "Service Request",
      subcategories: [
        "Access",
        "Installation",
        "Configuration",
        "Upgrade",
        "Maintenance",
      ],
    },
    {
      name: "Other",
      subcategories: [
        "General Inquiry",
        "Feature Request",
        "Documentation",
        "Training",
      ],
    },
  ];

  // Status options
  const statusOptions = [
    { value: "new", label: "New" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "on_hold", label: "On Hold" },
    { value: "pending_customer", label: "Pending Customer" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];

  // Initialize form with ticket data
  useEffect(() => {
    if (ticket) {
      setFormData({
        title: ticket.title || "",
        description: ticket.description || "",
        status: ticket.status || "",
        priority: ticket.priority || "",
        category: ticket.category || "",
        subcategory: ticket.subcategory || "",
        assignedTo:
          typeof ticket.assignedTo === "object"
            ? ticket.assignedTo._id
            : ticket.assignedTo || "",
        primaryTeam:
          typeof ticket.primaryTeam === "object"
            ? ticket.primaryTeam.teamId?._id
            : ticket.primaryTeam || "",
      });
    }
  }, [ticket]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (!formData.status) newErrors.status = "Status is required";
    if (!formData.priority) newErrors.priority = "Priority is required";
    if (!formData.category) newErrors.category = "Category is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await updateTicket({
        id: ticket.id,
        data: formData,
      }).unwrap();

      toast.success("Ticket updated successfully");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Failed to update ticket:", err);
      toast.error("Failed to update ticket. Please try again.");
    }
  };

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  // Update subcategories when category changes
  useEffect(() => {
    if (formData.category) {
      // Only reset subcategory if the category changed
      if (ticket.category !== formData.category) {
        setFormData({
          ...formData,
          subcategory: "",
        });
      }
    }
  }, [formData.category, ticket.category]);

  // Get subcategories for selected category
  const getSubcategories = () => {
    const category = categories.find((c) => c.name === formData.category);
    return category ? category.subcategories : [];
  };

  // Filter technical teams
  const technicalTeams =
    teamsData?.filter((team) => team.teamType === "technical") || [];

  // Filter technical team members
  const technicalMembers =
    usersData?.filter((user) =>
      user.teams?.some(
        (team) =>
          team.role === "member" &&
          technicalTeams.some((t) => t._id === team.teamId)
      )
    ) || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Ticket Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={`w-full bg-gray-700/50 border ${
              errors.title ? "border-red-500" : "border-gray-600/50"
            } rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.title}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={5}
            className={`w-full bg-gray-700/50 border ${
              errors.description ? "border-red-500" : "border-gray-600/50"
            } rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.description}
            </p>
          )}
        </div>

        {/* Status */}
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Status <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={`w-full bg-gray-700/50 border ${
                errors.status ? "border-red-500" : "border-gray-600/50"
              } rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none`}
            >
              <option value="">Select Status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FaTags className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          {errors.status && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.status}
            </p>
          )}
        </div>

        {/* Category and Subcategory */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={`w-full bg-gray-700/50 border ${
                  errors.category ? "border-red-500" : "border-gray-600/50"
                } rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none`}
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <FaTags className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            {errors.category && (
              <p className="mt-1 text-sm text-red-500 flex items-center">
                <FaExclamationCircle className="mr-1" /> {errors.category}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="subcategory"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Subcategory
            </label>
            <div className="relative">
              <select
                id="subcategory"
                name="subcategory"
                value={formData.subcategory}
                onChange={handleChange}
                disabled={!formData.category}
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none disabled:opacity-50"
              >
                <option value="">Select Subcategory</option>
                {getSubcategories().map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
              <FaTags className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Priority */}
        <div>
          <label
            htmlFor="priority"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Priority <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 gap-3">
            <label
              className={`flex items-center justify-center p-3 rounded-lg border ${
                formData.priority === "low"
                  ? "bg-green-500/20 border-green-500"
                  : "bg-gray-700/30 border-gray-600/50"
              } cursor-pointer transition-colors`}
            >
              <input
                type="radio"
                name="priority"
                value="low"
                checked={formData.priority === "low"}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="text-sm font-medium">Low</span>
            </label>

            <label
              className={`flex items-center justify-center p-3 rounded-lg border ${
                formData.priority === "medium"
                  ? "bg-yellow-500/20 border-yellow-500"
                  : "bg-gray-700/30 border-gray-600/50"
              } cursor-pointer transition-colors`}
            >
              <input
                type="radio"
                name="priority"
                value="medium"
                checked={formData.priority === "medium"}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="text-sm font-medium">Medium</span>
            </label>

            <label
              className={`flex items-center justify-center p-3 rounded-lg border ${
                formData.priority === "high"
                  ? "bg-orange-500/20 border-orange-500"
                  : "bg-gray-700/30 border-gray-600/50"
              } cursor-pointer transition-colors`}
            >
              <input
                type="radio"
                name="priority"
                value="high"
                checked={formData.priority === "high"}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="text-sm font-medium">High</span>
            </label>

            <label
              className={`flex items-center justify-center p-3 rounded-lg border ${
                formData.priority === "critical"
                  ? "bg-red-500/20 border-red-500"
                  : "bg-gray-700/30 border-gray-600/50"
              } cursor-pointer transition-colors`}
            >
              <input
                type="radio"
                name="priority"
                value="critical"
                checked={formData.priority === "critical"}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="text-sm font-medium">Critical</span>
            </label>
          </div>
          {errors.priority && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.priority}
            </p>
          )}
        </div>

        {/* Assignment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="primaryTeam"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Assign to Team
            </label>
            <div className="relative">
              <select
                id="primaryTeam"
                name="primaryTeam"
                value={formData.primaryTeam}
                onChange={handleChange}
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
              >
                <option value="">Select Team</option>
                {technicalTeams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <FaUsers className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div>
            <label
              htmlFor="assignedTo"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Assign to Individual
            </label>
            <div className="relative">
              <select
                id="assignedTo"
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
              >
                <option value="">Select Assignee</option>
                {technicalMembers.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.profile?.firstName} {user.profile?.lastName} (
                    {user.email})
                  </option>
                ))}
              </select>
              <FaUser className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <FaSave className="mr-2" /> Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default EditTicketForm;
