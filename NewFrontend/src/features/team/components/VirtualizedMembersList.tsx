import React, { useRef, useState } from "react";
import { FixedSizeList as List } from "react-window";
import { FaUserMinus, FaCrown, FaEllipsisH } from "react-icons/fa";
import { Button } from "@/components/ui/buttons/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface VirtualizedMembersListProps {
  members: TeamMember[];
  teamLeadId: string;
  onRemoveMember: (memberId: string) => void;
  onMakeTeamLead: (memberId: string) => void; // This will be handlePromoteToLead
  actionInProgress: string;
  height?: number;
  width?: number | string;
  maxHeight?: number;
}

const VirtualizedMembersList: React.FC<VirtualizedMembersListProps> = ({
  members,
  teamLeadId,
  onRemoveMember,
  onMakeTeamLead,
  actionInProgress,
  height = 400,
  width = "100%",
  maxHeight = 500,
}) => {
  // Calculate the actual height to use (min of height and maxHeight)
  const actualHeight = Math.min(height, maxHeight, members.length * 64 + 40); // 64px per row + header
  const listRef = useRef<List>(null);

  // Row renderer function
  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const member = members[index];

    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid rgba(75, 85, 99, 0.3)",
        }}
        className="text-sm"
      >
        {/* Name column */}
        <div
          style={{
            flex: "2",
            padding: "0.75rem 1rem",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-blue-300 mr-3">
            {member.name.charAt(0) +
              (member.name.split(" ")[1]?.charAt(0) || "")}
          </div>
          <div>
            <div className="font-medium text-white flex items-center">
              {member.name}
              {member.id === teamLeadId && (
                <FaCrown
                  className="ml-2 h-3 w-3 text-yellow-500"
                  title="Team Lead"
                />
              )}
            </div>
          </div>
        </div>

        {/* Email column */}
        <div
          style={{ flex: "2", padding: "0.75rem 1rem" }}
          className="text-gray-300"
        >
          {member.email}
        </div>

        {/* Role column */}
        <div
          style={{ flex: "1", padding: "0.75rem 1rem" }}
          className="text-gray-300"
        >
          {member.role}
        </div>

        {/* Actions column */}
        <div style={{ flex: "1", padding: "0.75rem 1rem", textAlign: "right" }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-gray-400 hover:text-white"
              >
                <FaEllipsisH className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-gray-800 border-gray-700 text-gray-200"
            >
              {member.id !== teamLeadId && (
                <DropdownMenuItem
                  onClick={() => onMakeTeamLead(member.id)}
                  disabled={actionInProgress === member.id}
                  className="hover:bg-gray-700 focus:bg-gray-700"
                >
                  <FaCrown className="h-4 w-4 mr-2 text-yellow-500" />
                  Make Team Lead
                </DropdownMenuItem>
              )}
              {member.id !== teamLeadId && (
                <DropdownMenuItem
                  onClick={() => onRemoveMember(member.id)}
                  disabled={actionInProgress === member.id}
                  className="text-red-400 hover:bg-gray-700 focus:bg-gray-700"
                >
                  <FaUserMinus className="h-4 w-4 mr-2" />
                  Remove from Team
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  // Header component
  const Header = () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid rgba(75, 85, 99, 0.5)",
        fontWeight: 600,
        textTransform: "uppercase",
        fontSize: "0.75rem",
        color: "rgb(156, 163, 175)",
      }}
    >
      <div style={{ flex: "2", padding: "0.75rem 1rem" }}>Name</div>
      <div style={{ flex: "2", padding: "0.75rem 1rem" }}>Email</div>
      <div style={{ flex: "1", padding: "0.75rem 1rem" }}>Role</div>
      <div style={{ flex: "1", padding: "0.75rem 1rem", textAlign: "right" }}>
        Actions
      </div>
    </div>
  );

  // If no members, show empty state
  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No team members found
      </div>
    );
  }

  return (
    <div>
      <Header />
      <List
        ref={listRef}
        height={actualHeight}
        width={width}
        itemCount={members.length}
        itemSize={64} // Adjust based on your row height
      >
        {Row}
      </List>
    </div>
  );
};

export default VirtualizedMembersList;
