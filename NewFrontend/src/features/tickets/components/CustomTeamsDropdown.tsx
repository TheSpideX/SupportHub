import React, { useState, useEffect, useRef } from "react";
import { useGetTeamsQuery } from "@/api/teamApiRTK";
import { FaUsers, FaChevronDown, FaChevronUp } from "react-icons/fa";
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

interface Team {
  _id: string;
  name: string;
  teamType?: string;
  description?: string;
}

interface CustomTeamsDropdownProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const CustomTeamsDropdown: React.FC<CustomTeamsDropdownProps> = ({
  value,
  onChange,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: teamsData, isLoading, error } = useGetTeamsQuery();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
      : (teamsData as unknown as PaginatedResponse<Team>).data || [];

    // Make sure we have an array
    if (!Array.isArray(teamsArray)) {
      console.log("Teams data is not in the expected format:", teamsArray);
      return [];
    }

    // Filter teams based on user role
    return isAdmin
      ? teamsArray
      : teamsArray.filter((team: Team) => team.teamType === "technical");
  }, [teamsData, isAdmin]);

  // Update selected team when value changes
  useEffect(() => {
    if (value && Array.isArray(availableTeams)) {
      const team = availableTeams.find(team => team._id === value);
      if (team) {
        setSelectedTeam(team);
      } else {
        setSelectedTeam(null);
      }
    } else {
      setSelectedTeam(null);
    }
  }, [value, availableTeams]);

  // Log any errors
  useEffect(() => {
    if (error) {
      console.error("Error fetching teams:", error);
    }
  }, [error]);

  const handleTeamSelect = (team: Team) => {
    const event = {
      target: {
        name: "primaryTeam",
        value: team._id
      }
    } as React.ChangeEvent<HTMLSelectElement>;
    
    onChange(event);
    setIsOpen(false);
  };

  const clearSelection = () => {
    const event = {
      target: {
        name: "primaryTeam",
        value: ""
      }
    } as React.ChangeEvent<HTMLSelectElement>;
    onChange(event);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="mb-1 text-xs text-gray-400 flex justify-between">
        <span>
          {isLoading
            ? "Loading teams..."
            : Array.isArray(availableTeams) && availableTeams.length > 0
            ? `${availableTeams.length} teams available`
            : "No teams available"}
        </span>
        {selectedTeam && (
          <span 
            className="text-blue-400 cursor-pointer hover:text-blue-300" 
            onClick={clearSelection}
          >
            Clear
          </span>
        )}
      </div>
      
      {/* Custom dropdown button */}
      <div 
        className={`w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white cursor-pointer flex justify-between items-center ${isOpen ? "ring-2 ring-blue-500/50" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <FaUsers className="mr-2 text-gray-400" />
          <span className={selectedTeam ? "text-white" : "text-gray-400"}>
            {selectedTeam ? 
              `${selectedTeam.name} ${selectedTeam.teamType ? `(${selectedTeam.teamType})` : ""}` : 
              "Select Team"}
          </span>
        </div>
        {isOpen ? 
          <FaChevronUp className="text-gray-400" /> : 
          <FaChevronDown className="text-gray-400" />}
      </div>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-2 text-gray-400">Loading teams...</div>
          ) : Array.isArray(availableTeams) && availableTeams.length > 0 ? (
            availableTeams.map((team) => (
              <div 
                key={team._id} 
                className={`p-2 hover:bg-gray-700 cursor-pointer ${team._id === value ? "bg-blue-900/30 text-blue-300" : "text-white"}`}
                onClick={() => handleTeamSelect(team)}
              >
                {team.name} {team.teamType ? `(${team.teamType})` : ""}
              </div>
            ))
          ) : (
            <div className="p-2 text-gray-400">No teams available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomTeamsDropdown;
