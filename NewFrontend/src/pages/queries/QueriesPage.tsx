import React, { useState, Fragment, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaTicketAlt,
  FaFilter,
  FaSearch,
  FaSort,
  FaEllipsisH,
  FaExclamationCircle,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaQuestion,
  FaArrowRight,
  FaPlus,
  FaSync,
} from "react-icons/fa";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";
import { Dialog, Transition } from "@headlessui/react";
import {
  FaTimes,
  FaUser,
  FaHistory,
  FaComment,
  FaPaperclip,
  FaEdit,
  FaCheck,
  FaUserPlus,
  FaCircle,
} from "react-icons/fa";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  useGetQueriesQuery,
  useGetMyQueriesQuery,
  useGetMyAssignedQueriesQuery,
  useGetQueryByIdQuery,
} from "@/features/tickets/api/queryApi";
import { querySocket } from "@/features/tickets/api/querySocket";
import appPrimusClient from "@/services/primus/appPrimusClient";
import CreateQueryForm from "@/features/tickets/components/CreateQueryForm";
import EditQueryForm from "@/features/tickets/components/EditQueryForm";
import ConvertToTicketForm from "@/features/tickets/components/ConvertToTicketForm";

// Enhanced interfaces based on SRS requirements
interface Attachment {
  id: string;
  filename: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  attachments?: Attachment[];
  isInternal?: boolean; // For internal team communication
}

interface AuditLogEntry {
  id: string;
  action: string; // e.g., "status_changed", "assigned", "commented"
  performedBy: string;
  timestamp: string;
  details: Record<string, any>;
}

// Query interface
interface Query {
  _id: string;
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  subcategory?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    email: string;
  };
  assignedTo?: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    email: string;
  };
  customer: {
    userId: {
      _id: string;
      profile: {
        firstName: string;
        lastName: string;
      };
      email: string;
    };
  };
  comments?: Array<{
    _id: string;
    author: {
      _id: string;
      profile: {
        firstName: string;
        lastName: string;
      };
      email: string;
    };
    text: string;
    createdAt: string;
    isInternal: boolean;
  }>;
  attachments?: Array<{
    filename: string;
    path: string;
    mimetype: string;
    size: number;
    uploadedAt: string;
  }>;
  convertedToTicket?: {
    ticketId: string;
    convertedAt: string;
    convertedBy: {
      _id: string;
      profile: {
        firstName: string;
        lastName: string;
      };
      email: string;
    };
  };
}

interface QueriesPageProps {
  view?: "all" | "my-queries" | "create" | "detail";
}

// Move these helper functions outside the component
// Helper function to get status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case "new":
      return (
        <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          New
        </span>
      );
    case "assigned":
      return (
        <span className="bg-purple-500/20 text-purple-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Assigned
        </span>
      );
    case "in-progress":
    case "in_progress": // Handle both formats
      return (
        <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          In Progress
        </span>
      );
    case "resolved":
      return (
        <span className="bg-green-500/20 text-green-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Resolved
        </span>
      );
    case "closed":
      return (
        <span className="bg-gray-500/20 text-gray-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Closed
        </span>
      );
    case "converted":
      return (
        <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Converted to Ticket
        </span>
      );
    default:
      return (
        <span className="bg-gray-500/20 text-gray-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          {status}
        </span>
      );
  }
};

// Helper function to get priority badge
const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case "low":
      return (
        <span className="bg-green-500/20 text-green-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Low
        </span>
      );
    case "medium":
      return (
        <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Medium
        </span>
      );
    case "high":
      return (
        <span className="bg-orange-500/20 text-orange-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          High
        </span>
      );
    case "critical":
      return (
        <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Critical
        </span>
      );
    default:
      return (
        <span className="bg-gray-500/20 text-gray-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          {priority}
        </span>
      );
  }
};

