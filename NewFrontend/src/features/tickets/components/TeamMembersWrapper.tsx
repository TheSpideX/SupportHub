import React from "react";
import { useGetTeamMembersQuery } from "@/api/teamApiRTK";
import { FaUser } from "react-icons/fa";

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

interface TeamMembersWrapperProps {
  teamId: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
}

const TeamMembersWrapper: React.FC<TeamMembersWrapperProps> = ({
  teamId,
  value,
  onChange,
  disabled = false,
}) => {
  const {
    data: teamMembersData,
    isFetching: isLoadingTeamMembers,
    error,
  } = useGetTeamMembersQuery(teamId, {
    skip: !teamId,
  });

  // Log the raw team members data for debugging
  React.useEffect(() => {
    if (teamId && teamMembersData) {
      console.log(`Team members data for team ${teamId}:`, teamMembersData);
    }
  }, [teamId, teamMembersData]);

  // Process team members data
  const processedTeamMembers = React.useMemo(() => {
    if (!teamMembersData) return [];

    // Handle both array and paginated response formats
    const membersArray = Array.isArray(teamMembersData)
      ? teamMembersData
      : (teamMembersData as unknown as PaginatedResponse<any>).data || [];

    return Array.isArray(membersArray) ? membersArray : [];
  }, [teamMembersData]);

  // Log any errors
  React.useEffect(() => {
    if (error) {
      console.error("Error fetching team members:", error);
    }
  }, [error]);

  return (
    <div className="relative">
      <select
        id="assignedTo"
        name="assignedTo"
        value={value}
        onChange={onChange}
        disabled={disabled || !teamId}
        className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none disabled:opacity-50"
        size={5} // Show 5 options at a time
        style={{ maxHeight: "200px", overflowY: "auto" }} // Add scrolling
      >
        <option value="">Select Assignee</option>
        {isLoadingTeamMembers ? (
          <option value="">Loading team members...</option>
        ) : teamId && processedTeamMembers.length > 0 ? (
          processedTeamMembers.map((user: any) => (
            <option key={user._id} value={user._id}>
              {user.profile?.firstName || ""} {user.profile?.lastName || ""} (
              {user.email || "No email"})
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
      {!teamId && (
        <p className="mt-1 text-xs text-gray-400">
          Select a team first to see available members
        </p>
      )}
    </div>
  );
};

export default TeamMembersWrapper;
