import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
  useMemo,
} from "react";
// Cache has been removed to ensure fresh data
import {
  extendedTeamApi as teamApi,
  invitationApi,
  Team,
  Invitation,
} from "@/api/teamApi";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { toast } from "react-hot-toast";

interface TeamContextType {
  // Teams
  teams: Team[];
  myTeams: Team[];
  currentTeam: Team | null;
  isLoading: boolean;
  error: string | null;

  // Team operations
  fetchTeams: (page?: number, limit?: number) => Promise<void>;
  fetchMyTeams: () => Promise<void>;
  fetchTeamById: (id: string) => Promise<Team | null>;
  createTeam: (teamData: {
    name: string;
    description?: string;
    teamType?: "technical" | "support";
  }) => Promise<Team | null>;
  updateTeam: (
    id: string,
    teamData: {
      name?: string;
      description?: string;
      teamType?: "technical" | "support";
    }
  ) => Promise<Team | null>;
  deleteTeam: (id: string) => Promise<boolean>;

  // Team membership
  addTeamMember: (
    teamId: string,
    memberData: { userId: string; role?: "lead" | "member" }
  ) => Promise<Team | null>;
  removeTeamMember: (teamId: string, memberId: string) => Promise<Team | null>;
  changeTeamLead: (teamId: string, newLeadId: string) => Promise<Team | null>;

  // Invitations
  teamInvitations: Invitation[];
  myInvitations: Invitation[];
  createInvitation: (
    teamId: string,
    invitationData: { email: string; role?: "lead" | "member" }
  ) => Promise<Invitation | null>;
  fetchTeamInvitations: (
    teamId: string,
    page?: number,
    limit?: number
  ) => Promise<void>;
  fetchMyInvitations: () => Promise<void>;
  verifyInvitation: (
    code: string
  ) => Promise<{ invitation: Invitation; team: Team; inviter: any } | null>;
  acceptInvitation: (
    code: string
  ) => Promise<{ team: Team; invitation: Invitation } | null>;
  revokeInvitation: (id: string) => Promise<Invitation | null>;
  resendInvitation: (id: string) => Promise<Invitation | null>;

  // Set current team
  setCurrentTeam: (team: Team | null) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

// Improved debounce function with immediate option
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { immediate?: boolean } = {}
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    // If enough time has passed since the last call and immediate execution is enabled
    if (options.immediate && (elapsed > wait || !timeout)) {
      lastCallTime = now;
      func(...args);
      return;
    }

    // Otherwise, use the standard debounce behavior
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      lastCallTime = Date.now();
      func(...args);
    }, wait);
  };
}

// Safe hook wrapper that returns null if not in a Router context
const useSafeAuth = () => {
  try {
    return useAuth();
  } catch (e) {
    console.warn("TeamProvider: useAuth hook failed, continuing without auth");
    return { user: null };
  }
};

