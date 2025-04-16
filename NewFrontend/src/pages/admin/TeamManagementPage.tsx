import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  FaUsersCog,
  FaPlus,
  FaSearch,
  FaEllipsisH,
  FaEdit,
  FaTrash,
  FaUserPlus,
  FaUsers,
  FaChartBar,
  FaExclamationTriangle,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { useTeamManagement } from "@/features/team/hooks/useTeamManagement";
import { extendedTeamApi as teamApi } from "@/api/teamApi";
// Will be used when API integration is complete
// import { Team as TeamType } from "@/api/teamApi";
import SimpleCreateTeamModal from "@/features/team/components/SimpleCreateTeamModal";
import SimpleEditTeamModal from "@/features/team/components/SimpleEditTeamModal";
import DeleteTeamModal from "@/features/team/components/DeleteTeamModal";
import TeamFilterBar, {
  TeamFilterOptions,
} from "@/features/team/components/TeamFilterBar";
import BulkActionsMenu from "@/features/team/components/BulkActionsMenu";
import BulkMemberAssignmentModal from "@/features/team/components/BulkMemberAssignmentModal";
import TeamAnalytics from "@/features/team/components/TeamAnalytics";

import TeamMembersModal from "@/features/team/components/TeamMembersModal";
import AddTeamMemberModal from "@/features/team/components/AddTeamMemberModal";
import AddExistingMemberModal from "@/features/team/components/AddExistingMemberModal";
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
  teamType: "technical" | "support";
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
    teamType: apiTeam.teamType || "support",
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
  // Get current user
  const { user } = useAuth();

  // Advanced filtering is handled by TeamFilterBar component
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  // Get team management functions and state
  const {
    fetchTeams,
    fetchMyTeams,
    teams: apiTeams,
    myTeams,
    isLoading: isTeamsLoading,
    error: teamsError,
  } = useTeamManagement();

  // Add loading state to the UI
  const [isPageLoading, setIsPageLoading] = useState(false);

  // Update loading state based on API loading state
  useEffect(() => {
    setIsPageLoading(isTeamsLoading);
  }, [isTeamsLoading]);

  // Filter state
  const [filterOptions, setFilterOptions] = useState<TeamFilterOptions>({
    search: "",
    teamTypes: [],
    sortBy: "name",
    sortDirection: "asc",
    onlyMyTeams: false,
    dateRange: {
      from: "",
      to: "",
    },
  });

  // Handle filter changes
  const handleFilterChange = (newFilters: TeamFilterOptions) => {
    setFilterOptions(newFilters);
  };

  // Reset filters
  const resetFilters = () => {
    setFilterOptions({
      search: "",
      teamTypes: [],
      sortBy: "name",
      sortDirection: "asc",
      onlyMyTeams: false,
      dateRange: {
        from: "",
        to: "",
      },
    });
  };

  // Track if we've already fetched teams
  const hasLoadedTeams = useRef(false);

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Fetch teams ONLY when the page loads for the first time
  useEffect(() => {
    // Only fetch if we haven't loaded teams yet
    if (!hasLoadedTeams.current) {
      console.log("TeamManagementPage: Initial fetch of teams data...");
      // Fetch all teams for the "All Teams" tab
      fetchTeams();
      // Also fetch my teams for the "My Teams" tab
      fetchMyTeams();
      hasLoadedTeams.current = true;
    }

    // No automatic refresh - data will only be refreshed:
    // 1. On initial page load (above)
    // 2. When user clicks the refresh button
    // 3. After team operations (create, edit, delete, etc.)
    return () => {}; // Empty cleanup function
  }, [fetchTeams, fetchMyTeams]);

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
    teamType: "technical",
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

  // Combine API teams and my teams, removing duplicates
  const allTeams = useMemo(() => {
    // Start with all teams from API
    let teams =
      apiTeams && apiTeams.length > 0
        ? apiTeams.map(convertApiTeamToUITeam)
        : [];

    // Add my teams if available
    if (myTeams && myTeams.length > 0) {
      const myTeamsConverted = myTeams.map(convertApiTeamToUITeam);

      // Add teams that aren't already in the list (avoid duplicates)
      myTeamsConverted.forEach((myTeam) => {
        if (!teams.some((team) => team.id === myTeam.id)) {
          teams.push(myTeam);
        }
      });
    }

    // Only show sample team if explicitly requested via URL parameter
    // and there are no real teams available
    const urlParams = new URLSearchParams(window.location.search);
    const showSample = urlParams.get("showSample") === "true";

    if (
      teams.length === 0 &&
      process.env.NODE_ENV === "development" &&
      showSample
    ) {
      console.log("Showing sample team data");
      teams = [sampleTeam];
    }

    return teams;
  }, [apiTeams, myTeams]);

  // Apply filters to teams
  const filteredAndSortedTeams = useMemo(() => {
    // Start with all teams
    let result = [...allTeams];

    // Apply search filter
    if (filterOptions.search) {
      const searchLower = filterOptions.search.toLowerCase();
      result = result.filter(
        (team) =>
          team.name.toLowerCase().includes(searchLower) ||
          (team.description &&
            team.description.toLowerCase().includes(searchLower))
      );
    }

    // Apply team type filter
    if (filterOptions.teamTypes.length > 0) {
      result = result.filter((team) =>
        filterOptions.teamTypes.includes(team.teamType)
      );
    }

    // Apply my teams filter
    if (filterOptions.onlyMyTeams && user) {
      result = result.filter((team) =>
        team.members.some((member) => member.id === user.id)
      );
    }

    // Apply date range filter
    if (filterOptions.dateRange.from || filterOptions.dateRange.to) {
      result = result.filter((team) => {
        const teamDate = new Date(team.createdAt).getTime();
        const fromDate = filterOptions.dateRange.from
          ? new Date(filterOptions.dateRange.from).getTime()
          : 0;
        const toDate = filterOptions.dateRange.to
          ? new Date(filterOptions.dateRange.to).getTime() + 86400000 // Add one day to include the end date
          : Infinity;

        return teamDate >= fromDate && teamDate <= toDate;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let valueA: any, valueB: any;

      switch (filterOptions.sortBy) {
        case "name":
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case "createdAt":
          valueA = new Date(a.createdAt).getTime();
          valueB = new Date(b.createdAt).getTime();
          break;
        case "memberCount":
          valueA = a.members.length;
          valueB = b.members.length;
          break;
        case "teamType":
          valueA = a.teamType;
          valueB = b.teamType;
          break;
        default:
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
      }

      // Apply sort direction
      const sortFactor = filterOptions.sortDirection === "asc" ? 1 : -1;

      if (valueA < valueB) return -1 * sortFactor;
      if (valueA > valueB) return 1 * sortFactor;
      return 0;
    });

    return result;
  }, [allTeams, filterOptions, user]);

  // Use filtered teams for display
  const teamsToDisplay = filteredAndSortedTeams;

  // Legacy filter code - now replaced by the advanced filtering system
  // This is kept for backward compatibility with existing code
  const filteredTeams = teamsToDisplay;

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
  const [addExistingMemberModalOpen, setAddExistingMemberModalOpen] =
    useState(false);
  const [bulkMemberAssignModalOpen, setBulkMemberAssignModalOpen] =
    useState(false);

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

    // Also remove the team from the selected teams list
    setSelectedTeams((prev) => prev.filter((id) => id !== teamId));
  };

  const handleAddMember = (teamId: string, teamName: string) => {
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setAddMemberModalOpen(true);
  };

  const handleAddExistingMember = (teamId: string, teamName: string) => {
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setAddExistingMemberModalOpen(true);
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

  // Bulk operations handlers
  const handleBulkDelete = async () => {
    try {
      // Use the new bulk delete API endpoint
      const result = await teamApi.bulkDeleteTeams(selectedTeams);

      // Extract results from the API response
      const successful = result.results.successful.length;
      const failed = result.results.failed.length;
      // We're not using this variable but keeping it for reference
      // const unauthorized = result.results.unauthorized.length;

      if (failed > 0) {
        toast.error(`${failed} teams could not be deleted`);
      }

      if (successful > 0) {
        toast.success(`${successful} teams deleted successfully`);
      }

      // Refresh the teams list
      handleTeamOperationSuccess();

      // Clear selection
      setSelectedTeams([]);
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("An error occurred during bulk deletion");
    }
  };

  const handleBulkMemberAssign = () => {
    setBulkMemberAssignModalOpen(true);
  };

  const handleBulkExport = () => {
    // Create CSV data
    const selectedTeamData = filteredTeams
      .filter((team) => selectedTeams.includes(team.id))
      .map((team) => ({
        "Team Name": team.name,
        "Team Type": team.teamType,
        Description: team.description || "",
        Members: team.members.length,
        Lead: team.members.find((m) => m.id === team.leadId)?.name || "None",
        Created: new Date(team.createdAt).toLocaleDateString(),
        "Tickets Assigned": team.ticketsAssigned || 0,
        "Tickets Resolved": team.ticketsResolved || 0,
      }));

    // Convert to CSV
    const headers = Object.keys(selectedTeamData[0] || {}).join(",");
    const rows = selectedTeamData.map((team) =>
      Object.values(team)
        .map((value) =>
          typeof value === "string" && value.includes(",")
            ? `"${value}"`
            : value
        )
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");

    // Create download link
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute(
      "download",
      `teams-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast.success(`Exported ${selectedTeamData.length} teams to CSV`);
  };

  // Force refresh teams data - manually fetch from API
  // This is one of the three scenarios where we fetch fresh data:
  // 1. On initial page load
  // 2. When user clicks the refresh button - THIS FUNCTION
  // 3. After team operations (create, edit, delete, etc.)
  const forceRefreshTeams = useCallback(() => {
    console.log(
      "Force refreshing both 'All Teams' and 'My Teams' data from API..."
    );

    // Show loading state
    setIsPageLoading(true);
    toast.loading("Refreshing teams data...");

    // No need to clear cache as we're not using it anymore

    // Import the API client directly to make API calls
    import("@/api/teamApi")
      .then(({ extendedTeamApi: api }) => {
        // Make direct API calls
        Promise.all([
          // Get all teams
          api.getAllTeams(1, 100),
          // Get my teams
          api.getMyTeams(),
        ])
          .then(([allTeamsResponse, myTeamsResponse]) => {
            console.log(
              "Teams data refreshed from API",
              allTeamsResponse,
              myTeamsResponse
            );

            // Get the data from the API response
            const allTeamsData =
              allTeamsResponse.teams || allTeamsResponse.data || [];
            const myTeamsData = myTeamsResponse.data || [];

            console.log("Received fresh data from API:", {
              allTeamsData,
              myTeamsData,
            });

            // Now call the context functions to update the state with the new data
            // This will update the UI with the fresh data
            fetchTeams();
            fetchMyTeams();

            toast.dismiss();
            toast.success("Teams data refreshed from API");
          })
          .catch((error) => {
            console.error("Error refreshing teams data:", error);
            toast.dismiss();
            toast.error("Failed to refresh teams data");
          })
          .finally(() => {
            setIsPageLoading(false);
          });
      })
      .catch((error) => {
        console.error("Error importing API client:", error);
        toast.dismiss();
        toast.error("Failed to refresh teams data");
        setIsPageLoading(false);
      });
  }, [fetchTeams, fetchMyTeams]);

  // Handle successful team operations
  // This is one of the three scenarios where we fetch fresh data:
  // 1. On initial page load
  // 2. When user clicks the refresh button
  // 3. After team operations (create, edit, delete, etc.) - THIS FUNCTION
  const handleTeamOperationSuccess = () => {
    console.log("Team operation success - refreshing teams");

    // We'll make direct API calls to ensure we get the latest data
    // This is more reliable than using the context's fetch functions
    setIsPageLoading(true);
    toast.loading("Refreshing teams data...");

    // No need to clear cache as we're not using it anymore

    // Make direct API calls
    // Import the API client directly to make API calls
    import("@/api/teamApi")
      .then(({ extendedTeamApi: api }) => {
        // Make direct API calls
        Promise.all([
          // Get all teams
          api.getAllTeams(1, 100),
          // Get my teams
          api.getMyTeams(),
        ])
          .then(([allTeamsResponse, myTeamsResponse]) => {
            console.log(
              "Teams data refreshed after operation:",
              allTeamsResponse,
              myTeamsResponse
            );

            // Update the cache with the new data
            const allTeamsData =
              allTeamsResponse.teams || allTeamsResponse.data || [];
            const myTeamsData = myTeamsResponse.data || [];

            // No need to update cache as we're not using it anymore

            // Now call the context functions to update the state
            fetchTeams();
            fetchMyTeams();

            // Clear selected teams that might have been deleted
            setSelectedTeams([]);

            // Reset any modal states
            setCreateTeamModalOpen(false);
            setEditTeamModalOpen(false);
            setDeleteTeamModalOpen(false);
            setViewMembersModalOpen(false);
            setBulkMemberAssignModalOpen(false);

            toast.dismiss();
            toast.success("Team operation completed successfully");
          })
          .catch((error) => {
            console.error("Error refreshing teams after operation:", error);
            toast.dismiss();
            toast.error("Operation completed but failed to refresh data");

            // Still try to update UI
            fetchTeams();
            fetchMyTeams();

            // Reset modals
            setCreateTeamModalOpen(false);
            setEditTeamModalOpen(false);
            setDeleteTeamModalOpen(false);
            setViewMembersModalOpen(false);
            setBulkMemberAssignModalOpen(false);
          })
          .finally(() => {
            setIsPageLoading(false);
          });
      })
      .catch((error) => {
        console.error("Error importing API client:", error);
        toast.dismiss();
        toast.error("Operation completed but failed to refresh data");
        setIsPageLoading(false);

        // Reset modals
        setCreateTeamModalOpen(false);
        setEditTeamModalOpen(false);
        setDeleteTeamModalOpen(false);
        setViewMembersModalOpen(false);
        setBulkMemberAssignModalOpen(false);
      });
    // No need for setTimeout as we're not using cache anymore
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

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Add onMenuClick handler
  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Add keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+N to create a new team
      if (e.altKey && e.key === "n") {
        e.preventDefault();
        handleCreateTeamClick();
      }

      // Alt+R to refresh teams
      if (e.altKey && e.key === "r") {
        e.preventDefault();
        forceRefreshTeams();
      }

      // Alt+S to toggle sidebar
      if (e.altKey && e.key === "s") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }

      // Escape key to clear selection
      if (e.key === "Escape" && selectedTeams.length > 0) {
        e.preventDefault();
        setSelectedTeams([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateTeamClick, forceRefreshTeams, selectedTeams]);

  return (
    <ErrorBoundary>
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
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                        <span className="bg-gray-800 px-2 py-1 rounded-md flex items-center">
                          <kbd className="px-1 bg-gray-700 rounded mr-1">
                            Alt
                          </kbd>
                          +
                          <kbd className="px-1 bg-gray-700 rounded mx-1">N</kbd>
                          New Team
                        </span>
                        <span className="bg-gray-800 px-2 py-1 rounded-md flex items-center">
                          <kbd className="px-1 bg-gray-700 rounded mr-1">
                            Alt
                          </kbd>
                          +
                          <kbd className="px-1 bg-gray-700 rounded mx-1">R</kbd>
                          Refresh
                        </span>
                        <span className="bg-gray-800 px-2 py-1 rounded-md flex items-center">
                          <kbd className="px-1 bg-gray-700 rounded mr-1">
                            Alt
                          </kbd>
                          +
                          <kbd className="px-1 bg-gray-700 rounded mx-1">S</kbd>
                          Toggle Sidebar
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={forceRefreshTeams}
                      className="bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center font-medium"
                      title="Refresh both 'All Teams' and 'My Teams' data directly from API"
                      disabled={isPageLoading}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 mr-2 ${
                          isPageLoading ? "animate-spin" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh from API
                    </Button>

                    <BulkActionsMenu
                      selectedCount={selectedTeams.length}
                      onDeleteSelected={handleBulkDelete}
                      onExportSelected={handleBulkExport}
                      onAssignMembers={handleBulkMemberAssign}
                      disabled={isPageLoading}
                    />

                    <Button
                      className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white shadow-md"
                      onClick={handleCreateTeamClick}
                    >
                      <FaPlus className="mr-2 h-4 w-4" />
                      Create Team
                    </Button>
                  </div>
                </div>
              </motion.div>
              {/* Filter Bar */}
              <motion.div variants={itemVariants}>
                <TeamFilterBar
                  filterOptions={filterOptions}
                  onFilterChange={handleFilterChange}
                  onReset={resetFilters}
                  totalTeams={allTeams.length}
                  filteredTeams={filteredAndSortedTeams.length}
                />
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
                      </div>
                      <div className="p-6">
                        <div className="overflow-x-auto">
                          <table
                            className="w-full border-collapse"
                            aria-label="Teams list"
                            role="grid"
                          >
                            <thead>
                              <tr
                                className="text-left border-b border-gray-700/50"
                                role="row"
                              >
                                <th
                                  className="px-4 py-3"
                                  role="columnheader"
                                  aria-label="Select"
                                >
                                  <Checkbox
                                    id="select-all-teams"
                                    checked={
                                      filteredTeams.length > 0 &&
                                      selectedTeams.length ===
                                        filteredTeams.length
                                    }
                                    onCheckedChange={toggleSelectAll}
                                    className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                    aria-label="Select all teams"
                                  />
                                </th>
                                <th
                                  className="px-4 py-3 font-medium text-gray-300"
                                  role="columnheader"
                                  aria-sort="none"
                                >
                                  Team Name
                                </th>
                                <th
                                  className="px-4 py-3 font-medium text-gray-300"
                                  role="columnheader"
                                  aria-sort="none"
                                >
                                  Members
                                </th>
                                <th
                                  className="px-4 py-3 font-medium text-gray-300"
                                  role="columnheader"
                                  aria-sort="none"
                                >
                                  Team Lead
                                </th>
                                <th
                                  className="px-4 py-3 font-medium text-gray-300"
                                  role="columnheader"
                                  aria-sort="none"
                                >
                                  Tickets
                                </th>
                                <th
                                  className="px-4 py-3 font-medium text-gray-300"
                                  role="columnheader"
                                  aria-sort="none"
                                >
                                  Created
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-300"
                                  role="columnheader"
                                >
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
                                      role="row"
                                      aria-selected={selectedTeams.includes(
                                        team.id
                                      )}
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
                                          aria-label={`Select ${team.name} team`}
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <div className="font-medium text-white">
                                            {team.name}
                                          </div>
                                          <span
                                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                              team.teamType === "technical"
                                                ? "bg-purple-900/60 text-purple-200 border border-purple-700/50"
                                                : "bg-blue-900/60 text-blue-200 border border-blue-700/50"
                                            }`}
                                          >
                                            {team.teamType === "technical"
                                              ? "Technical"
                                              : "Support"}
                                          </span>
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
                                              aria-label={`Actions for ${team.name}`}
                                              aria-haspopup="true"
                                            >
                                              <span className="sr-only">
                                                Open menu for {team.name}
                                              </span>
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
                                              role="menuitem"
                                              aria-label={`Edit ${team.name}`}
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
                                              role="menuitem"
                                              aria-label={`Add member to ${team.name}`}
                                            >
                                              <FaUserPlus className="h-4 w-4 mr-2 text-green-400" />
                                              Invite New Member
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleAddExistingMember(
                                                  team.id,
                                                  team.name
                                                )
                                              }
                                              className="hover:bg-gray-700 focus:bg-gray-700"
                                              role="menuitem"
                                              aria-label={`Add existing member to ${team.name}`}
                                            >
                                              <FaUserPlus className="h-4 w-4 mr-2 text-blue-400" />
                                              Add Existing Member
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleViewMembers(
                                                  team.id,
                                                  team.name
                                                )
                                              }
                                              className="hover:bg-gray-700 focus:bg-gray-700"
                                              role="menuitem"
                                              aria-label={`View members of ${team.name}`}
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
                                              role="menuitem"
                                              aria-label={`Delete ${team.name}`}
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
                                      No teams available
                                    </p>
                                    {
                                      <Button
                                        onClick={handleCreateTeamClick}
                                        className="mt-4 bg-blue-600 hover:bg-blue-700"
                                      >
                                        <FaPlus className="mr-2 h-4 w-4" />
                                        Create Your First Team
                                      </Button>
                                    }
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
                      <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <h3 className="text-xl font-medium text-white flex items-center">
                              <FaUsersCog className="h-5 w-5 text-blue-400 mr-2" />
                              My Teams
                            </h3>
                            <p className="text-gray-400 mt-1">
                              Teams where you are a member or leader
                            </p>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-gray-700">
                          <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-800/50">
                              <tr>
                                <th
                                  scope="col"
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                                >
                                  Team
                                </th>
                                <th
                                  scope="col"
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                                >
                                  Type
                                </th>
                                <th
                                  scope="col"
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                                >
                                  Members
                                </th>
                                <th
                                  scope="col"
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                                >
                                  Your Role
                                </th>
                                <th
                                  scope="col"
                                  className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider"
                                >
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-gray-800/20 divide-y divide-gray-700">
                              {myTeams && myTeams.length > 0 ? (
                                myTeams
                                  .map(convertApiTeamToUITeam)
                                  .map((team) => {
                                    // Find your role in the team
                                    const yourMembership = team.members.find(
                                      (member) => member.id === user?.id
                                    );
                                    const yourRole =
                                      yourMembership?.role || "Member";

                                    return (
                                      <tr
                                        key={team.id}
                                        className="hover:bg-gray-700/30"
                                      >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                                              {team.name.charAt(0)}
                                            </div>
                                            <div className="ml-4">
                                              <div className="text-sm font-medium text-white">
                                                {team.name}
                                              </div>
                                              <div className="text-sm text-gray-400 max-w-xs truncate">
                                                {team.description}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <span
                                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                              team.teamType === "technical"
                                                ? "bg-purple-900/50 text-purple-200"
                                                : "bg-blue-900/50 text-blue-200"
                                            }`}
                                          >
                                            {team.teamType === "technical"
                                              ? "Technical"
                                              : "Support"}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                          <div className="flex items-center">
                                            <div className="flex -space-x-2 mr-2">
                                              {team.members
                                                .slice(0, 3)
                                                .map((member) => (
                                                  <div
                                                    key={member.id}
                                                    className="h-6 w-6 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-xs font-medium text-blue-300"
                                                    title={member.name}
                                                  >
                                                    {member.name.charAt(0)}
                                                  </div>
                                                ))}
                                            </div>
                                            <span className="text-gray-400">
                                              {team.members.length}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                          <span
                                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                              yourRole
                                                .toLowerCase()
                                                .includes("lead")
                                                ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700/30"
                                                : "bg-green-900/30 text-green-400 border border-green-700/30"
                                            }`}
                                          >
                                            {yourRole}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                          <Button
                                            onClick={() =>
                                              handleViewMembers(
                                                team.id,
                                                team.name
                                              )
                                            }
                                            className="text-blue-400 hover:text-blue-300 bg-transparent"
                                            variant="ghost"
                                          >
                                            View Details
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })
                              ) : (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-6 py-16 text-center text-gray-400"
                                  >
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                                      <FaUsersCog className="h-6 w-6 text-blue-400" />
                                    </div>
                                    <h3 className="text-xl font-medium text-white">
                                      No Teams Found
                                    </h3>
                                    <p className="text-gray-400 mt-2 max-w-md mx-auto">
                                      You are not a member of any teams yet
                                    </p>
                                    <Button
                                      onClick={handleCreateTeamClick}
                                      className="mt-4 bg-blue-600 hover:bg-blue-700"
                                    >
                                      <FaPlus className="mr-2 h-4 w-4" />
                                      Create Your First Team
                                    </Button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  </TabsContent>

                  <TabsContent value="team-performance">
                    <motion.div variants={itemVariants} className="space-y-6">
                      {/* Team Selection for Analytics */}
                      <div className="bg-gray-800/30 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 p-6">
                        <h3 className="text-xl font-medium text-white flex items-center">
                          <FaChartBar className="mr-2 h-5 w-5 text-blue-400" />
                          Team Performance Analytics
                        </h3>
                        <p className="text-gray-400 mt-1">
                          View detailed performance metrics and analytics for
                          your teams
                        </p>

                        {teamsToDisplay.length === 0 ? (
                          <div className="mt-6 text-center py-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                              <FaExclamationTriangle className="h-6 w-6 text-yellow-400" />
                            </div>
                            <h3 className="text-xl font-medium text-white">
                              No Teams Available
                            </h3>
                            <p className="text-gray-400 mt-2 max-w-md mx-auto">
                              Create a team first to view performance analytics
                            </p>
                            <Button
                              onClick={handleCreateTeamClick}
                              className="mt-4 bg-blue-600 hover:bg-blue-700"
                            >
                              <FaPlus className="mr-2 h-4 w-4" />
                              Create Team
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teamsToDisplay.map((team) => (
                              <div
                                key={team.id}
                                className="bg-gray-800/50 rounded-lg border border-gray-700 hover:border-blue-500/30 p-4 cursor-pointer transition-all duration-200"
                                onClick={() => setSelectedTeamId(team.id)}
                              >
                                <div className="flex items-center">
                                  <div className="p-2 bg-blue-600/20 rounded-lg mr-3">
                                    <FaUsers className="h-6 w-6 text-blue-500" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-white">
                                      {team.name}
                                    </h4>
                                    <p className="text-sm text-gray-400">
                                      {team.members.length} members
                                    </p>
                                  </div>
                                  {selectedTeamId === team.id && (
                                    <div className="ml-auto bg-blue-500/20 p-1 rounded-full">
                                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Team Analytics Component */}
                      {selectedTeamId && (
                        <TeamAnalytics teamId={selectedTeamId} />
                      )}
                    </motion.div>
                  </TabsContent>
                </Tabs>
              </motion.div>
            </motion.div>
          </main>
        </div>

        <Footer />

        {/* Team Management Modals */}
        <SimpleCreateTeamModal
          isOpen={createTeamModalOpen}
          onClose={() => setCreateTeamModalOpen(false)}
          onSuccess={handleTeamOperationSuccess}
        />

        <SimpleEditTeamModal
          isOpen={editTeamModalOpen}
          onClose={() => setEditTeamModalOpen(false)}
          teamId={selectedTeamId}
          initialData={{
            name: selectedTeamName,
            description:
              teamsToDisplay.find((t) => t.id === selectedTeamId)
                ?.description || "",
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
            // Use a small delay to ensure the first modal is fully closed
            setTimeout(() => {
              setAddMemberModalOpen(true);
            }, 50);
          }}
        />

        <AddTeamMemberModal
          isOpen={addMemberModalOpen}
          onClose={() => setAddMemberModalOpen(false)}
          teamId={selectedTeamId}
          teamName={selectedTeamName}
          onSuccess={() => {
            // If we were viewing members before, go back to that view
            setAddMemberModalOpen(false);

            if (viewMembersModalOpen) {
              // Use a small delay to ensure the first modal is fully closed
              setTimeout(() => {
                setViewMembersModalOpen(true);
              }, 50);
            } else {
              // Just refresh the data
              handleTeamOperationSuccess();
            }
          }}
        />

        <AddExistingMemberModal
          isOpen={addExistingMemberModalOpen}
          onClose={() => setAddExistingMemberModalOpen(false)}
          teamId={selectedTeamId}
          teamName={selectedTeamName}
          onSuccess={() => {
            // If we were viewing members before, go back to that view
            setAddExistingMemberModalOpen(false);

            if (viewMembersModalOpen) {
              // Use a small delay to ensure the first modal is fully closed
              setTimeout(() => {
                setViewMembersModalOpen(true);
              }, 50);
            } else {
              // Just refresh the data
              handleTeamOperationSuccess();
            }
          }}
        />

        {/* Bulk Member Assignment Modal */}
        <BulkMemberAssignmentModal
          isOpen={bulkMemberAssignModalOpen}
          onClose={() => setBulkMemberAssignModalOpen(false)}
          selectedTeamIds={selectedTeams}
          onSuccess={handleTeamOperationSuccess}
        />
      </div>
    </ErrorBoundary>
  );
};

export default TeamManagementPage;
