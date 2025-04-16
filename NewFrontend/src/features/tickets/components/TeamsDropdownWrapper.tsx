import React from "react";
import { useGetTeamsQuery } from "@/api/teamApiRTK";
import { FaUsers } from "react-icons/fa";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface TeamsDropdownWrapperProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const TeamsDropdownWrapper: React.FC<TeamsDropdownWrapperProps> = ({
  value,
  onChange,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: teamsData, isLoading, error } = useGetTeamsQuery();

  // Log the raw teams data for debugging
  React.useEffect(() => {
    console.log("Raw teams data:", teamsData);
  }, [teamsData]);

  // Process teams data
  const availableTeams = React.useMemo(() => {
    // Check if teamsData has the expected structure
    if (!teamsData) {
      console.log("Teams data is not available");
      return [];
    }

    // Handle both array and paginated response formats
    const teamsArray = Array.isArray(teamsData)
      ? teamsData
      : (teamsData as unknown as PaginatedResponse<any>).data || [];

    // Make sure we have an array
    if (!Array.isArray(teamsArray)) {
      console.log("Teams data is not in the expected format:", teamsArray);
      return [];
    }

    // Filter teams based on user role
    return isAdmin
      ? teamsArray
      : teamsArray.filter((team: any) => team.teamType === "technical");
  }, [teamsData, isAdmin]);

  // Log any errors
  React.useEffect(() => {
    if (error) {
      console.error("Error fetching teams:", error);
    }
  }, [error]);

  return (
    <div className="relative">
      <div className="mb-1 text-xs text-gray-400">
        {isLoading
          ? "Loading teams..."
          : Array.isArray(availableTeams) && availableTeams.length > 0
          ? `${availableTeams.length} teams available`
          : "No teams available"}
      </div>
      <select
        id="primaryTeam"
        name="primaryTeam"
        value={value}
        onChange={onChange}
        className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
        size={5} // Show 5 options at a time
        style={{ maxHeight: "200px", overflowY: "auto" }} // Add scrolling
      >
        <option value="">Select Team</option>
        {isLoading ? (
          <option value="">Loading teams...</option>
        ) : Array.isArray(availableTeams) && availableTeams.length > 0 ? (
          availableTeams.map((team) => (
            <option key={team._id} value={team._id}>
              {team.name} {team.teamType ? `(${team.teamType})` : ""}
            </option>
          ))
        ) : (
          <option value="">No teams available</option>
        )}
      </select>
      <FaUsers className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
    </div>
  );
};

export default TeamsDropdownWrapper;
