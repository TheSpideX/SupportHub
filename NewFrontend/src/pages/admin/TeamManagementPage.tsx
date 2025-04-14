import React, { useState, useEffect, useRef } from "react";
import {
  FaUsersCog,
  FaPlus,
  FaSearch,
  FaFilter,
  FaEllipsisH,
  FaEdit,
  FaTrash,
  FaUserPlus,
  FaUsers,
  FaChartBar,
  FaExclamationTriangle,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTeamManagement } from "@/features/team/hooks/useTeamManagement";
// Will be used when API integration is complete
// import { Team as TeamType } from "@/api/teamApi";
import CreateTeamModal from "@/features/team/components/CreateTeamModal";
import EditTeamModal from "@/features/team/components/EditTeamModal";
import DeleteTeamModal from "@/features/team/components/DeleteTeamModal";
import TeamMembersModal from "@/features/team/components/TeamMembersModal";
import AddTeamMemberModal from "@/features/team/components/AddTeamMemberModal";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";
import { Button } from "@/components/ui/buttons/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/Checkbox";
// import AdminLayout from "@/layouts/AdminLayout"; // Not used
// TeamProvider is now applied at the App level

// Using the imported types as aliases for the existing interface structure
// UI Team Member type for display
interface UITeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

// UI Team type for display
interface UITeam {
  id: string;
  name: string;
  description: string;
  members: UITeamMember[];
  leadId: string;
  ticketsAssigned: number;
  ticketsResolved: number;
  createdAt: string;
}

// Convert API Team to UI Team with proper ID handling
const convertApiTeamToUITeam = (apiTeam: any): UITeam => {
  // Extract ID safely, handling both string IDs and MongoDB ObjectIds
  const getId = (obj: any): string => {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    if (obj._id)
      return typeof obj._id === "string" ? obj._id : obj._id.toString();
    if (obj.id) return typeof obj.id === "string" ? obj.id : obj.id.toString();
    return "";
  };

  // Extract user name safely
  const getUserName = (user: any): string => {
    if (!user) return "Unknown";
    if (user.profile) {
      const firstName = user.profile.firstName || "";
      const lastName = user.profile.lastName || "";
      return `${firstName} ${lastName}`.trim() || "Unknown";
    }
    if (user.name) return user.name;
    return "Unknown";
  };

  return {
    id: getId(apiTeam),
    name: apiTeam.name || "Unnamed Team",
    description: apiTeam.description || "No description available",
    members: (apiTeam.members || []).map((member: any) => ({
      id: member.userId
        ? getId({ _id: member.userId })
        : member.user
        ? getId(member.user)
        : getId(member),
      name: member.user ? getUserName(member.user) : member.name || "Unknown",
      email: member.user?.email || member.email || "",
      role: member.role || "member",
    })),
    leadId: apiTeam.leadId ? getId({ _id: apiTeam.leadId }) : "",
    ticketsAssigned:
      apiTeam.metrics?.ticketsAssigned || apiTeam.ticketsAssigned || 0,
    ticketsResolved:
      apiTeam.metrics?.ticketsResolved || apiTeam.ticketsResolved || 0,
    createdAt: apiTeam.createdAt
      ? new Date(apiTeam.createdAt).toLocaleDateString()
      : "Unknown date",
  };
};

const TeamManagementPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  // Get team management functions and state
  const {
    fetchTeams,
    teams: apiTeams,
    isLoading: isTeamsLoading,
    error: teamsError,
  } = useTeamManagement();

  // Track if we've already fetched teams
  const hasLoadedTeams = useRef(false);

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Fetch teams when the page loads, but only once
  useEffect(() => {
    if (!hasLoadedTeams.current) {
      console.log("TeamManagementPage: Fetching teams...");
      fetchTeams();
      hasLoadedTeams.current = true;
    }
  }, [fetchTeams]);

  // Convert API teams to UI format - will be used when API integration is complete
  /* const convertApiTeamToUiTeam = (apiTeam: TeamType): Team => {
    return {
      id: apiTeam._id,
      name: apiTeam.name,
      description: apiTeam.description || "",
      members: apiTeam.members.map((member) => ({
        id: member.userId,
        name:
          member.user?.profile.firstName +
            " " +
            member.user?.profile.lastName || "Unknown User",
        email: member.user?.email || "",
        role: member.role === "lead" ? "Team Lead" : "Member",
      })),
      leadId: apiTeam.leadId,
      ticketsAssigned: apiTeam.metrics.ticketsAssigned,
      ticketsResolved: apiTeam.metrics.ticketsResolved,
      createdAt: new Date(apiTeam.createdAt).toLocaleDateString(),
    };
  }; */

  // Convert API teams to UI format - commented out for now
  // const teams: Team[] = apiTeams.map(convertApiTeamToUiTeam);

  // Sample teams data for fallback - commented out for now
  /* Sample teams data - not used currently
  const sampleTeams: Team[] = [
    {
      id: "1",
      name: "Technical Support",
      description: "Handles technical issues and product-related queries",
      members: [
        {
          id: "101",
          name: "John Doe",
          email: "john.doe@example.com",
          role: "Team Lead",
        },
        {
          id: "102",
          name: "Jane Smith",
          email: "jane.smith@example.com",
          role: "Technical Specialist",
        },
        {
          id: "103",
          name: "Robert Johnson",
          email: "robert.johnson@example.com",
          role: "Support Engineer",
        },
      ],
      leadId: "101",
      ticketsAssigned: 45,
      ticketsResolved: 38,
      createdAt: "2023-01-15",
    },
    {
      id: "2",
      name: "Customer Success",
      description:
        "Focuses on customer satisfaction and relationship management",
      members: [
        {
          id: "201",
          name: "Emily Davis",
          email: "emily.davis@example.com",
          role: "Team Lead",
        },
        {
          id: "202",
          name: "Michael Brown",
          email: "michael.brown@example.com",
          role: "Customer Success Manager",
        },
      ],
      leadId: "201",
      ticketsAssigned: 32,
      ticketsResolved: 30,
      createdAt: "2023-02-20",
    },
    {
      id: "3",
      name: "Product Support",
      description: "Specialized in product features and functionality",
      members: [
        {
          id: "301",
          name: "Sarah Wilson",
          email: "sarah.wilson@example.com",
          role: "Team Lead",
        },
        {
          id: "302",
          name: "David Miller",
          email: "david.miller@example.com",
          role: "Product Specialist",
        },
        {
          id: "303",
          name: "Lisa Taylor",
          email: "lisa.taylor@example.com",
          role: "Support Agent",
        },
        {
          id: "304",
          name: "Kevin Anderson",
          email: "kevin.anderson@example.com",
          role: "Support Agent",
        },
      ],
      leadId: "301",
      ticketsAssigned: 56,
      ticketsResolved: 49,
      createdAt: "2023-03-10",
    },
  ];
  */

  // Create a sample team for UI demonstration when no real data is available
  const sampleTeam: UITeam = {
    id: "sample-id", // Use a clearly fake ID to avoid confusion with real IDs
    name: "Technical Support",
    description: "Handles technical issues and product-related queries",
    members: [
      {
        id: "sample-member-1",
        name: "John Doe",
        email: "john.doe@example.com",
        role: "Team Lead",
      },
      {
        id: "sample-member-2",
        name: "Jane Smith",
        email: "jane.smith@example.com",
        role: "Support Specialist",
      },
    ],
    leadId: "sample-member-1",
    ticketsAssigned: 24,
    ticketsResolved: 18,
    createdAt: "2023-01-15",
  };

  // Use API teams if available, otherwise use sample team only in development
  const teamsToDisplay =
    apiTeams && apiTeams.length > 0
      ? apiTeams.map(convertApiTeamToUITeam)
      : process.env.NODE_ENV === "development"
      ? [sampleTeam]
      : [];

  // Add loading state to the UI
  const [isPageLoading, setIsPageLoading] = useState(false);

  // Update loading state based on API loading state
  useEffect(() => {
    setIsPageLoading(isTeamsLoading);
  }, [isTeamsLoading]);

  // Filter teams based on search query
  const filteredTeams = teamsToDisplay.filter(
    (team) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle team selection
  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  };

  // Handle select all teams
  const toggleSelectAll = () => {
    if (selectedTeams.length === filteredTeams.length) {
      setSelectedTeams([]);
    } else {
      setSelectedTeams(filteredTeams.map((team) => team.id));
    }
  };

  // Modal states
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [editTeamModalOpen, setEditTeamModalOpen] = useState(false);
  const [deleteTeamModalOpen, setDeleteTeamModalOpen] = useState(false);
  const [viewMembersModalOpen, setViewMembersModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  // Selected team for modals
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedTeamName, setSelectedTeamName] = useState("");

  // Handle team actions
  const handleEditTeamUI = (teamId: string, teamName: string) => {
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setEditTeamModalOpen(true);
  };

  const handleDeleteTeamUI = (teamId: string, teamName: string) => {
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setDeleteTeamModalOpen(true);
  };

  const handleAddMember = (teamId: string, teamName: string) => {
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setAddMemberModalOpen(true);
  };

  const handleViewMembers = (teamId: string, teamName: string) => {
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setViewMembersModalOpen(true);
  };

  // Handle create team button click
  const handleCreateTeamClick = () => {
    setCreateTeamModalOpen(true);
  };

  // Handle successful team operations
  const handleTeamOperationSuccess = () => {
    // Refresh the teams list
    fetchTeams();
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  // itemVariants is already defined above

  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Add onMenuClick handler
  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onMenuClick={handleMenuClick}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          userRole={user?.role}
        />

        <main className="flex-1 overflow-y-auto relative z-10">
          <motion.div
            className="p-4 md:p-8 space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header section */}
            <motion.div
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-600/20 rounded-lg mr-4">
                    <FaUsersCog className="h-8 w-8 text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                      Team Management
                    </h1>
                    <p className="mt-1 text-gray-300">
                      Create and manage support teams
                    </p>
                  </div>
                </div>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white shadow-md"
                  onClick={handleCreateTeamClick}
                >
                  <FaPlus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
              </div>
            </motion.div>
            {/* Tabs section */}
            <motion.div variants={itemVariants}>
              <Tabs defaultValue="all-teams" className="w-full">
                <TabsList className="bg-gray-800/50 border border-gray-700/50 p-1 rounded-lg mb-6">
                  <TabsTrigger
                    value="all-teams"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                  >
                    All Teams
                  </TabsTrigger>
                  <TabsTrigger
                    value="my-teams"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                  >
                    My Teams
                  </TabsTrigger>
                  <TabsTrigger
                    value="team-performance"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                  >
                    Team Performance
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all-teams">
                  <motion.div
                    variants={itemVariants}
                    className="bg-gray-800/30 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white">
                        Teams
                      </h2>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-64 relative">
                          <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                            <FaSearch />
                          </div>
                          <input
                            type="text"
                            placeholder="Search teams..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2 px-10 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                        >
                          <FaFilter />
                        </Button>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="text-left border-b border-gray-700/50">
                              <th className="px-4 py-3">
                                <Checkbox
                                  id="select-all-teams"
                                  checked={
                                    filteredTeams.length > 0 &&
                                    selectedTeams.length ===
                                      filteredTeams.length
                                  }
                                  onCheckedChange={toggleSelectAll}
                                  className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Team Name
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Members
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Team Lead
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Tickets
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Created
                              </th>
                              <th className="px-4 py-3 text-right font-medium text-gray-300">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {isPageLoading ? (
                              // Loading skeleton
                              Array(3)
                                .fill(0)
                                .map((_, index) => (
                                  <tr
                                    key={`loading-${index}`}
                                    className="border-b border-gray-700 animate-pulse"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="h-8 bg-gray-700 rounded w-full"></div>
                                    </td>
                                  </tr>
                                ))
                            ) : teamsError ? (
                              // Error state
                              <tr>
                                <td
                                  colSpan={7}
                                  className="px-4 py-8 text-center text-red-400"
                                >
                                  <div className="flex flex-col items-center justify-center space-y-3">
                                    <FaExclamationTriangle className="h-8 w-8" />
                                    <p>Error loading teams: {teamsError}</p>
                                    <button
                                      onClick={() => fetchTeams()}
                                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
                                    >
                                      Try Again
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : filteredTeams.length > 0 ? (
                              filteredTeams.map((team) => {
                                const teamLead = team.members.find(
                                  (member) => member.id === team.leadId
                                );
                                return (
                                  <tr
                                    key={team.id}
                                    className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors duration-150"
                                  >
                                    <td className="px-4 py-3">
                                      <Checkbox
                                        id={`select-team-${team.id}`}
                                        checked={selectedTeams.includes(
                                          team.id
                                        )}
                                        onCheckedChange={() =>
                                          toggleTeamSelection(team.id)
                                        }
                                        className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="font-medium text-white">
                                        {team.name}
                                      </div>
                                      <div className="text-xs text-gray-400 max-w-xs truncate">
                                        {team.description}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex -space-x-2">
                                        {team.members
                                          .slice(0, 3)
                                          .map((member) => (
                                            <div
                                              key={member.id}
                                              className="h-8 w-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-xs font-medium text-blue-300"
                                              title={member.name}
                                            >
                                              {member.name.charAt(0) +
                                                (member.name
                                                  .split(" ")[1]
                                                  ?.charAt(0) || "")}
                                            </div>
                                          ))}
                                        {team.members.length > 3 && (
                                          <div className="h-8 w-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-xs text-blue-300">
                                            +{team.members.length - 3}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-300">
                                      {teamLead
                                        ? teamLead.name
                                        : "Not assigned"}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center">
                                        <span className="font-medium text-white">
                                          {team.ticketsResolved}
                                        </span>
                                        <span className="text-gray-400 mx-1">
                                          /
                                        </span>
                                        <span className="text-gray-300">
                                          {team.ticketsAssigned}
                                        </span>
                                        <div className="ml-2 h-1.5 w-16 bg-gray-700 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{
                                              width: `${Math.round(
                                                (team.ticketsResolved /
                                                  team.ticketsAssigned) *
                                                  100
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-400">
                                      {team.createdAt}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50"
                                          >
                                            <FaEllipsisH className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          align="end"
                                          className="bg-gray-800 border-gray-700 text-gray-200"
                                        >
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleEditTeamUI(
                                                team.id,
                                                team.name
                                              )
                                            }
                                            className="hover:bg-gray-700 focus:bg-gray-700"
                                          >
                                            <FaEdit className="h-4 w-4 mr-2 text-blue-400" />
                                            Edit Team
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleAddMember(
                                                team.id,
                                                team.name
                                              )
                                            }
                                            className="hover:bg-gray-700 focus:bg-gray-700"
                                          >
                                            <FaUserPlus className="h-4 w-4 mr-2 text-green-400" />
                                            Add Member
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleViewMembers(
                                                team.id,
                                                team.name
                                              )
                                            }
                                            className="hover:bg-gray-700 focus:bg-gray-700"
                                          >
                                            <FaUsers className="h-4 w-4 mr-2 text-blue-400" />
                                            View Members
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleDeleteTeamUI(
                                                team.id,
                                                team.name
                                              )
                                            }
                                            className="text-red-400 hover:bg-gray-700 focus:bg-gray-700"
                                          >
                                            <FaTrash className="h-4 w-4 mr-2" />
                                            Delete Team
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="px-4 py-8 text-center"
                                >
                                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                                    <FaSearch className="h-6 w-6 text-gray-400" />
                                  </div>
                                  <h3 className="text-lg font-medium text-white">
                                    No teams found
                                  </h3>
                                  <p className="text-gray-400 mt-2">
                                    {searchQuery
                                      ? "Try adjusting your search"
                                      : "No teams available"}
                                  </p>
                                  {searchQuery ? (
                                    <Button
                                      variant="link"
                                      onClick={() => setSearchQuery("")}
                                      className="mt-2 text-blue-400 hover:text-blue-300"
                                    >
                                      Clear search
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={handleCreateTeamClick}
                                      className="mt-4 bg-blue-600 hover:bg-blue-700"
                                    >
                                      <FaPlus className="mr-2 h-4 w-4" />
                                      Create Your First Team
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                <TabsContent value="my-teams">
                  <motion.div
                    variants={itemVariants}
                    className="bg-gray-800/30 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                  >
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                        <FaUsersCog className="h-6 w-6 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-medium text-white">
                        My Teams
                      </h3>
                      <p className="text-gray-400 mt-2 max-w-md mx-auto">
                        Teams where you are a member or leader
                      </p>
                    </div>
                  </motion.div>
                </TabsContent>

                <TabsContent value="team-performance">
                  <motion.div
                    variants={itemVariants}
                    className="bg-gray-800/30 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                  >
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                        <FaChartBar className="h-6 w-6 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-medium text-white">
                        Team Performance
                      </h3>
                      <p className="text-gray-400 mt-2 max-w-md mx-auto">
                        Performance metrics and analytics for all teams
                      </p>
                    </div>
                  </motion.div>
                </TabsContent>
              </Tabs>
            </motion.div>
          </motion.div>
        </main>
      </div>

      <Footer />

      {/* Team Management Modals */}
      <CreateTeamModal
        isOpen={createTeamModalOpen}
        onClose={() => setCreateTeamModalOpen(false)}
        onSuccess={handleTeamOperationSuccess}
      />

      <EditTeamModal
        isOpen={editTeamModalOpen}
        onClose={() => setEditTeamModalOpen(false)}
        teamId={selectedTeamId}
        initialData={{
          name: selectedTeamName,
          description:
            teamsToDisplay.find((t) => t.id === selectedTeamId)?.description ||
            "",
        }}
        onSuccess={handleTeamOperationSuccess}
      />

      <DeleteTeamModal
        isOpen={deleteTeamModalOpen}
        onClose={() => setDeleteTeamModalOpen(false)}
        teamId={selectedTeamId}
        teamName={selectedTeamName}
        onSuccess={handleTeamOperationSuccess}
      />

      <TeamMembersModal
        isOpen={viewMembersModalOpen}
        onClose={() => setViewMembersModalOpen(false)}
        teamId={selectedTeamId}
        onAddMember={() => {
          setViewMembersModalOpen(false);
          setAddMemberModalOpen(true);
        }}
      />

      <AddTeamMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        teamId={selectedTeamId}
        teamName={selectedTeamName}
        onSuccess={() => {
          // If we were viewing members before, go back to that view
          if (viewMembersModalOpen) {
            setAddMemberModalOpen(false);
            setViewMembersModalOpen(true);
          } else {
            handleTeamOperationSuccess();
          }
        }}
      />
    </div>
  );
};

// Export the component directly - it will be wrapped with TeamProvider in App.tsx
export default TeamManagementPage;