export const TeamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Get user from auth context if available
  const { user } = useSafeAuth();

  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teamInvitations, setTeamInvitations] = useState<Invitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for tracking API request status
  const requestTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const isRateLimitedRef = useRef<Record<string, boolean>>({
    teams: false,
    myTeams: false,
    myInvitations: false,
  });

  // Helper function to handle rate limiting
  const handleRateLimiting = useCallback(
    (endpoint: string, retryAfter = 5000) => {
      // Mark endpoint as rate limited
      isRateLimitedRef.current[endpoint] = true;

      // Clear any existing timer
      if (requestTimersRef.current[endpoint]) {
        clearTimeout(requestTimersRef.current[endpoint]);
      }

      // Set a timer to clear the rate limit flag
      requestTimersRef.current[endpoint] = setTimeout(() => {
        isRateLimitedRef.current[endpoint] = false;
      }, retryAfter);

      // Show toast notification
      toast.error(
        `Too many requests to ${endpoint}. Please try again in a few seconds.`
      );
    },
    []
  );

  // Fetch teams directly from API (no caching)
  const fetchTeams = async (
    filters = {
      page: 1,
      limit: 10,
      search: "",
      teamTypes: [],
      onlyMyTeams: false,
      fromDate: "",
      toDate: "",
      sortBy: "name",
      sortOrder: "asc" as "asc" | "desc",
    },
    _forceRefresh = false // Parameter kept for backward compatibility
  ) => {
    // Check if we're rate limited for this endpoint
    if (isRateLimitedRef.current.teams) {
      return [];
    }

    console.log("Fetching teams directly from API with filters:", filters);

    try {
      setIsLoading(true);
      setError(null);

      // Use the new filtered API endpoint
      console.log(
        "Fetching teams from API with filters:",
        filters,
        "forceRefresh:",
        forceRefresh
      );

      // For now, since the backend endpoint might not be fully implemented,
      // we'll use the existing getAllTeams method as a fallback
      let response;
      try {
        response = await teamApi.getTeamsWithFilters(filters);
        console.log("API response for teams with filters:", response);
      } catch (error) {
        console.warn(
          "Error using getTeamsWithFilters, falling back to getAllTeams:",
          error
        );
        // Fallback to the old method
        response = await teamApi.getAllTeams(filters.page, filters.limit);
        console.log("Fallback API response for teams:", response);
      }

      // Completely replace the teams state with the API response
      // Handle both response formats (teams property or direct array)
      const teamsData = response.teams || response.data || [];
      console.log("Teams data to set:", teamsData);
      setTeams(teamsData);

      return teamsData;
    } catch (err: any) {
      // Handle rate limiting (429 status code)
      if (err.response?.status === 429) {
        // Get retry-after header or default to 5 seconds
        const retryAfter =
          parseInt(err.response.headers["retry-after"], 10) * 1000 || 5000;
        handleRateLimiting("teams", retryAfter);
      } else {
        setError(err.message || "Failed to fetch teams");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch my teams directly from API (no caching)
  const fetchMyTeams = async (_forceRefresh = false) => {
    // Parameter kept for backward compatibility
    // Check if we're rate limited for this endpoint
    if (isRateLimitedRef.current.myTeams) {
      return [];
    }

    console.log("Fetching my teams directly from API");

    try {
      setIsLoading(true);
      setError(null);

      console.log("Fetching my teams from API");
      const response = await teamApi.getMyTeams();
      console.log("API response for my teams:", response);

      // Completely replace the myTeams state with the API response
      const myTeamsData = response.data || [];
      setMyTeams(myTeamsData);

      return myTeamsData;
    } catch (err: any) {
      // Handle rate limiting (429 status code)
      if (err.response?.status === 429) {
        // Get retry-after header or default to 5 seconds
        const retryAfter =
          parseInt(err.response.headers["retry-after"], 10) * 1000 || 5000;
        handleRateLimiting("myTeams", retryAfter);
      } else {
        setError(err.message || "Failed to fetch my teams");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch team by ID
  const fetchTeamById = async (id: string, forceRefresh = false) => {
    try {
      // Validate ID format to avoid sending invalid ObjectIds to the server
      if (!id || id === "sample-id" || id.startsWith("sample-")) {
        console.warn("Invalid team ID format:", id);
        setError("Invalid team ID format");
        return null;
      }

      // No cache - always fetch from API
      console.log(`Fetching team ${id} from API`);

      setIsLoading(true);
      setError(null);

      const response = await teamApi.getTeamById(id);

      // No cache - data is only stored in state

      return response.data;
    } catch (err: any) {
      // Handle specific error cases
      if (
        err.response?.status === 400 &&
        err.response?.data?.message?.includes("Invalid team ID")
      ) {
        console.warn("Invalid team ID format:", id);
        setError("Invalid team ID format");
      } else {
        setError(err.message || "Failed to fetch team");
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Create team
  const createTeam = async (teamData: {
    name: string;
    description?: string;
    teamType?: "technical" | "support";
  }) => {
    try {
      setIsLoading(true);
      setError(null);

      // Create a temporary team with a temporary ID
      const tempId = `temp-${Date.now()}`;
      const tempTeam = {
        _id: tempId,
        id: tempId,
        name: teamData.name,
        description: teamData.description || "",
        teamType: teamData.teamType || "technical",
        members: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLoading: true,
      };

      // Optimistically update UI immediately
      setTeams((prevTeams) => [...prevTeams, tempTeam as any]);
      setMyTeams((prevTeams) => [...prevTeams, tempTeam as any]);

      // Make the API call
      const response = await teamApi.createTeam(teamData);

      // Update with the real data
      setTeams((prevTeams) =>
        prevTeams.map((team) =>
          team._id === tempId || team.id === tempId ? response.data : team
        )
      );
      setMyTeams((prevTeams) =>
        prevTeams.map((team) =>
          team._id === tempId || team.id === tempId ? response.data : team
        )
      );

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to create team");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Update team
  const updateTeam = async (
    id: string,
    teamData: {
      name?: string;
      description?: string;
      teamType?: "technical" | "support";
    }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      // Find the team in the current state
      const teamToUpdate = teams.find(
        (team) => team._id === id || team.id === id
      );

      if (teamToUpdate) {
        // Create an optimistically updated version
        const optimisticTeam = {
          ...teamToUpdate,
          ...teamData,
          updatedAt: new Date().toISOString(),
        };

        // Optimistically update UI immediately
        setTeams((prevTeams) =>
          prevTeams.map((team) =>
            team._id === id || team.id === id ? optimisticTeam : team
          )
        );

        setMyTeams((prevTeams) =>
          prevTeams.map((team) =>
            team._id === id || team.id === id ? optimisticTeam : team
          )
        );

        // Update current team if it's the one being updated
        if (currentTeam && (currentTeam._id === id || currentTeam.id === id)) {
          setCurrentTeam(optimisticTeam);
        }
      }

      // Make the API call
      const response = await teamApi.updateTeam(id, teamData);

      // Update with the real data
      setTeams((prevTeams) =>
        prevTeams.map((team) =>
          team._id === id || team.id === id ? response.data : team
        )
      );

      setMyTeams((prevTeams) =>
        prevTeams.map((team) =>
          team._id === id || team.id === id ? response.data : team
        )
      );

      // Update current team if it's the one being updated
      if (currentTeam && (currentTeam._id === id || currentTeam.id === id)) {
        setCurrentTeam(response.data);
      }

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to update team");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete team
  const deleteTeam = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Optimistically update UI immediately before API call
      // Update teams list - handle different ID formats
      setTeams((prevTeams) =>
        prevTeams.filter((team) => {
          // Check both _id and id properties
          const teamId = team._id || team.id;
          return teamId !== id;
        })
      );

      setMyTeams((prevTeams) =>
        prevTeams.filter((team) => {
          // Check both _id and id properties
          const teamId = team._id || team.id;
          return teamId !== id;
        })
      );

      // Clear current team if it's the one being deleted
      if (currentTeam && currentTeam._id === id) {
        setCurrentTeam(null);
      }

      // Now make the API call
      await teamApi.deleteTeam(id);

      return true;
    } catch (err: any) {
      setError(err.message || "Failed to delete team");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Add team member
  const addTeamMember = async (
    teamId: string,
    memberData: { userId: string; role?: "lead" | "member" }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await teamApi.addTeamMember(teamId, memberData);

      // Update teams list
      setTeams((prevTeams) =>
        prevTeams.map((team) => (team._id === teamId ? response.data : team))
      );

      setMyTeams((prevTeams) =>
        prevTeams.map((team) => (team._id === teamId ? response.data : team))
      );

      // Update current team if it's the one being updated
      if (currentTeam && currentTeam._id === teamId) {
        setCurrentTeam(response.data);
      }

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to add team member");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Remove team member
  const removeTeamMember = async (teamId: string, memberId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await teamApi.removeTeamMember(teamId, memberId);

      // Update teams list
      setTeams((prevTeams) =>
        prevTeams.map((team) => (team._id === teamId ? response.data : team))
      );

      setMyTeams((prevTeams) =>
        prevTeams.map((team) => (team._id === teamId ? response.data : team))
      );

      // Update current team if it's the one being updated
      if (currentTeam && currentTeam._id === teamId) {
        setCurrentTeam(response.data);
      }

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to remove team member");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Change team lead
  const changeTeamLead = async (teamId: string, newLeadId: string) => {
    try {
      // Ensure both IDs are strings
      const teamIdStr = String(teamId);
      const newLeadIdStr = String(newLeadId);

      setIsLoading(true);
      setError(null);

      console.log("Changing team lead:", {
        teamId: teamIdStr,
        newLeadId: newLeadIdStr,
      });
      const response = await teamApi.changeTeamLead(teamIdStr, newLeadIdStr);

      // Update teams list
      setTeams((prevTeams) =>
        prevTeams.map((team) =>
          team._id === teamIdStr || team.id === teamIdStr ? response.data : team
        )
      );

      setMyTeams((prevTeams) =>
        prevTeams.map((team) =>
          team._id === teamIdStr || team.id === teamIdStr ? response.data : team
        )
      );

      // Update current team if it's the one being updated
      if (
        currentTeam &&
        (currentTeam._id === teamIdStr || currentTeam.id === teamIdStr)
      ) {
        setCurrentTeam(response.data);
      }

      return response.data;
    } catch (err: any) {
      console.error("Error in changeTeamLead:", err);
      setError(err.message || "Failed to change team lead");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Create invitation
  const createInvitation = async (
    teamId: string,
    invitationData: { email: string; role?: "lead" | "member" }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await teamApi.createInvitation(teamId, invitationData);

      // Update invitations list
      setTeamInvitations((prevInvitations) => [
        ...prevInvitations,
        response.data,
      ]);

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to create invitation");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch team invitations
  const fetchTeamInvitations = async (teamId: string, page = 1, limit = 10) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await teamApi.getTeamInvitations(teamId, page, limit);
      setTeamInvitations(response.data);

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to fetch team invitations");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch my invitations
  const fetchMyInvitations = async () => {
    // Check if we're rate limited for this endpoint
    if (isRateLimitedRef.current.myInvitations) {
      return [];
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await invitationApi.getMyInvitations();
      setMyInvitations(response.data);

      return response.data;
    } catch (err: any) {
      // Handle rate limiting (429 status code)
      if (err.response?.status === 429) {
        // Get retry-after header or default to 5 seconds
        const retryAfter =
          parseInt(err.response.headers["retry-after"], 10) * 1000 || 5000;
        handleRateLimiting("myInvitations", retryAfter);
      } else {
        setError(err.message || "Failed to fetch my invitations");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Verify invitation
  const verifyInvitation = async (code: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await invitationApi.verifyInvitation(code);
      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to verify invitation");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Accept invitation
  const acceptInvitation = async (code: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await invitationApi.acceptInvitation(code);

      // Update my teams list
      await fetchMyTeams();

      // Update my invitations list
      await fetchMyInvitations();

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Revoke invitation
  const revokeInvitation = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await invitationApi.revokeInvitation(id);

      // Update invitations list
      setTeamInvitations((prevInvitations) =>
        prevInvitations.filter((invitation) => invitation._id !== id)
      );

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to revoke invitation");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Resend invitation
  const resendInvitation = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await invitationApi.resendInvitation(id);

      // Update invitations list
      setTeamInvitations((prevInvitations) =>
        prevInvitations.map((invitation) =>
          invitation._id === id ? response.data : invitation
        )
      );

      return response.data;
    } catch (err: any) {
      setError(err.message || "Failed to resend invitation");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Create debounced versions of fetch functions with longer delays and no immediate execution
  // Use longer debounce times to reduce API calls
  const debouncedFetchTeams = useCallback(
    debounce((page = 1, limit = 10) => fetchTeams(page, limit), 5000), // 5 seconds
    [fetchTeams]
  );

  const debouncedFetchMyTeams = useCallback(
    debounce(() => fetchMyTeams(), 6000), // 6 seconds
    [fetchMyTeams]
  );

  const debouncedFetchMyInvitations = useCallback(
    debounce(() => fetchMyInvitations(), 7000), // 7 seconds
    [fetchMyInvitations]
  );

  // Create throttled versions for initial load (with immediate execution)
  // Use longer throttle times to reduce API calls
  const throttledFetchTeams = useCallback(
    debounce(
      () =>
        fetchTeams({
          page: 1,
          limit: 10,
          search: "",
          teamTypes: [],
          onlyMyTeams: false,
          fromDate: "",
          toDate: "",
          sortBy: "name",
          sortOrder: "asc",
        }),
      10000, // 10 seconds
      {
        immediate: true,
      }
    ),
    [fetchTeams]
  );

  const throttledFetchMyTeams = useCallback(
    debounce(() => fetchMyTeams(), 12000, { immediate: true }), // 12 seconds
    [fetchMyTeams]
  );

  const throttledFetchMyInvitations = useCallback(
    debounce(() => fetchMyInvitations(), 15000, { immediate: true }), // 15 seconds
    [fetchMyInvitations]
  );

  // Track if this is the first render
  const isFirstRender = useRef(true);

  // Load user's teams ONLY on first mount
  // Data will only be refreshed in these scenarios:
  // 1. On initial page load (here)
  // 2. When user clicks the refresh button
  // 3. After team operations (create, edit, delete, etc.)
  useEffect(() => {
    if (!user) return;

    // Only fetch on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      console.log("TeamContext: First render - fetching teams data");

      // We don't need to fetch teams here since the TeamManagementPage
      // will handle that. We only need to fetch invitations.
      setTimeout(() => {
        if (user) throttledFetchMyInvitations();
      }, 3000); // Delay to avoid concurrent requests
    }
  }, [user, throttledFetchMyInvitations]);

  const value = {
    // Teams
    teams,
    myTeams,
    currentTeam,
    isLoading,
    error,

    // Team operations
    fetchTeams: isFirstRender.current
      ? throttledFetchTeams
      : debouncedFetchTeams,
    fetchMyTeams: isFirstRender.current
      ? throttledFetchMyTeams
      : debouncedFetchMyTeams,
    fetchTeamById,
    createTeam,
    updateTeam,
    deleteTeam,

    // Team membership
    addTeamMember,
    removeTeamMember,
    changeTeamLead,

    // Invitations
    teamInvitations,
    myInvitations,
    createInvitation,
    fetchTeamInvitations,
    fetchMyInvitations: isFirstRender.current
      ? throttledFetchMyInvitations
      : debouncedFetchMyInvitations,
    verifyInvitation,
    acceptInvitation,
    revokeInvitation,
    resendInvitation,

    // Set current team
    setCurrentTeam,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
};

export default TeamContext;
