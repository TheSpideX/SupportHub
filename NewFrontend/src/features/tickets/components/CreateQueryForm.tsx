import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaQuestion,
  FaExclamationCircle,
  FaUser,
  FaTags,
  FaPaperPlane,
} from "react-icons/fa";
import { useCreateQueryMutation } from "../api/queryApi";
import { createQueryDirectFetch } from "../utils/directQueryApi";
import { toast } from "react-hot-toast";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface CreateQueryFormProps {
  onSuccess?: () => void;
}

const CreateQueryForm: React.FC<CreateQueryFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCustomer = user?.role === "customer";

  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    category: "general",
    customer: {
      userId: "",
      email: user?.email || "",
      name: user?.name || "",
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createQuery, { isLoading, isSuccess, error }] =
    useCreateQueryMutation();

  // Categories
  const categories = [
    { value: "general", label: "General" },
    { value: "technical", label: "Technical" },
    { value: "billing", label: "Billing" },
    { value: "feature_request", label: "Feature Request" },
    { value: "other", label: "Other" },
  ];

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const newErrors: Record<string, string> = {};
    if (!formData.subject.trim()) newErrors.subject = "Subject is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (!formData.category) newErrors.category = "Category is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      // Log the data being sent
      console.log("Sending query data:", formData);

      // Create the query using direct fetch
      const result = await createQueryDirectFetch(formData);
      console.log("Query created successfully:", result);

      toast.success("Query created successfully");
      if (onSuccess) {
        onSuccess();
      } else {
        // Navigate to the queries page and set a flag to refresh
        navigate("/queries", { state: { refresh: true } });
      }
    } catch (err: any) {
      console.error("Failed to create query:", err);

      // Show more detailed error message if available
      if (err.data && err.data.errors) {
        const errorFields = Object.keys(err.data.errors).join(", ");
        toast.error(
          `Validation failed for: ${errorFields}. Please check your input.`
        );
      } else {
        toast.error("Failed to create query. Please try again.");
      }
    }
  };

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    if (name.startsWith("customer.")) {
      const customerField = name.split(".")[1];
      setFormData({
        ...formData,
        customer: {
          ...formData.customer,
          [customerField]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }

    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Subject */}
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Query Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            className={`w-full bg-gray-700/50 border ${
              errors.subject ? "border-red-500" : "border-gray-600/50"
            } rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
            placeholder="Brief summary of your question or issue"
          />
          {errors.subject && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.subject}
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
            placeholder="Detailed description of your question or issue"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.description}
            </p>
          )}
        </div>

        {/* Category */}
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
                <option key={category.value} value={category.value}>
                  {category.label}
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

        {/* Customer Information - Only show for non-customers */}
        {!isCustomer && (
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
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={() => navigate("/queries")}
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
              {isCustomer ? (
                <>
                  <FaPaperPlane className="mr-2" /> Submit Query
                </>
              ) : (
                <>
                  <FaQuestion className="mr-2" /> Create Query
                </>
              )}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default CreateQueryForm;
