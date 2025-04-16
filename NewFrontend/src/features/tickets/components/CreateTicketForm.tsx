import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaTicketAlt,
  FaExclamationCircle,
  FaUser,
  FaUsers,
  FaTags,
  FaArrowLeft,
  FaPlusCircle,
  FaClock,
} from "react-icons/fa";
import { useCreateTicketMutation } from "../api/ticketApi";
import { useGetTeamsQuery, useGetTeamMembersQuery } from "@/api/teamApiRTK";
import { useGetUsersQuery } from "@/api/userApiRTK";
import { useGetSLAPoliciesQuery } from "@/services/slaApi";
import { toast } from "react-hot-toast";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface CreateTicketFormProps {
  onSuccess?: () => void;
}

const CreateTicketForm: React.FC<CreateTicketFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    subcategory: "",
    customCategory: "",
    customSubcategory: "",
    useCustomCategory: false,
    priority: "medium",
    primaryTeam: "",
    assignedTo: "",
    slaPolicy: "",
    customer: {
      userId: "",
      email: "",
      name: "",
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createTicket, { isLoading, isSuccess, error }] =
    useCreateTicketMutation();
  const { data: teamsData } = useGetTeamsQuery();
  const { data: usersData } = useGetUsersQuery();
  const { data: slaPoliciesData } = useGetSLAPoliciesQuery();

  // Fetch team members when a team is selected
  const { data: teamMembersData, isFetching: isLoadingTeamMembers } =
    useGetTeamMembersQuery(formData.primaryTeam, {
      skip: !formData.primaryTeam,
    });

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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";

    // Validate category (either predefined or custom)
    if (formData.useCustomCategory) {
      if (!formData.customCategory.trim()) {
        newErrors.customCategory = "Custom category is required";
      }
    } else if (!formData.category) {
      newErrors.category = "Category is required";
    }

    if (!formData.priority) newErrors.priority = "Priority is required";

    if (Object.keys(newErrors).length > 0) {
      console.error("Form validation failed:", newErrors);
      setErrors(newErrors);
      return;
    }

    // Double-check required fields before submission
    const title = formData.title.trim();
    const description = formData.description.trim();
    const category = formData.useCustomCategory
      ? formData.customCategory.trim()
      : formData.category;

    if (!title || !description || !category) {
      console.error("Required fields missing before submission:", {
        title: !!title,
        description: !!description,
        category: !!category,
      });
      toast.error("Please fill in all required fields");
      return;
    }

    // Prepare data for submission with all required fields
    const ticketData: any = {
      title: title, // Using the validated variables from above
      description: description,
      category: category,
      priority: formData.priority || "medium", // Default to medium if not set
      source: "direct_creation",
    };

    // Log the data being prepared
    console.log("Preparing ticket data:", {
      title: ticketData.title,
      description: ticketData.description,
      category: ticketData.category,
      priority: ticketData.priority,
      titleLength: ticketData.title?.length,
      descriptionLength: ticketData.description?.length,
      categoryLength: ticketData.category?.length,
    });

    // Final validation check
    if (!ticketData.title || !ticketData.description || !ticketData.category) {
      console.error(
        "Final validation failed - missing required fields:",
        ticketData
      );
      toast.error("Cannot create ticket: missing required fields");
      return;
    }

    // Only add subcategory if it's not empty
    const subcategory = formData.useCustomCategory
      ? formData.customSubcategory.trim()
      : formData.subcategory;

    if (subcategory) {
      ticketData.subcategory = subcategory;
    }

    // Add team and assignee if selected
    if (formData.primaryTeam) {
      ticketData.primaryTeam = formData.primaryTeam;
    }

    if (formData.assignedTo) {
      ticketData.assignedTo = formData.assignedTo;
    }

    // Add SLA policy if selected
    if (formData.slaPolicy) {
      ticketData.slaPolicy = formData.slaPolicy;
    }

    // Add customer information if provided
    if (formData.customer.email || formData.customer.name) {
      ticketData.customer = {};

      if (formData.customer.email) {
        ticketData.customer.email = formData.customer.email.trim();
      }

      if (formData.customer.name) {
        ticketData.customer.name = formData.customer.name.trim();
      }
    }

    // Log the data being sent
    console.log(
      "Sending ticket data to backend:",
      JSON.stringify(ticketData, null, 2)
    );

    try {
      // Use the RTK Query mutation to create the ticket
      console.log(
        "Submitting ticket data to API:",
        JSON.stringify(ticketData, null, 2)
      );

      // Create a clean ticket object with only the required fields
      const cleanTicketData = {
        title: ticketData.title,
        description: ticketData.description,
        category: ticketData.category,
        priority: ticketData.priority,
        source: "direct_creation",
      };

      // Add optional fields if they exist
      if (ticketData.subcategory)
        cleanTicketData.subcategory = ticketData.subcategory;
      if (ticketData.primaryTeam)
        cleanTicketData.primaryTeam = ticketData.primaryTeam;
      if (ticketData.assignedTo)
        cleanTicketData.assignedTo = ticketData.assignedTo;

      console.log(
        "Clean ticket data prepared:",
        JSON.stringify(cleanTicketData, null, 2)
      );

      const result = await createTicket(cleanTicketData).unwrap();

      console.log("Ticket created successfully:", result);
      toast.success("Ticket created successfully");

      if (onSuccess) {
        onSuccess();
      } else {
        // Navigate to the specific ticket page
        navigate(`/tickets/${result.data._id}`);
      }
    } catch (err: any) {
      console.error("Failed to create ticket:", err);

      // Extract validation errors if available
      let errorMessage = "Failed to create ticket. Please try again.";
      if (err.data?.errors) {
        const validationErrors = err.data.errors;
        const errorFields = Object.keys(validationErrors).join(", ");
        errorMessage = `Validation failed for fields: ${errorFields}. Please check your input.`;

        // Update form errors
        const newErrors: Record<string, string> = {};
        Object.entries(validationErrors).forEach(
          ([field, error]: [string, any]) => {
            newErrors[field] = error.message || "Invalid value";
          }
        );
        setErrors(newErrors);
      }

      toast.error(errorMessage);
    }
  };

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith("customer.")) {
      const customerField = name.split(".")[1];
      setFormData({
        ...formData,
        customer: {
          ...formData.customer,
          [customerField]: value,
        },
      });
    } else if (type === "checkbox") {
      // Handle checkbox inputs
      setFormData({
        ...formData,
        [name]: checked,
      });

      // Reset category/subcategory when switching between custom and predefined
      if (name === "useCustomCategory") {
        if (checked) {
          // Switching to custom category
          setFormData((prev) => ({
            ...prev,
            [name]: checked,
            category: "",
            subcategory: "",
          }));
        } else {
          // Switching to predefined category
          setFormData((prev) => ({
            ...prev,
            [name]: checked,
            customCategory: "",
            customSubcategory: "",
          }));
        }
      }
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });

      // Special handling for team selection
      if (name === "primaryTeam") {
        // Reset assignedTo when team changes
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          assignedTo: "",
        }));
      }
    }

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
      setFormData({
        ...formData,
        subcategory: "",
      });
    }
  }, [formData.category]);

  // Debug when primary team changes
  useEffect(() => {
    if (formData.primaryTeam) {
      console.log("Primary team selected:", formData.primaryTeam);
    }
  }, [formData.primaryTeam]);

  // Get subcategories for selected category
  const getSubcategories = () => {
    const category = categories.find((c) => c.name === formData.category);
    return category ? category.subcategories : [];
  };

  // Get all teams or filter by type based on user role
  const availableTeams = isAdmin
    ? teamsData?.data || []
    : teamsData?.data?.filter((team) => team.teamType === "technical") || [];

  // Log team members data for debugging
  useEffect(() => {
    if (formData.primaryTeam && teamMembersData) {
      console.log("Team members data from API:", teamMembersData);
    }
  }, [formData.primaryTeam, teamMembersData]);

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
            placeholder="Brief summary of the issue"
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
            placeholder="Detailed description of the issue"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.description}
            </p>
          )}
        </div>

        {/* Category and Subcategory */}
        <div className="space-y-4">
          {/* Custom Category Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="useCustomCategory"
              name="useCustomCategory"
              checked={formData.useCustomCategory}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
            />
            <label
              htmlFor="useCustomCategory"
              className="ml-2 text-sm font-medium text-gray-300 flex items-center"
            >
              <FaPlusCircle className="mr-1" /> Use custom category
            </label>
          </div>

          {formData.useCustomCategory ? (
            // Custom Category Input
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="customCategory"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Custom Category <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="customCategory"
                  name="customCategory"
                  value={formData.customCategory}
                  onChange={handleChange}
                  className={`w-full bg-gray-700/50 border ${
                    errors.customCategory
                      ? "border-red-500"
                      : "border-gray-600/50"
                  } rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                  placeholder="Enter custom category"
                />
                {errors.customCategory && (
                  <p className="mt-1 text-sm text-red-500 flex items-center">
                    <FaExclamationCircle className="mr-1" />{" "}
                    {errors.customCategory}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="customSubcategory"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Custom Subcategory
                </label>
                <input
                  type="text"
                  id="customSubcategory"
                  name="customSubcategory"
                  value={formData.customSubcategory}
                  onChange={handleChange}
                  className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Enter custom subcategory (optional)"
                />
              </div>
            </div>
          ) : (
            // Standard Category Dropdown
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
          )}
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
                {availableTeams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name} {team.teamType ? `(${team.teamType})` : ""}
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
              Assign to Individual{" "}
              <span className="text-xs text-gray-400">(Optional)</span>
            </label>
            <div className="relative">
              <select
                id="assignedTo"
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
                disabled={!formData.primaryTeam}
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none disabled:opacity-50"
              >
                <option value="">Select Assignee</option>
                {isLoadingTeamMembers ? (
                  <option value="">Loading team members...</option>
                ) : formData.primaryTeam &&
                  teamMembersData?.data &&
                  teamMembersData.data.length > 0 ? (
                  teamMembersData.data.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.profile?.firstName || ""}{" "}
                      {user.profile?.lastName || ""} ({user.email || "No email"}
                      )
                      {user.role === "admin"
                        ? " - Admin"
                        : user.role === "lead" || user.teamRole === "lead"
                        ? " - Team Lead"
                        : ""}
                    </option>
                  ))
                ) : (
                  <option value="">No team members found</option>
                )}
              </select>
              <FaUser className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              {!formData.primaryTeam && (
                <p className="mt-1 text-xs text-gray-400">
                  Select a team first to see available members
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SLA Policy Selection */}
        <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/30 mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            <FaClock className="mr-2 text-blue-400" /> SLA Policy
          </h3>
          <div>
            <label
              htmlFor="slaPolicy"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Select SLA Policy
            </label>
            <div className="relative">
              <select
                id="slaPolicy"
                name="slaPolicy"
                value={formData.slaPolicy}
                onChange={handleChange}
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
              >
                <option value="">Auto-select based on priority</option>
                {slaPoliciesData?.data?.map((policy) => (
                  <option key={policy._id} value={policy._id}>
                    {policy.name} - Response:{" "}
                    {policy.responseTime?.[formData.priority] || "N/A"} min,
                    Resolution:{" "}
                    {policy.resolutionTime?.[formData.priority] || "N/A"} min
                  </option>
                ))}
              </select>
              <FaClock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              If no policy is selected, a default policy will be applied based
              on ticket priority (Low, Medium, High, or Critical Priority SLA)
            </p>
          </div>
        </div>

        {/* Customer Information */}
        <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/30">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            <FaUser className="mr-2 text-blue-400" /> Customer Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="customer.email"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Customer Email
              </label>
              <input
                type="email"
                id="customer.email"
                name="customer.email"
                value={formData.customer.email}
                onChange={handleChange}
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="customer@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="customer.name"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Customer Name
              </label>
              <input
                type="text"
                id="customer.name"
                name="customer.name"
                value={formData.customer.name}
                onChange={handleChange}
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="John Doe"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center"
        >
          <FaArrowLeft className="mr-2" /> Back
        </button>

        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => (onSuccess ? onSuccess() : navigate("/tickets"))}
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
                Creating...
              </>
            ) : (
              <>
                <FaTicketAlt className="mr-2" /> Create Ticket
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default CreateTicketForm;
