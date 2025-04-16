import React, { useState, useEffect, useRef } from "react";
import { useGetTeamMembersQuery } from "@/api/teamApiRTK";
import { FaUser, FaChevronDown, FaChevronUp } from "react-icons/fa";

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

interface User {
  _id: string;
  email: string;
  role?: string;
  teamRole?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
  };
}

interface CustomTeamMembersDropdownProps {
  teamId: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
}

const CustomTeamMembersDropdown: React.FC<CustomTeamMembersDropdownProps> = ({
  teamId,
  value,
  onChange,
  disabled = false
}) => {
  const { 
    data: teamMembersData, 
    isFetching: isLoadingTeamMembers,
    error
  } = useGetTeamMembersQuery(teamId, {
    skip: !teamId,
  });

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

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

  // Process team members data
  const processedTeamMembers = React.useMemo(() => {
    if (!teamMembersData) return [];
    
    // Handle both array and paginated response formats
    const membersArray = Array.isArray(teamMembersData) 
      ? teamMembersData 
      : (teamMembersData as unknown as PaginatedResponse<User>).data || [];
    
    return Array.isArray(membersArray) ? membersArray : [];
  }, [teamMembersData]);

  // Update selected member when value changes
  useEffect(() => {
    if (value && Array.isArray(processedTeamMembers)) {
      const member = processedTeamMembers.find(member => member._id === value);
      if (member) {
        setSelectedMember(member);
      } else {
        setSelectedMember(null);
      }
    } else {
      setSelectedMember(null);
    }
  }, [value, processedTeamMembers]);

  // Log any errors
  useEffect(() => {
    if (error) {
      console.error("Error fetching team members:", error);
    }
  }, [error]);

  const handleMemberSelect = (member: User) => {
    const event = {
      target: {
        name: "assignedTo",
        value: member._id
      }
    } as React.ChangeEvent<HTMLSelectElement>;
    
    onChange(event);
    setIsOpen(false);
  };

  const clearSelection = () => {
    const event = {
      target: {
        name: "assignedTo",
        value: ""
      }
    } as React.ChangeEvent<HTMLSelectElement>;
    onChange(event);
  };

  // Format user name
  const formatUserName = (user: User) => {
    const firstName = user.profile?.firstName || "";
    const lastName = user.profile?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const email = user.email || "No email";
    const role = user.role === "admin"
      ? " - Admin"
      : user.role === "lead" || user.teamRole === "lead"
      ? " - Team Lead"
      : "";
    
    return `${fullName || email}${role}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="mb-1 text-xs text-gray-400 flex justify-between">
        <span>
          {!teamId
            ? "Select a team first"
            : isLoadingTeamMembers
            ? "Loading members..."
            : processedTeamMembers.length > 0
            ? `${processedTeamMembers.length} members available`
            : "No members available"}
        </span>
        {selectedMember && (
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
        className={`w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white cursor-pointer flex justify-between items-center ${isOpen ? "ring-2 ring-blue-500/50" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <FaUser className="mr-2 text-gray-400" />
          <span className={selectedMember ? "text-white" : "text-gray-400"}>
            {selectedMember ? formatUserName(selectedMember) : "Select Assignee"}
          </span>
        </div>
        {!disabled && (
          isOpen ? 
            <FaChevronUp className="text-gray-400" /> : 
            <FaChevronDown className="text-gray-400" />
        )}
      </div>
      
      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoadingTeamMembers ? (
            <div className="p-2 text-gray-400">Loading team members...</div>
          ) : processedTeamMembers.length > 0 ? (
            <>
              <div 
                className="p-2 hover:bg-gray-700 cursor-pointer text-gray-300 border-b border-gray-700"
                onClick={clearSelection}
              >
                No assignee
              </div>
              {processedTeamMembers.map((member) => (
                <div 
                  key={member._id} 
                  className={`p-2 hover:bg-gray-700 cursor-pointer ${member._id === value ? "bg-blue-900/30 text-blue-300" : "text-white"}`}
                  onClick={() => handleMemberSelect(member)}
                >
                  {formatUserName(member)}
                </div>
              ))}
            </>
          ) : (
            <div className="p-2 text-gray-400">No team members found</div>
          )}
        </div>
      )}
      
      {!teamId && (
        <p className="mt-1 text-xs text-gray-400">
          Select a team first to see available members
        </p>
      )}
    </div>
  );
};

export default CustomTeamMembersDropdown;
