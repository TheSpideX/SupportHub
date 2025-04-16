import React, { useState, useEffect } from "react";
import {
  FaExclamationCircle,
  FaUser,
  FaUsers,
  FaArrowRight,
  FaTicketAlt,
} from "react-icons/fa";
import { useConvertToTicketMutation, Query } from "../api/queryApi";
import { useGetTeamsQuery } from "@/api/teamApiRTK";
import { useGetUsersQuery } from "@/api/userApiRTK";
import { toast } from "react-hot-toast";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface ConvertToTicketFormProps {
  query: Query;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ConvertToTicketForm: React.FC<ConvertToTicketFormProps> = ({
  query,
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const isSupport = user?.role === "support";

  const [formData, setFormData] = useState({
    assignToTeam: "",
    assignToUser: "",
    additionalNotes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [convertToTicket, { isLoading }] = useConvertToTicketMutation();

  // Fetch only teams, not users
  const { data: teams, isLoading: isLoadingTeams } = useGetTeamsQuery();

  // Debug teams data
  useEffect(() => {
    if (teams) {
      console.log("Teams data:", teams);
    }
  }, [teams]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const newErrors: Record<string, string> = {};
    if (!formData.assignToTeam) newErrors.assignToTeam = "Please select a team";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await convertToTicket({
        id: query._id,
        data: formData,
      }).unwrap();

      toast.success("Query successfully converted to ticket");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Failed to convert query to ticket:", err);
      toast.error("Failed to convert query to ticket. Please try again.");
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

  // Filter users based on selected team
  // Since we're not fetching users for support members, this will always return an empty array
  const filteredUsers = () => {
    // Return empty array since we don't need to show team members for support users
    return [];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
          <h3 className="text-blue-400 font-medium flex items-center mb-2">
            <FaTicketAlt className="mr-2" /> Converting Query to Ticket
          </h3>
          <p className="text-gray-300 text-sm">
            This will create a new ticket based on this query. The query will be
            marked as converted and linked to the new ticket.
          </p>
        </div>

        {/* Query Information (Read-only) */}
        <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/30">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Query Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title</label>
              <div className="text-white font-medium">{query.title}</div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Priority
              </label>
              <div className="text-white">
                {query.priority
                  ? query.priority.charAt(0).toUpperCase() +
                    query.priority.slice(1)
                  : "Not specified"}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">
              Description
            </label>
            <div className="text-white text-sm bg-gray-700/30 p-3 rounded-lg">
              {query.description}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Customer</label>
            <div className="text-white">
              {query.customer?.userId?.profile?.firstName}{" "}
              {query.customer?.userId?.profile?.lastName} (
              {query.customer?.userId?.email})
            </div>
          </div>
        </div>

        {/* Team Assignment */}
        <div>
          <label
            htmlFor="assignToTeam"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Assign to Team <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="assignToTeam"
              name="assignToTeam"
              value={formData.assignToTeam}
              onChange={handleChange}
              className={`w-full bg-gray-700/50 border ${
                errors.assignToTeam ? "border-red-500" : "border-gray-600/50"
              } rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none`}
            >
              <option value="">Select Team</option>
              {teams && teams.data && Array.isArray(teams.data)
                ? teams.data
                    .filter((team) => team.teamType === "technical")
                    .map((team) => (
                      <option key={team._id} value={team._id}>
                        {team.name} (Technical)
                      </option>
                    ))
                : null}
            </select>
            <FaUsers className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          {errors.assignToTeam && (
            <p className="mt-1 text-sm text-red-500 flex items-center">
              <FaExclamationCircle className="mr-1" /> {errors.assignToTeam}
            </p>
          )}
        </div>

        {/* User Assignment - Only visible for non-support users */}
        {!isSupport && (
          <div>
            <label
              htmlFor="assignToUser"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Assign to Team Member{" "}
              <span className="text-gray-500">(Optional)</span>
            </label>
            <div className="relative">
              <select
                id="assignToUser"
                name="assignToUser"
                value={formData.assignToUser}
                onChange={handleChange}
                disabled={
                  !formData.assignToTeam || filteredUsers().length === 0
                }
                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none disabled:opacity-50"
              >
                <option value="">Select Team Member</option>
                {filteredUsers().map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.profile?.firstName} {user.profile?.lastName}
                  </option>
                ))}
              </select>
              <FaUser className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            {formData.assignToTeam && filteredUsers().length === 0 && (
              <p className="mt-1 text-sm text-amber-500 flex items-center">
                <FaExclamationCircle className="mr-1" /> No team members
                available for the selected team
              </p>
            )}
          </div>
        )}

        {/* Additional Notes */}
        <div>
          <label
            htmlFor="additionalNotes"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Additional Notes <span className="text-gray-500">(Optional)</span>
          </label>
          <textarea
            id="additionalNotes"
            name="additionalNotes"
            value={formData.additionalNotes}
            onChange={handleChange}
            rows={3}
            className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="Add any additional information for the technical team..."
          />
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
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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
              Converting...
            </>
          ) : (
            <>
              <FaArrowRight className="mr-2" /> Convert to Ticket
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default ConvertToTicketForm;