// Format date to readable format
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const QueriesPage: React.FC<QueriesPageProps> = ({
  view: initialView = "all",
}) => {
  const { id: queryId } = useParams<{ id: string }>();
  const location = useLocation();
  const [currentView, setCurrentView] = useState<string>(initialView);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "convert">("details");

  const { user } = useAuth();
  const isCustomer = user?.role === "customer";
  const isSupport = user?.role === "support";

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Check if user is a team lead for a support team
  const isTeamLeadSupport =
    user?.role === "team_lead" && user?.teamType === "support";

  // Fetch queries from API - use different endpoint based on user role
  const {
    data: queriesData,
    isLoading: isLoadingQueries,
    error: queriesError,
    refetch: refetchQueries,
  } = isCustomer
    ? useGetMyQueriesQuery({
        page,
        limit,
      })
    : isSupport
    ? useGetMyAssignedQueriesQuery({
        page,
        limit,
      })
    : currentView === "team" && isTeamLeadSupport
    ? useGetTeamQueriesQuery({
        filters: {
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          priority: selectedPriority !== "all" ? selectedPriority : undefined,
          search: searchQuery || undefined,
        },
        page,
        limit,
      })
    : useGetQueriesQuery({
        filters: {
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          priority: selectedPriority !== "all" ? selectedPriority : undefined,
          search: searchQuery || undefined,
        },
        page,
        limit,
      });

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Fetch query details if in detail view
  const { data: queryDetail, isLoading: isLoadingDetail } =
    useGetQueryByIdQuery(queryId || "", {
      skip: !queryId || currentView !== "detail",
    });

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    // Subscribe to query updates if viewing a specific query
    if (queryId && currentView === "detail") {
      querySocket.subscribeToQuery(queryId);

      // Clean up subscription when component unmounts or query changes
      return () => {
        querySocket.unsubscribeFromQuery(queryId);
      };
    }
  }, [queryId, currentView]);

  // Check for refresh flag in location state
  useEffect(() => {
    // If we have a refresh flag in the location state, refetch queries
    if (location.state && location.state.refresh) {
      refetchQueries();
      // Clear the state to prevent repeated refreshes
      window.history.replaceState({}, document.title);
    }
  }, [location.state, refetchQueries]);

  // Map API data to UI format
  const getQueries = () => {
    if (!queriesData || !queriesData.data) {
      return [];
    }

    return queriesData.data.map((query) => ({
      ...query,
      id: query._id, // Map _id to id for backward compatibility
    }));
  };

  // Open query detail modal
  const openQueryModal = (query: Query) => {
    setSelectedQuery(query);
    // Always set activeTab to details for customers
    if (isCustomer) {
      setActiveTab("details");
    }
    setIsModalOpen(true);
  };

  // Close query detail modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedQuery(null);
    setActiveTab("details");
  };

  // Handle query expansion in list view
  const toggleQueryExpansion = (queryId: string) => {
    if (expandedQueryId === queryId) {
      setExpandedQueryId(null);
    } else {
      setExpandedQueryId(queryId);
    }
  };

  // Render queries list
  const renderQueriesList = () => {
    const queries = getQueries();

    // Customize title based on user role
    const listTitle = isCustomer
      ? "My Queries"
      : currentView === "all"
      ? "All Queries"
      : "My Assigned Queries";

    if (isLoadingQueries) {
      return (
        <div className="flex justify-center items-center py-20">
          <FaSpinner className="animate-spin text-blue-500 text-4xl" />
        </div>
      );
    }

    if (queriesError) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <FaExclamationCircle className="text-red-500 text-4xl mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">
            Error Loading Queries
          </h3>
          <p className="text-gray-400">
            There was an error loading the queries. Please try again.
          </p>
        </div>
      );
    }

    if (!queries.length) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <FaQuestion className="text-gray-500 text-4xl mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">
            No Queries Found
          </h3>
          <p className="text-gray-400">
            {searchQuery ||
            selectedStatus !== "all" ||
            selectedPriority !== "all"
              ? "No queries match your current filters. Try adjusting your search criteria."
              : "There are no queries in the system yet."}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-700">
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                ID
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Title
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Priority
              </th>
              {!isCustomer && (
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
              )}
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Created
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="py-3 px-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {queries.map((query) => (
              <React.Fragment key={query.id}>
                <tr
                  className={`border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${
                    expandedQueryId === query.id ? "bg-gray-800/30" : ""
                  }`}
                  onClick={() => toggleQueryExpansion(query.id)}
                >
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FaQuestion className="text-blue-500 mr-2" />
                      <span className="text-gray-300 font-mono text-sm">
                        {query.id ? query.id.substring(0, 8) : "N/A"}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-white font-medium">{query.title}</div>
                    <div className="text-gray-400 text-sm truncate max-w-xs">
                      {query.category}
                      {query.subcategory ? ` / ${query.subcategory}` : ""}
                    </div>
                  </td>
                  <td className="py-4 px-4">{getStatusBadge(query.status)}</td>
                  <td className="py-4 px-4">
                    {getPriorityBadge(query.priority)}
                  </td>
                  {!isCustomer && (
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-gray-700 rounded-full flex items-center justify-center">
                          <FaUser className="text-gray-400" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-white">
                            {query.customer?.userId?.profile?.firstName ||
                              "Unknown"}{" "}
                            {query.customer?.userId?.profile?.lastName || ""}
                          </div>
                          <div className="text-sm text-gray-400">
                            {query.customer?.userId?.email || "No email"}
                          </div>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-300">
                    {formatDate(query.createdAt)}
                  </td>
                  <td className="py-4 px-4">
                    {query.assignedTo ? (
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-gray-700 rounded-full flex items-center justify-center">
                          <FaUser className="text-gray-400" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-white">
                            {query.assignedTo.profile?.firstName || "Unknown"}{" "}
                            {query.assignedTo.profile?.lastName || ""}
                          </div>
                          <div className="text-sm text-gray-400">
                            {query.assignedTo.email || "No email"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">Unassigned</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openQueryModal(query);
                      }}
                      className="text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      <FaEllipsisH />
                    </button>
                  </td>
                </tr>
                {expandedQueryId === query.id && (
                  <tr className="bg-gray-800/20">
                    <td colSpan={isCustomer ? 7 : 8} className="py-4 px-6">
                      <div className="text-gray-300 mb-3">
                        <span className="font-medium">Description:</span>{" "}
                        {query.description}
                      </div>
                      <div className="flex space-x-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openQueryModal(query);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center text-sm"
                        >
                          <FaEdit className="mr-1.5" /> View Details
                        </button>
                        {query.status !== "converted" && !isCustomer && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuery(query);
                              setActiveTab("convert");
                              setIsModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors flex items-center text-sm"
                          >
                            <FaArrowRight className="mr-1.5" /> Convert to
                            Ticket
                          </button>
                        )}
                        {query.convertedToTicket && (
                          <div className="flex items-center text-indigo-400 text-sm">
                            <FaTicketAlt className="mr-1.5" /> Converted to
                            Ticket:{" "}
                            <span className="font-mono ml-1">
                              {query.convertedToTicket.ticketId
                                ? query.convertedToTicket.ticketId.substring(
                                    0,
                                    8
                                  )
                                : "N/A"}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render pagination controls
  const renderPagination = () => {
    if (!queriesData || !queriesData.pagination) {
      return null;
    }

    const { page: currentPage, pages: totalPages } = queriesData.pagination;

    return (
      <div className="flex justify-between items-center mt-4 px-4 py-3 bg-gray-800/30 rounded-lg">
        <div className="text-sm text-gray-400">
          Showing page {currentPage} of {totalPages}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <TopNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 p-4">
          <div className="container mx-auto">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {currentView === "all" &&
                    (isCustomer ? "My Queries" : "All Queries")}
                  {currentView === "my-queries" && "My Queries"}
                  {currentView === "team" && "Team Queries"}
                  {currentView === "create" && "Create Query"}
                  {currentView === "detail" && "Query Details"}
                </h1>
                <p className="mt-1 text-gray-400">
                  {currentView === "all" &&
                    isCustomer &&
                    "View and manage your support queries"}
                  {currentView === "all" &&
                    !isCustomer &&
                    "View and manage all customer queries"}
                  {currentView === "my-queries" &&
                    isCustomer &&
                    "View and manage your support queries"}
                  {currentView === "my-queries" &&
                    !isCustomer &&
                    "View and manage queries assigned to you"}
                  {currentView === "team" &&
                    "View and manage queries assigned to your team members"}
                  {currentView === "create" &&
                    isCustomer &&
                    "Submit a new support query"}
                  {currentView === "create" &&
                    !isCustomer &&
                    "Create a new customer query"}
                  {currentView === "detail" && "View and manage query details"}
                </p>
              </div>

              <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-3">
                {(currentView === "all" || currentView === "my-queries") && (
                  <>
                    <button
                      onClick={() => refetchQueries()}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center"
                      disabled={isLoadingQueries}
                    >
                      <FaSync
                        className={`mr-2 ${
                          isLoadingQueries ? "animate-spin" : ""
                        }`}
                      />{" "}
                      Refresh
                    </button>
                    <button
                      onClick={() => setCurrentView("create")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center"
                    >
                      <FaPlus className="mr-2" /> Create Query
                    </button>
                  </>
                )}

                {currentView === "create" && (
                  <button
                    onClick={() => setCurrentView("all")}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            {(currentView === "all" || currentView === "my-queries") && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  {!isCustomer ? (
                    <>
                      <div className="flex-1">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search queries..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-40">
                          <div className="relative">
                            <select
                              value={selectedStatus}
                              onChange={(e) =>
                                setSelectedStatus(e.target.value)
                              }
                              className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 pl-10 pr-4 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                              <option value="all">All Status</option>
                              <option value="new">New</option>
                              <option value="assigned">Assigned</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                              <option value="converted">Converted</option>
                            </select>
                            <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          </div>
                        </div>

                        <div className="w-40">
                          <div className="relative">
                            <select
                              value={selectedPriority}
                              onChange={(e) =>
                                setSelectedPriority(e.target.value)
                              }
                              className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 pl-10 pr-4 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                              <option value="all">All Priority</option>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                            <FaSort className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between w-full">
                      <div className="flex-1">
                        <div className="relative">
                          <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 pl-10 pr-4 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <option value="all">All Status</option>
                            <option value="new">New</option>
                            <option value="under_review">Under Review</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                            <option value="converted">
                              Converted to Ticket
                            </option>
                          </select>
                          <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>
                      <div className="flex-1 flex justify-end">
                        <button
                          onClick={() => setCurrentView("create")}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center"
                        >
                          <FaPlus className="mr-2" /> Submit New Query
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main content */}
            <div className="bg-gray-800/30 rounded-lg shadow-lg overflow-hidden">
              {/* All queries view */}
              {(currentView === "all" || currentView === "my-queries") && (
                <div>
                  <div className="px-6 py-4 border-b border-gray-700/70">
                    <h2 className="text-lg font-semibold text-white">
                      {currentView === "all" ? "All Queries" : "My Queries"}
                    </h2>
                  </div>
                  <div>
                    {renderQueriesList()}
                    {renderPagination()}
                  </div>
                </div>
              )}

              {/* Create query view */}
              {currentView === "create" && (
                <div>
                  <div className="px-6 py-4 border-b border-gray-700/70">
                    <h3 className="text-lg font-semibold text-white">
                      Create New Query
                    </h3>
                  </div>
                  <div className="p-6">
                    <CreateQueryForm
                      onSuccess={() => {
                        setCurrentView("all");
                        // Force a refetch of the queries list
                        refetchQueries();
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <Footer />

      {/* Query Detail Modal */}
      {selectedQuery && (
        <Transition appear show={isModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={closeModal}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/75" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-xl bg-gray-800 shadow-xl transition-all">
                    <div className="border-b border-gray-700">
                      <div className="flex justify-between items-center px-6 py-4">
                        <Dialog.Title className="text-xl font-semibold text-white flex items-center gap-2">
                          <FaQuestion className="text-blue-400" />
                          <span>Query Details</span>
                        </Dialog.Title>
                        <button
                          onClick={closeModal}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <FaTimes size={20} />
                        </button>
                      </div>
                    </div>

                    <div className="p-6 max-h-[80vh] overflow-y-auto">
                      {/* Query Status */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-medium text-white">
                            Status: {getStatusBadge(selectedQuery.status)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-400">
                            Created: {formatDate(selectedQuery.createdAt)}
                          </div>
                        </div>
                      </div>

                      {/* Tabs */}
                      <div className="border-b border-gray-700 mb-6">
                        <nav
                          className="-mb-px flex space-x-8"
                          aria-label="Tabs"
                        >
                          <button
                            onClick={() => setActiveTab("details")}
                            className={`${
                              activeTab === "details"
                                ? "border-blue-500 text-blue-400"
                                : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                          >
                            Details
                          </button>
                          {selectedQuery.status !== "converted" &&
                            !isCustomer && (
                              <button
                                onClick={() => setActiveTab("convert")}
                                className={`${
                                  activeTab === "convert"
                                    ? "border-blue-500 text-blue-400"
                                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
                                } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                              >
                                Convert to Ticket
                              </button>
                            )}
                        </nav>
                      </div>

                      {/* Query Edit Form */}
                      {activeTab === "details" || isCustomer ? (
                        <EditQueryForm
                          query={selectedQuery}
                          onSuccess={closeModal}
                        />
                      ) : (
                        <ConvertToTicketForm
                          query={selectedQuery}
                          onSuccess={closeModal}
                          onCancel={() => setActiveTab("details")}
                        />
                      )}
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}
    </div>
  );
};

export default QueriesPage;
