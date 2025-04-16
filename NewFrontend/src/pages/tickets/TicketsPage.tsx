import React, { useState, Fragment, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import CreateTicketForm from "@/features/tickets/components/CreateTicketForm";
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
  FaArrowRight,
  FaPlus,
  FaExchangeAlt,
  FaPause,
  FaPlay,
} from "react-icons/fa";
import { useAuth } from "../../features/auth/hooks/useAuth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { Tooltip } from "@/components/ui/tooltip";
import ActivityMindMap from "@/components/tickets/ActivityMindMap";
import { FaChartLine, FaUserClock } from "react-icons/fa";
import {
  useGetTicketsQuery,
  useGetTicketStatisticsQuery,
  useGetTicketByIdQuery,
  useGetTicketAuditLogQuery,
  useAddCommentMutation,
  useUpdateTicketMutation,
  useAssignTicketMutation,
  useAssignTicketToTeamMutation,
  useGetMyCreatedTicketsQuery,
  GroupedActivityResponse,
} from "@/features/tickets/api/ticketApi";
import {
  useGetSLAPoliciesQuery,
  useApplyPolicyToTicketMutation,
  usePauseSLAMutation,
  useResumeSLAMutation,
  SLAPolicy,
} from "@/api/slaApiRTK";
import { ticketSocket } from "@/features/tickets/api/ticketSocket";
import SLAPolicySelector from "@/components/SLAPolicySelector";
import { toast } from "react-hot-toast";
import { MoreHorizontal, Edit, Eye, UserPlus, RefreshCw } from "lucide-react";

// Enhanced interfaces based on SRS requirements
interface Attachment {
  _id?: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
  uploadedBy?:
    | string
    | {
        _id: string;
        profile?: {
          firstName?: string;
          lastName?: string;
        };
      };
}

interface Comment {
  _id?: string;
  author:
    | string
    | {
        _id: string;
        profile?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
        fullName?: string; // Added for backend compatibility
        role?: string; // Added for role display
      };
  text: string;
  createdAt: string;
  attachments?: Attachment[];
  isInternal?: boolean; // For internal team communication
  visibleToTeams?: Array<
    | string
    | {
        _id: string;
        name?: string;
      }
  >;
}

interface AuditLogEntry {
  _id?: string;
  action: string; // e.g., "status_changed", "assigned", "commented"
  performedBy:
    | string
    | {
        _id: string;
        profile?: {
          firstName?: string;
          lastName?: string;
        };
      };
  timestamp: string;
  details?: Record<string, any>;
}

interface SLA {
  policyId?: string;
  responseDeadline?: string;
  resolutionDeadline?: string;
  pausedAt?: string;
  pauseReason?: string;
  totalPausedTime?: number;
  breached?: {
    response: boolean;
    resolution: boolean;
  };
  percentageComplete?: number; // Calculated field for UI
}

// Interface for frontend ticket that maps to backend structure
interface Ticket {
  id: string; // Maps to _id from backend
  _id?: string; // Original MongoDB ID
  ticketNumber?: string;
  title: string;
  description: string;
  status: string; // Backend: "new", "assigned", "in_progress", "on_hold", "pending_customer", "resolved", "closed"
  priority: string; // "low", "medium", "high", "critical"
  category: string;
  subcategory?: string;
  createdAt: string;
  updatedAt: string;
  source?: string; // How the ticket was created
  originalQuery?: string; // If converted from a query

  // User who created the ticket
  createdBy:
    | string
    | {
        _id: string;
        profile?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
        fullName?: string;
        id?: string;
      };

  // Technical team member assigned
  assignedTo?:
    | string
    | {
        _id: string;
        profile?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
        fullName?: string;
        id?: string;
      };

  // Primary team responsible
  primaryTeam?:
    | string
    | {
        teamId:
          | string
          | {
              _id: string;
              name: string;
              teamType: string;
            };
        assignedAt: string;
        assignedBy?:
          | string
          | {
              _id: string;
              profile?: {
                firstName?: string;
                lastName?: string;
              };
            };
      };

  // Supporting teams
  supportingTeams?: Array<{
    teamId:
      | string
      | {
          _id: string;
          name: string;
          teamType: string;
        };
    role?: string;
    assignedAt: string;
    assignedBy?:
      | string
      | {
          _id: string;
        };
    status?: string;
  }>;

  // Legacy field for backward compatibility
  assignedTeam?: string;

  // Customer information
  customer?: {
    userId?:
      | string
      | {
          _id: string;
          profile?: {
            firstName?: string;
            lastName?: string;
          };
          email?: string;
        };
    email?: string;
    name?: string;
    contactNumber?: string;
  };

  // Status history
  statusHistory?: Array<{
    status: string;
    changedBy:
      | string
      | {
          _id: string;
          profile?: {
            firstName?: string;
            lastName?: string;
          };
        };
    timestamp: string;
    reason?: string;
  }>;

  // For sub-tickets
  parentTicketId?: string;

  // Comments
  comments?: Comment[];

  // Attachments
  attachments?: Attachment[];

  // Audit log
  auditLog?: AuditLogEntry[];

  // SLA information
  sla?: SLA;

  // Additional data
  tags?: string[];
  customFields?: Record<string, any>;
}

interface TicketAnalytics {
  avgResponseTime: string;
  avgResolutionTime: string;
  similarTicketsCount: number;
  recurrenceRate: string;
  escalationRate: string;
  firstContactResolution: string;
}

interface TicketsPageProps {
  view?: "all" | "my-tickets" | "create";
}

// Move these helper functions outside the component
// Helper function to get status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case "open":
    case "new": // Backend status
      return (
        <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Open
        </span>
      );
    case "in-progress":
    case "in_progress": // Handle both formats
    case "assigned": // Backend status
      return (
        <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          In Progress
        </span>
      );
    case "on_hold":
    case "on-hold":
    case "pending_customer":
    case "pending-customer":
      return (
        <span className="bg-orange-500/20 text-orange-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          On Hold
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
    default:
      // Format the status string for display (capitalize, replace underscores)
      const formattedStatus = status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      return (
        <span className="bg-gray-500/20 text-gray-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          {formattedStatus}
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

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case "open":
    case "new": // Backend status
      return "bg-blue-500/20 text-blue-400";
    case "in-progress":
    case "in_progress": // Handle both formats
    case "assigned": // Backend status
      return "bg-yellow-500/20 text-yellow-400";
    case "on_hold":
    case "on-hold":
    case "pending_customer":
    case "pending-customer":
      return "bg-orange-500/20 text-orange-400";
    case "resolved":
      return "bg-green-500/20 text-green-400";
    case "closed":
      return "bg-gray-500/20 text-gray-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
};

// Helper function to calculate elapsed percentage for SLA
const calculateElapsedPercentage = (startDate: string, endDate: string) => {
  try {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = new Date().getTime();

    if (now >= end) return 100;
    if (now <= start) return 0;

    const total = end - start;
    const elapsed = now - start;
    return Math.round((elapsed / total) * 100);
  } catch (error) {
    console.error("Error calculating elapsed percentage:", error);
    return 0;
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

const getTicketAnalytics = (ticket: Ticket): TicketAnalytics => {
  try {
    // Validate ticket object
    if (!ticket) {
      return {
        avgResponseTime: "N/A",
        avgResolutionTime: "N/A",
        similarTicketsCount: 0,
        recurrenceRate: "N/A",
        escalationRate: "N/A",
        firstContactResolution: "N/A",
      };
    }

    // Calculate analytics based on ticket data
    let analytics = {
      avgResponseTime: "N/A",
      avgResolutionTime: "N/A",
      similarTicketsCount: 0,
      recurrenceRate: "N/A",
      escalationRate: "N/A",
      firstContactResolution: "N/A",
    };

    // If we have audit log data, calculate response times
    if (
      ticket.auditLog &&
      Array.isArray(ticket.auditLog) &&
      ticket.auditLog.length > 0
    ) {
      // Find ticket creation time
      const creationEntry = ticket.auditLog.find(
        (entry) => entry.action === "created"
      );
      const creationTime = creationEntry
        ? new Date(creationEntry.timestamp)
        : new Date(ticket.createdAt);

      // Find first response time
      const firstResponseEntry = ticket.auditLog.find(
        (entry) =>
          entry.action === "commented" &&
          typeof entry.performedBy === "object" &&
          entry.performedBy._id !==
            (typeof ticket.createdBy === "object"
              ? ticket.createdBy._id
              : ticket.createdBy)
      );

      if (firstResponseEntry) {
        const responseTime = new Date(firstResponseEntry.timestamp);
        const diffMs = responseTime.getTime() - creationTime.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        analytics.avgResponseTime = `${diffHrs}h ${diffMins}m`;
      }

      // Calculate resolution time if ticket is resolved
      if (ticket.status === "resolved" || ticket.status === "closed") {
        const resolutionEntry = ticket.auditLog.find(
          (entry) =>
            entry.action === "status_changed" &&
            (entry.details?.newStatus === "resolved" ||
              entry.details?.newStatus === "closed")
        );

        if (resolutionEntry) {
          const resolutionTime = new Date(resolutionEntry.timestamp);
          const diffMs = resolutionTime.getTime() - creationTime.getTime();
          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMins = Math.floor(
            (diffMs % (1000 * 60 * 60)) / (1000 * 60)
          );
          analytics.avgResolutionTime = `${diffHrs}h ${diffMins}m`;
        }
      }

      // Calculate escalation rate
      const escalationEntries = ticket.auditLog.filter(
        (entry) =>
          entry.action === "escalated" ||
          (entry.action === "status_changed" &&
            entry.details?.reason?.toLowerCase().includes("escalat"))
      );

      if (escalationEntries.length > 0) {
        analytics.escalationRate = "Yes";
      } else {
        analytics.escalationRate = "No";
      }

      // First contact resolution
      if (ticket.status === "resolved" || ticket.status === "closed") {
        const commentEntries = ticket.auditLog.filter(
          (entry) => entry.action === "commented"
        );
        if (commentEntries.length <= 2) {
          // Only creator comment and one response
          analytics.firstContactResolution = "Yes";
        } else {
          analytics.firstContactResolution = "No";
        }
      }
    }

    // For similar tickets count and recurrence rate, we would need API data
    // For now, use placeholder values
    analytics.similarTicketsCount = Math.floor(Math.random() * 20);
    analytics.recurrenceRate = `${Math.floor(Math.random() * 30)}%`;

    return analytics;
  } catch (error) {
    console.error("Error calculating ticket analytics:", error);
    return {
      avgResponseTime: "N/A",
      avgResolutionTime: "N/A",
      similarTicketsCount: 0,
      recurrenceRate: "N/A",
      escalationRate: "N/A",
      firstContactResolution: "N/A",
    };
  }
};

const TicketAnalyticsModal = ({
  isOpen,
  closeModal,
  ticket,
}: {
  isOpen: boolean;
  closeModal: () => void;
  ticket: Ticket;
}) => {
  const analytics = getTicketAnalytics(ticket);

  return (
    <Transition appear show={isOpen} as={Fragment}>
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
                      <FaChartLine className="text-blue-400" />
                      <span>Ticket Analytics</span>
                    </Dialog.Title>
                    <button
                      onClick={closeModal}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <FaTimes size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
                  {/* Analytics cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-700/30 rounded-lg p-5 border border-gray-600/50">
                      <div className="flex items-center gap-3 mb-3">
                        <FaUserClock className="text-blue-400" size={20} />
                        <h4 className="font-medium text-white">
                          Response Times
                        </h4>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-400">
                            Average First Response
                          </p>
                          <p className="text-xl font-semibold text-white">
                            {analytics.avgResponseTime}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">
                            Average Resolution Time
                          </p>
                          <p className="text-xl font-semibold text-white">
                            {analytics.avgResolutionTime}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-700/30 rounded-lg p-5 border border-gray-600/50">
                      <div className="flex items-center gap-3 mb-3">
                        <FaHistory className="text-purple-400" size={20} />
                        <h4 className="font-medium text-white">
                          Historical Patterns
                        </h4>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-400">
                            Similar Tickets
                          </p>
                          <p className="text-xl font-semibold text-white">
                            {analytics.similarTicketsCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">
                            Recurrence Rate
                          </p>
                          <p className="text-xl font-semibold text-white">
                            {analytics.recurrenceRate}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-700/30 rounded-lg p-5 border border-gray-600/50">
                      <div className="flex items-center gap-3 mb-3">
                        <FaExclamationCircle
                          className="text-amber-400"
                          size={20}
                        />
                        <h4 className="font-medium text-white">
                          Performance Metrics
                        </h4>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-400">
                            Escalation Rate
                          </p>
                          <p className="text-xl font-semibold text-white">
                            {analytics.escalationRate}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">
                            First Contact Resolution
                          </p>
                          <p className="text-xl font-semibold text-white">
                            {analytics.firstContactResolution}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trend analysis */}
                  <div className="bg-gray-700/30 rounded-lg p-5 border border-gray-600/50">
                    <h4 className="font-medium text-white mb-4">
                      Trend Analysis
                    </h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { month: "Jan", tickets: 8 },
                            { month: "Feb", tickets: 12 },
                            { month: "Mar", tickets: 7 },
                            { month: "Apr", tickets: 14 },
                            { month: "May", tickets: 10 },
                            { month: "Jun", tickets: 13 },
                          ]}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis dataKey="month" stroke="#9ca3af" />
                          <YAxis stroke="#9ca3af" />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: "#374151",
                              borderColor: "#4b5563",
                              color: "#e5e7eb",
                            }}
                          />
                          <Bar
                            dataKey="tickets"
                            fill="#3b82f6"
                            name="Similar Tickets"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      Historical pattern of similar infrastructure tickets over
                      the last 6 months
                    </p>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-gray-700/30 rounded-lg p-5 border border-gray-600/50">
                    <div className="flex items-center gap-3 mb-3">
                      <FaChartLine className="text-green-400" size={20} />
                      <h4 className="font-medium text-white">
                        AI-Powered Recommendations
                      </h4>
                    </div>
                    <ul className="space-y-2 text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-1">•</span>
                        <span>
                          Consider checking server load balancing configuration
                          based on similar past issues
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-1">•</span>
                        <span>
                          Review recent network infrastructure changes that may
                          have impacted connectivity
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-1">•</span>
                        <span>
                          Escalate to Network Operations team if not resolved
                          within 24 hours
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

const TicketsPage: React.FC<TicketsPageProps> = ({
  view: initialView = "all",
}) => {
  const [currentView, setCurrentView] = useState<
    "all" | "my-tickets" | "create"
  >(initialView);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isSLAPolicySelectorOpen, setIsSLAPolicySelectorOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { user } = useAuth();
  const isSupport = user?.role === "support";

  // Fetch tickets from API - use different endpoint for support agents
  const {
    data: ticketsData,
    isLoading,
    error,
    refetch,
  } = isSupport
    ? useGetMyCreatedTicketsQuery({
        page,
        limit,
      })
    : useGetTicketsQuery({
        filters: {
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          priority: selectedPriority !== "all" ? selectedPriority : undefined,
          search: searchQuery || undefined,
        },
        page,
        limit,
      });

  // Set up Primus event listeners for real-time updates
  useEffect(() => {
    // Set up event listeners for ticket events
    const ticketCreatedCleanup = ticketSocket.onTicketEvent(
      "ticket:created",
      (data) => {
        console.log("Ticket created event received:", data);
        toast.success(`New ticket created: ${data.ticket.title || "Untitled"}`);
        refetch(); // Refresh the tickets list
      }
    );

    const ticketUpdatedCleanup = ticketSocket.onTicketEvent(
      "ticket:updated",
      (data) => {
        console.log("Ticket updated event received:", data);
        toast.success(`Ticket updated: ${data.ticket.title || "Untitled"}`);
        refetch(); // Refresh the tickets list
      }
    );

    const ticketCommentAddedCleanup = ticketSocket.onTicketEvent(
      "ticket:comment_added",
      (data) => {
        console.log("Ticket comment added event received:", data);
        toast.success(
          `New comment on ticket: ${data.ticket.title || "Untitled"}`
        );
        refetch(); // Refresh the tickets list
      }
    );

    const ticketAssignedCleanup = ticketSocket.onTicketEvent(
      "ticket:assigned",
      (data) => {
        console.log("Ticket assigned event received:", data);
        toast.success(`Ticket assigned: ${data.ticket.title || "Untitled"}`);
        refetch(); // Refresh the tickets list
      }
    );

    const ticketStatusChangedCleanup = ticketSocket.onTicketEvent(
      "ticket:status_changed",
      (data) => {
        console.log("Ticket status changed event received:", data);
        toast.success(
          `Ticket status changed: ${data.ticket.title || "Untitled"}`
        );
        refetch(); // Refresh the tickets list
      }
    );

    // Clean up event listeners when component unmounts
    return () => {
      ticketCreatedCleanup();
      ticketUpdatedCleanup();
      ticketCommentAddedCleanup();
      ticketAssignedCleanup();
      ticketStatusChangedCleanup();
    };
  }, [refetch]);

  // Fetch ticket statistics
  const { data: statisticsData } = useGetTicketStatisticsQuery();

  // We already have WebSocket listeners set up above, no need for duplicates

  // Add this function to handle opening the analytics modal
  const openAnalyticsModal = () => {
    setIsAnalyticsModalOpen(true);
  };

  // Add this function to handle closing the analytics modal
  const closeAnalyticsModal = () => {
    setIsAnalyticsModalOpen(false);
  };

  // Map API data to the format expected by the UI
  const tickets: Ticket[] = ticketsData?.data
    ? ticketsData.data.map((apiTicket) => ({
        // Map _id to id for compatibility
        id: apiTicket._id,
        _id: apiTicket._id,
        ticketNumber: apiTicket.ticketNumber,
        title: apiTicket.title,
        description: apiTicket.description,
        status: apiTicket.status,
        priority: apiTicket.priority,
        category: apiTicket.category,
        subcategory: apiTicket.subcategory,
        createdAt: apiTicket.createdAt,
        updatedAt: apiTicket.updatedAt,
        createdBy: apiTicket.createdBy,
        assignedTo: apiTicket.assignedTo,
        primaryTeam: apiTicket.primaryTeam,
        supportingTeams: apiTicket.supportingTeams,
        customer: apiTicket.customer,
        comments: apiTicket.comments,
        attachments: apiTicket.attachments,
        sla: apiTicket.sla,
        tags: apiTicket.tags,
        customFields: apiTicket.customFields,
        // Add any additional fields needed for UI compatibility
      }))
    : [];

  // Filter tickets based on search query and filters
  const filteredTickets = tickets.filter((ticket) => {
    // Search in title, ID, ticket number, and description
    const matchesSearch = searchQuery
      ? ticket.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ticket.ticketNumber &&
          ticket.ticketNumber
            .toLowerCase()
            .includes(searchQuery.toLowerCase())) ||
        ticket.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    // Status matching with backend status values
    const matchesStatus =
      selectedStatus === "all" || ticket.status === selectedStatus;

    // Priority matching
    const matchesPriority =
      selectedPriority === "all" || ticket.priority === selectedPriority;

    // For "my-tickets" view, only show tickets assigned to current user
    const matchesView =
      currentView === "all" ||
      (currentView === "my-tickets" &&
        (typeof ticket.assignedTo === "object"
          ? ticket.assignedTo?._id === user?.id
          : ticket.assignedTo === user?.id));

    return matchesSearch && matchesStatus && matchesPriority && matchesView;
  });

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

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  const openTicketDetail = (ticket: Ticket) => {
    console.log("Opening ticket:", ticket.id); // Add this for debugging
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  // Action handlers for ticket dropdown menu
  const handleEditTicket = (ticket: Ticket) => {
    // Implement edit ticket functionality
    console.log("Edit ticket:", ticket);
    toast.success("Edit ticket functionality will be implemented soon");
  };

  const handleAssignTicket = (ticket: Ticket) => {
    // Implement assign ticket functionality
    console.log("Assign ticket:", ticket);
    toast.success("Assign ticket functionality will be implemented soon");
  };

  const handleChangeStatus = (ticket: Ticket) => {
    // Implement change status functionality
    console.log("Change status for ticket:", ticket);
    toast.success("Change status functionality will be implemented soon");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedTicket(null), 200);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          userRole={user?.role}
        />

        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FaTicketAlt className="text-blue-500" />
                    {currentView === "all"
                      ? "All Tickets"
                      : currentView === "my-tickets"
                      ? "My Tickets"
                      : "Create Ticket"}
                  </h1>
                  <p className="text-gray-400 mt-1">
                    Manage and track support requests
                  </p>
                </div>

                <div className="flex gap-3">
                  {currentView !== "create" && (
                    <>
                      <button
                        onClick={() => setCurrentView("create")}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <FaTicketAlt /> Create New Ticket
                      </button>
                      <button
                        onClick={openAnalyticsModal}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <FaChartLine /> Analytics Dashboard
                      </button>
                    </>
                  )}
                </div>
              </div>

              {currentView === "create" ? (
                <motion.div
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70">
                    <h3 className="text-lg font-semibold text-white">
                      Create New Ticket
                    </h3>
                  </div>
                  <div className="p-6">
                    <CreateTicketForm
                      onSuccess={() => {
                        setCurrentView("all");
                        // Force a refetch of the tickets list
                        refetch();
                        toast.success("Ticket created successfully");
                      }}
                    />
                  </div>
                </motion.div>
              ) : (
                <>
                  <motion.div
                    className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="p-4 flex flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search tickets..."
                            className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <select
                          className="bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                          <option value="all">All Status</option>
                          <option value="new">New</option>
                          <option value="assigned">Assigned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="on_hold">On Hold</option>
                          <option value="pending_customer">
                            Pending Customer
                          </option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>

                        <select
                          className="bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          value={selectedPriority}
                          onChange={(e) => setSelectedPriority(e.target.value)}
                        >
                          <option value="all">All Priority</option>
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>

                        <button className="bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white hover:bg-gray-600/50 transition-colors flex items-center">
                          <FaFilter className="mr-2" /> More Filters
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              <div className="flex items-center">
                                ID <FaSort className="ml-1" />
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              <div className="flex items-center">
                                Title <FaSort className="ml-1" />
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              <div className="flex items-center">
                                Status <FaSort className="ml-1" />
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              <div className="flex items-center">
                                Priority <FaSort className="ml-1" />
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              <div className="flex items-center">
                                Assigned To <FaSort className="ml-1" />
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              <div className="flex items-center">
                                Created <FaSort className="ml-1" />
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              <div className="flex items-center">
                                Updated <FaSort className="ml-1" />
                              </div>
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {filteredTickets.length > 0 ? (
                            filteredTickets.map((ticket, index) => (
                              <React.Fragment key={ticket.id}>
                                <motion.tr
                                  className={`hover:bg-gray-700/50 transition-colors cursor-pointer`}
                                  variants={itemVariants}
                                  onClick={() => openTicketDetail(ticket)}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                    <div className="flex items-center">
                                      <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs mr-2">
                                        {ticket.ticketNumber || ticket.id}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-300">
                                    {ticket.title}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {getStatusBadge(ticket.status)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {getPriorityBadge(ticket.priority)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {typeof ticket.assignedTo === "object"
                                      ? ticket.assignedTo?.profile?.firstName &&
                                        ticket.assignedTo?.profile?.lastName
                                        ? `${ticket.assignedTo.profile.firstName} ${ticket.assignedTo.profile.lastName}`
                                        : ticket.assignedTo?.email || "-"
                                      : ticket.assignedTo || "-"}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {formatDate(ticket.createdAt)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {formatDate(ticket.updatedAt)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right ticket-actions">
                                    <button
                                      className="text-gray-400 hover:text-white transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openTicketDetail(ticket);
                                      }}
                                    >
                                      <FaEllipsisH />
                                    </button>
                                  </td>
                                </motion.tr>

                                {/* Expanded ticket details */}
                                {expandedTicketId === ticket.id && (
                                  <motion.tr
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <td
                                      colSpan={8}
                                      className="bg-gray-800/50 border-t border-b border-gray-700/50"
                                    >
                                      <div className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                          <div>
                                            <h3 className="text-lg font-medium mb-2">
                                              {ticket.title}
                                            </h3>
                                            <p className="text-gray-300 mb-3">
                                              {ticket.description}
                                            </p>

                                            <div className="flex flex-wrap gap-2 mt-2">
                                              {ticket.assignedTo && (
                                                <div className="bg-gray-700/50 px-3 py-1 rounded-full text-xs">
                                                  Assigned to:{" "}
                                                  {typeof ticket.assignedTo ===
                                                  "object"
                                                    ? ticket.assignedTo?.profile
                                                        ?.firstName &&
                                                      ticket.assignedTo?.profile
                                                        ?.lastName
                                                      ? `${ticket.assignedTo.profile.firstName} ${ticket.assignedTo.profile.lastName}`
                                                      : ticket.assignedTo
                                                          ?.email || "Unknown"
                                                    : ticket.assignedTo}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                              <span className="text-gray-400">
                                                Created:
                                              </span>
                                              <span>
                                                {formatDate(ticket.createdAt)}
                                              </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                              <span className="text-gray-400">
                                                Last Updated:
                                              </span>
                                              <span>
                                                {formatDate(ticket.updatedAt)}
                                              </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                              <span className="text-gray-400">
                                                Status:
                                              </span>
                                              <span>
                                                {getStatusBadge(ticket.status)}
                                              </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                              <span className="text-gray-400">
                                                Priority:
                                              </span>
                                              <span>
                                                {getPriorityBadge(
                                                  ticket.priority
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex justify-end gap-2 mt-4">
                                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                                            Edit Ticket
                                          </button>
                                          <button className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm">
                                            Add Comment
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </motion.tr>
                                )}
                              </React.Fragment>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-6 py-4 text-center text-gray-400"
                              >
                                No tickets found matching your criteria
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-6 py-4 flex items-center justify-between border-t border-gray-700">
                      <div className="text-sm text-gray-400">
                        {isLoading
                          ? "Loading tickets..."
                          : error
                          ? "Error loading tickets"
                          : `Showing ${filteredTickets.length} of ${
                              ticketsData?.pagination?.total || tickets.length
                            } tickets`}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1 bg-gray-700/50 border border-gray-600/50 rounded text-gray-300 hover:bg-gray-600/50 transition-colors"
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page <= 1 || isLoading}
                        >
                          Previous
                        </button>
                        {ticketsData?.pagination &&
                          Array.from(
                            {
                              length: Math.min(
                                5,
                                ticketsData.pagination.pages || 1
                              ),
                            },
                            (_, i) => (
                              <button
                                key={i + 1}
                                className={`px-3 py-1 ${
                                  page === i + 1
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-gray-700/50 border border-gray-600/50 text-gray-300 hover:bg-gray-600/50"
                                } rounded transition-colors`}
                                onClick={() => setPage(i + 1)}
                                disabled={isLoading}
                              >
                                {i + 1}
                              </button>
                            )
                          )}
                        <button
                          className="px-3 py-1 bg-gray-700/50 border border-gray-600/50 rounded text-gray-300 hover:bg-gray-600/50 transition-colors"
                          onClick={() => setPage(page + 1)}
                          disabled={
                            !ticketsData?.pagination ||
                            page >= (ticketsData.pagination.pages || 1) ||
                            isLoading
                          }
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <Footer />
      {/* Enhanced Ticket Detail Modal */}
      <TicketDetailModal
        isOpen={isModalOpen}
        closeModal={closeModal}
        ticket={selectedTicket}
      />
    </div>
  );
};

const ActivityTimeline = ({ activities }) => {
  // Sample activities data structure
  // In production, this would come from your ticket's audit log
  const timelineData = activities || [
    {
      id: 1,
      status: "created",
      title: "Ticket Created",
      date: "2023-10-15T10:30:00Z",
      completed: true,
    },
    {
      id: 2,
      status: "assigned",
      title: "Assigned to Team",
      date: "2023-10-15T11:45:00Z",
      completed: true,
    },
    {
      id: 3,
      status: "in_progress",
      title: "Investigation Started",
      date: "2023-10-16T09:15:00Z",
      completed: true,
    },
    {
      id: 4,
      status: "solution_proposed",
      title: "Solution Proposed",
      date: "2023-10-17T14:30:00Z",
      completed: false,
    },
    {
      id: 5,
      status: "resolved",
      title: "Issue Resolved",
      date: null,
      completed: false,
    },
    {
      id: 6,
      status: "closed",
      title: "Ticket Closed",
      date: null,
      completed: false,
    },
  ];

  return (
    <div className="mt-4 px-2">
      <h3 className="text-lg font-semibold mb-4">Ticket Journey</h3>
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700 z-0"></div>

        {/* Timeline items */}
        {timelineData.map((item, index) => (
          <div key={item.id} className="relative z-10 mb-6 flex items-start">
            <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center">
              {item.completed ? (
                <FaCheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <FaCircle className="h-8 w-8 text-gray-600" />
              )}
            </div>
            <div className="ml-4 flex-grow">
              <div className="font-medium">{item.title}</div>
              {item.date && (
                <div className="text-sm text-gray-400">
                  {formatDate(item.date)}
                </div>
              )}
              {!item.date && !item.completed && (
                <div className="text-sm text-gray-500">Pending</div>
              )}
            </div>
            {index < timelineData.length - 1 && item.completed && (
              <div className="absolute left-4 top-8 h-6 flex items-center justify-center">
                <FaArrowRight className="text-gray-500 transform rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add node button */}
      <button className="mt-2 flex items-center text-blue-400 hover:text-blue-300 text-sm">
        <FaCircle className="mr-2" /> Add custom milestone
      </button>
    </div>
  );
};

const TicketDetailModal = ({
  isOpen,
  closeModal,
  ticket,
}: {
  isOpen: boolean;
  closeModal: () => void;
  ticket: Ticket | null;
}) => {
  const [activeTab, setActiveTab] = useState("details");
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedSLAPolicy, setSelectedSLAPolicy] = useState<string>("");
  const [showSLAForm, setShowSLAForm] = useState(false);
  const [pauseReason, setPauseReason] = useState<string>("");
  const [showPauseForm, setShowPauseForm] = useState(false);
  const [isSLAPolicySelectorOpen, setIsSLAPolicySelectorOpen] = useState(false);

  // Import the mutations and queries
  const [addComment] = useAddCommentMutation();
  const [updateTicket] = useUpdateTicketMutation();

  // Get ticket data with refetch capability
  const { refetch } = useGetTicketByIdQuery(ticket?._id || ticket?.id || "", {
    skip: !ticket?._id && !ticket?.id, // Skip if no ticket ID
    refetchOnMountOrArgChange: true,
  });

  // Get ticket audit log data
  const { data: groupedActivities, isLoading: isLoadingActivities } =
    useGetTicketAuditLogQuery(ticket?._id || ticket?.id || "", {
      skip: !ticket?._id && !ticket?.id,
    });

  // Get SLA policies
  const { data: slaPolicies, isLoading: isLoadingSLAPolicies } =
    useGetSLAPoliciesQuery();

  // SLA mutations
  const [applyPolicy, { isLoading: isApplyingSLA }] =
    useApplyPolicyToTicketMutation();
  const [pauseSLA, { isLoading: isPausingSLA }] = usePauseSLAMutation();
  const [resumeSLA, { isLoading: isResumingSLA }] = useResumeSLAMutation();

  const [assignTicket] = useAssignTicketMutation();

  // Handle adding a comment
  const handleAddComment = async () => {
    if (!ticket) return;

    // Validate comment text
    const trimmedText = commentText.trim();
    if (!trimmedText) {
      toast.error("Comment text cannot be empty");
      return;
    }

    setIsAddingComment(true);
    try {
      console.log("Comment text before sending:", {
        rawText: commentText,
        trimmedText,
        length: trimmedText.length,
        isInternal: isInternalComment,
      });

      // Use direct fetch approach since it's working reliably
      const ticketId = ticket._id || ticket.id;
      const commentData = {
        text: trimmedText,
        isInternal: isInternalComment,
      };

      console.log("Sending comment data:", JSON.stringify(commentData));

      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commentData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error adding comment:", errorText);
        throw new Error(`Failed to add comment: ${errorText}`);
      }

      // Parse the response as JSON
      try {
        const responseText = await response.text();
        const responseData = JSON.parse(responseText);
        console.log("Comment added successfully, response:", responseData);
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        // Continue anyway since we know the request succeeded
      }

      // Reset form
      setCommentText("");
      setIsInternalComment(false);
      setShowCommentForm(false);
      toast.success("Comment added successfully");

      // Subscribe to ticket updates if not already subscribed
      ticketSocket.subscribeToTicket(ticketId);

      // Refetch ticket to get updated comments
      refetch();

      // Reset form
      setCommentText("");
      setIsInternalComment(false);
      setShowCommentForm(false);
      toast.success("Comment added successfully");

      // Subscribe to ticket updates if not already subscribed
      ticketSocket.subscribeToTicket(ticket._id || ticket.id);

      // Refetch ticket to get updated comments
      refetch();
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment. Please try again.");
    } finally {
      setIsAddingComment(false);
    }
  };

  // Initialize selected status when ticket changes
  useEffect(() => {
    if (ticket) {
      setSelectedStatus(ticket.status);
    }
  }, [ticket]);

  // Fetch users when assign form is opened
  useEffect(() => {
    if (showAssignForm) {
      fetchUsers();
    }
  }, [showAssignForm]);

  // Handle status change
  const handleStatusChange = async () => {
    if (!ticket || selectedStatus === ticket.status) {
      setShowStatusForm(false);
      return;
    }

    // Validate status is one of the allowed values
    const validStatuses = [
      "new",
      "assigned",
      "in_progress",
      "on_hold",
      "pending_customer",
      "resolved",
      "closed",
    ];
    if (!validStatuses.includes(selectedStatus)) {
      toast.error(`Invalid status: ${selectedStatus}`);
      return;
    }

    setIsChangingStatus(true);
    try {
      await updateTicket({
        id: ticket._id || ticket.id,
        data: {
          status: selectedStatus as
            | "new"
            | "assigned"
            | "in_progress"
            | "on_hold"
            | "pending_customer"
            | "resolved"
            | "closed",
        },
      }).unwrap();

      // Reset form
      setShowStatusForm(false);
      toast.success(`Ticket status updated to ${selectedStatus}`);

      // Subscribe to ticket updates if not already subscribed
      ticketSocket.subscribeToTicket(ticket._id || ticket.id);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      toast.error("Failed to update ticket status. Please try again.");
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Fetch users for assignment
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // This would normally be an API call to get users
      // For now, we'll use a mock implementation
      const response = await fetch("/api/users?role=team_member,team_lead");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users. Please try again.");
      // Mock data for demonstration
      setUsers([
        {
          _id: "user1",
          email: "john.doe@example.com",
          profile: { firstName: "John", lastName: "Doe" },
        },
        {
          _id: "user2",
          email: "jane.smith@example.com",
          profile: { firstName: "Jane", lastName: "Smith" },
        },
        {
          _id: "user3",
          email: "mike.tech@example.com",
          profile: { firstName: "Mike", lastName: "Tech" },
        },
      ]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Handle assign ticket
  const handleAssignTicket = async () => {
    if (!ticket || !selectedAssignee) {
      setShowAssignForm(false);
      return;
    }

    setIsAssigning(true);
    try {
      await assignTicket({
        id: ticket._id || ticket.id,
        data: { assigneeId: selectedAssignee },
      }).unwrap();

      // Reset form
      setShowAssignForm(false);
      setSelectedAssignee("");
      toast.success("Ticket assigned successfully");

      // Subscribe to ticket updates if not already subscribed
      ticketSocket.subscribeToTicket(ticket._id || ticket.id);
    } catch (error) {
      console.error("Error assigning ticket:", error);
      toast.error("Failed to assign ticket. Please try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle applying SLA policy
  const handleApplySLAPolicy = async () => {
    if (!ticket || !selectedSLAPolicy) {
      setShowSLAForm(false);
      return;
    }

    try {
      await applyPolicy({
        ticketId: ticket._id || ticket.id,
        data: { policyId: selectedSLAPolicy },
      }).unwrap();

      // Reset form
      setShowSLAForm(false);
      setSelectedSLAPolicy("");
      toast.success("SLA policy applied successfully");

      // Refetch ticket data
      refetch();
    } catch (error) {
      console.error("Error applying SLA policy:", error);
      toast.error("Failed to apply SLA policy. Please try again.");
    }
  };

  // Handle pausing SLA
  const handlePauseSLA = async () => {
    if (!ticket || !pauseReason) {
      setShowPauseForm(false);
      return;
    }

    try {
      await pauseSLA({
        ticketId: ticket._id || ticket.id,
        data: { reason: pauseReason },
      }).unwrap();

      // Reset form
      setShowPauseForm(false);
      setPauseReason("");
      toast.success("SLA paused successfully");

      // Refetch ticket data
      refetch();
    } catch (error) {
      console.error("Error pausing SLA:", error);
      toast.error("Failed to pause SLA. Please try again.");
    }
  };

  // Handle resuming SLA
  const handleResumeSLA = async () => {
    if (!ticket) return;

    try {
      await resumeSLA(ticket._id || ticket.id).unwrap();
      toast.success("SLA resumed successfully");

      // Refetch ticket data
      refetch();
    } catch (error) {
      console.error("Error resuming SLA:", error);
      toast.error("Failed to resume SLA. Please try again.");
    }
  };

  // Handle updating ticket status - alias for handleStatusChange
  const handleUpdateStatus = handleStatusChange;

  // Calculate SLA percentage complete
  const calculateSLAPercentage = (ticket: Ticket) => {
    try {
      if (!ticket?.sla?.resolutionDeadline) return 0;

      const now = new Date();
      const created = new Date(ticket.createdAt);
      const deadline = new Date(ticket.sla.resolutionDeadline);

      // If deadline has passed, return 100%
      if (now > deadline) return 100;

      // Calculate percentage based on time elapsed
      const totalTime = deadline.getTime() - created.getTime();
      const elapsedTime = now.getTime() - created.getTime();

      return Math.min(Math.round((elapsedTime / totalTime) * 100), 100);
    } catch (error) {
      console.error("Error calculating SLA percentage:", error);
      return 0;
    }
  };

  // Subscribe to ticket updates when the modal is opened
  useEffect(() => {
    if (isOpen && ticket) {
      // Subscribe to ticket updates
      ticketSocket.subscribeToTicket(ticket._id || ticket.id);

      // Set up event listeners for real-time updates
      const handleTicketUpdated = () => {
        // Refetch the ticket data
        refetch();
        toast.success("Ticket updated");
      };

      const handleCommentAdded = () => {
        // Refetch the ticket data
        refetch();
        toast.success("New comment added");
      };

      const handleStatusChanged = () => {
        // Refetch the ticket data
        refetch();
        toast.success("Ticket status changed");
      };

      const handleTicketAssigned = () => {
        // Refetch the ticket data
        refetch();
        toast.success("Ticket assigned");
      };

      // Register event listeners
      const unsubscribeUpdated = ticketSocket.onTicketEvent(
        "ticket:updated",
        handleTicketUpdated
      );
      const unsubscribeCommentAdded = ticketSocket.onTicketEvent(
        "ticket:comment_added",
        handleCommentAdded
      );
      const unsubscribeStatusChanged = ticketSocket.onTicketEvent(
        "ticket:status_changed",
        handleStatusChanged
      );
      const unsubscribeAssigned = ticketSocket.onTicketEvent(
        "ticket:assigned",
        handleTicketAssigned
      );

      // Return cleanup function to unsubscribe when modal is closed
      return () => {
        ticketSocket.unsubscribeFromTicket(ticket._id || ticket.id);
        unsubscribeUpdated();
        unsubscribeCommentAdded();
        unsubscribeStatusChanged();
        unsubscribeAssigned();
      };
    }
  }, [isOpen, ticket]);

  // Early return if ticket is null
  if (!ticket) {
    console.log("Ticket is null in TicketDetailModal");
    return null;
  }

  // Ensure ticket has required properties
  const ticketId = ticket._id || ticket.id || "";
  const ticketPriority = ticket.priority || "medium";

  // Generate activity data from ticket history
  const generateActivityData = (ticket: Ticket) => {
    try {
      // Get the last 7 days
      const days = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        days.push({
          date,
          name: date.toLocaleDateString("en-US", { weekday: "short" }),
          comments: 0,
          updates: 0,
        });
      }

      // Count status changes from statusHistory
      if (ticket.statusHistory && Array.isArray(ticket.statusHistory)) {
        ticket.statusHistory.forEach((status) => {
          if (!status.timestamp) return;

          const statusDate = new Date(status.timestamp);
          const dayIndex = days.findIndex(
            (day) =>
              day.date.getDate() === statusDate.getDate() &&
              day.date.getMonth() === statusDate.getMonth() &&
              day.date.getFullYear() === statusDate.getFullYear()
          );

          if (dayIndex !== -1) {
            days[dayIndex].updates++;
          }
        });
      }

      // Count comments
      if (ticket.comments && Array.isArray(ticket.comments)) {
        ticket.comments.forEach((comment) => {
          if (!comment.createdAt) return;

          const commentDate = new Date(comment.createdAt);
          const dayIndex = days.findIndex(
            (day) =>
              day.date.getDate() === commentDate.getDate() &&
              day.date.getMonth() === commentDate.getMonth() &&
              day.date.getFullYear() === commentDate.getFullYear()
          );

          if (dayIndex !== -1) {
            days[dayIndex].comments++;
          }
        });
      }

      // Count audit log entries
      if (ticket.auditLog && Array.isArray(ticket.auditLog)) {
        ticket.auditLog.forEach((entry) => {
          if (!entry.timestamp) return;

          const entryDate = new Date(entry.timestamp);
          const dayIndex = days.findIndex(
            (day) =>
              day.date.getDate() === entryDate.getDate() &&
              day.date.getMonth() === entryDate.getMonth() &&
              day.date.getFullYear() === entryDate.getFullYear()
          );

          if (dayIndex !== -1) {
            if (entry.action === "commented") {
              days[dayIndex].comments++;
            } else if (
              entry.action === "status_changed" ||
              entry.action === "updated" ||
              entry.action === "assigned"
            ) {
              days[dayIndex].updates++;
            }
          }
        });
      }

      return days;
    } catch (error) {
      console.error("Error generating activity data:", error);
      // Return default data if there's an error
      return [
        { name: "Mon", comments: 0, updates: 0 },
        { name: "Tue", comments: 0, updates: 0 },
        { name: "Wed", comments: 0, updates: 0 },
        { name: "Thu", comments: 0, updates: 0 },
        { name: "Fri", comments: 0, updates: 0 },
        { name: "Sat", comments: 0, updates: 0 },
        { name: "Sun", comments: 0, updates: 0 },
      ];
    }
  };

  // Generate activity data from the ticket
  const activityData = ticket ? generateActivityData(ticket) : [];

  // Sample data for response time pie chart
  const responseTimeData = [
    { name: "Within SLA", value: 75 },
    { name: "Outside SLA", value: 25 },
  ];

  const COLORS = ["#4ade80", "#f87171"];

  // Generate activities from ticket audit log if available
  const ticketActivities = ticket.auditLog
    ? ticket.auditLog.map((log, index) => ({
        id: index,
        status: log.action,
        title: log.action
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        date: log.timestamp,
        completed: true,
      }))
    : null;

  // Convert audit log entries to activity events for the ActivityMindMap component
  const getTicketActivityEvents = (ticket: Ticket) => {
    try {
      // Validate ticket and auditLog
      if (!ticket) {
        console.log("No ticket provided to getTicketActivityEvents");
        return [];
      }

      // If no auditLog exists, use statusHistory as a fallback
      let activitySource = [];

      if (
        ticket.auditLog &&
        Array.isArray(ticket.auditLog) &&
        ticket.auditLog.length > 0
      ) {
        activitySource = ticket.auditLog;
      } else if (
        ticket.statusHistory &&
        Array.isArray(ticket.statusHistory) &&
        ticket.statusHistory.length > 0
      ) {
        // Convert statusHistory to audit log format
        activitySource = ticket.statusHistory.map((status) => ({
          action: "status_changed",
          performedBy: status.changedBy,
          timestamp: status.timestamp,
          details: {
            oldStatus: "previous",
            newStatus: status.status,
            reason: status.reason,
          },
        }));
      } else if (
        ticket.comments &&
        Array.isArray(ticket.comments) &&
        ticket.comments.length > 0
      ) {
        // Convert comments to audit log format
        activitySource = ticket.comments.map((comment) => ({
          action: "commented",
          performedBy: comment.author,
          timestamp: comment.createdAt,
          details: {
            comment: comment.text,
            isInternal: comment.isInternal,
          },
        }));
      } else {
        // Create a minimal audit log with ticket creation
        activitySource = [
          {
            action: "created",
            performedBy: ticket.createdBy,
            timestamp: ticket.createdAt,
            details: {
              title: ticket.title,
            },
          },
        ];
      }

      // Filter out any undefined or invalid entries
      return activitySource
        .filter((entry) => entry && typeof entry === "object")
        .map((entry, index) => {
          // Determine the event type based on the action
          let type:
            | "status_change"
            | "assignment"
            | "comment"
            | "sla_update"
            | "edit" = "edit";

          if (!entry.action) {
            type = "edit";
          } else if (
            entry.action === "status_changed" ||
            entry.action.includes("status")
          ) {
            type = "status_change";
          } else if (
            entry.action === "assigned" ||
            entry.action.includes("assign")
          ) {
            type = "assignment";
          } else if (
            entry.action === "commented" ||
            entry.action.includes("comment")
          ) {
            type = "comment";
          } else if (
            typeof entry.action === "string" &&
            entry.action.includes("sla")
          ) {
            type = "sla_update";
          }

          // Extract user information with robust fallbacks
          let userName = "Unknown";
          let userId = "unknown";

          if (typeof entry.performedBy === "object" && entry.performedBy) {
            // Try to get user name from profile
            if (
              entry.performedBy.profile?.firstName &&
              entry.performedBy.profile?.lastName
            ) {
              userName = `${entry.performedBy.profile.firstName} ${entry.performedBy.profile.lastName}`;
            } else if (entry.performedBy.fullName) {
              userName = entry.performedBy.fullName;
            } else if (entry.performedBy.email) {
              userName = entry.performedBy.email;
            }

            // Get user ID
            userId = entry.performedBy._id || entry.performedBy.id || "unknown";
          } else if (typeof entry.performedBy === "string") {
            userId = entry.performedBy;
            // Try to find user info if we have the ID
            if (
              ticket.createdBy &&
              ((typeof ticket.createdBy === "object" &&
                ticket.createdBy._id === entry.performedBy) ||
                ticket.createdBy === entry.performedBy)
            ) {
              if (typeof ticket.createdBy === "object") {
                if (
                  ticket.createdBy.profile?.firstName &&
                  ticket.createdBy.profile?.lastName
                ) {
                  userName = `${ticket.createdBy.profile.firstName} ${ticket.createdBy.profile.lastName}`;
                } else if (ticket.createdBy.email) {
                  userName = ticket.createdBy.email;
                }
              }
            }
          }

          // Format action title with proper capitalization
          let actionTitle = "Activity";
          if (entry.action) {
            if (entry.action === "status_changed") {
              actionTitle = "Status Changed";
            } else if (entry.action === "assigned") {
              actionTitle = "Ticket Assigned";
            } else if (entry.action === "commented") {
              actionTitle = "Added Comment";
            } else if (entry.action === "created") {
              actionTitle = "Ticket Created";
            } else if (typeof entry.action === "string") {
              actionTitle = entry.action
                .split("_")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
            }
          }

          // Create description with fallbacks
          let description = "";
          if (entry.details?.comment) {
            description = entry.details.comment;
          } else if (entry.action === "status_changed") {
            description = `Changed from ${
              entry.details?.oldStatus || "previous status"
            } to ${
              entry.details?.newStatus || entry.details?.status || "new status"
            }`;

            if (entry.details?.reason) {
              description += ` (${entry.details.reason})`;
            }
          } else if (entry.action === "assigned") {
            description = `Assigned to ${
              entry.details?.assigneeName ||
              (entry.details?.newAssignee &&
              typeof entry.details.newAssignee === "object"
                ? entry.details.newAssignee.email || "team member"
                : entry.details?.newAssignee || "team member")
            }`;
          } else if (entry.action === "created") {
            description = `Ticket created with title: ${ticket.title}`;
          }

          // Create the activity event with robust defaults
          return {
            id: entry._id || `act-${index}`,
            type,
            timestamp: entry.timestamp || new Date().toISOString(),
            user: {
              id: userId,
              name: userName,
            },
            details: {
              title: actionTitle,
              description: description,
              from: entry.details?.oldStatus || entry.details?.from,
              to:
                entry.details?.newStatus ||
                entry.details?.status ||
                entry.details?.to,
            },
          };
        })
        .sort((a, b) => {
          // Handle potential undefined values
          if (!a || !b) return 0;
          if (!a.timestamp) return 1; // Push entries without timestamp to the end
          if (!b.timestamp) return -1;

          try {
            return (
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          } catch (error) {
            console.error("Error sorting by timestamp:", error);
            return 0; // Keep original order if there's an error
          }
        }); // Sort by timestamp, newest first
    } catch (error) {
      console.error("Error processing ticket activity:", error);
      return []; // Return empty array in case of any error
    }
  };

  // Use the existing audit log data from above
  // No need to fetch it again

  // Use the ticket object to get activity events as a fallback
  let activityEvents = [];
  try {
    activityEvents = getTicketActivityEvents(ticket);
  } catch (error) {
    console.error("Error getting ticket activity events:", error);
    // Use empty array as fallback
  }

  // Get ticket analytics with error handling
  let ticketAnalytics = {
    avgResponseTime: "N/A",
    avgResolutionTime: "N/A",
    similarTicketsCount: 0,
    recurrenceRate: "N/A",
    escalationRate: "N/A",
    firstContactResolution: "N/A",
  };
  try {
    ticketAnalytics = getTicketAnalytics(ticket);
  } catch (error) {
    console.error("Error getting ticket analytics:", error);
    // Use default values as fallback
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
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
                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-xl bg-gray-800 shadow-xl transition-all">
                  {/* Header with tabs */}
                  <div className="border-b border-gray-700">
                    <div className="flex justify-between items-center px-6 py-4">
                      <Dialog.Title className="text-xl font-semibold text-white flex items-center gap-2">
                        <FaTicketAlt className="text-blue-400" />
                        <span className="flex items-center gap-2">
                          <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-sm">
                            {ticket.ticketNumber || ticket.id}
                          </span>
                          {ticket.title}
                        </span>
                      </Dialog.Title>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAnalyticsModalOpen(true)}
                          className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                        >
                          <FaChartLine size={16} />
                          <span>Analytics</span>
                        </button>
                        <button
                          onClick={closeModal}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <FaTimes size={20} />
                        </button>
                      </div>
                    </div>

                    <div className="flex px-6">
                      <button
                        className={`px-4 py-2 border-b-2 ${
                          activeTab === "details"
                            ? "border-blue-500 text-blue-400"
                            : "border-transparent text-gray-400 hover:text-white"
                        } font-medium transition-colors`}
                        onClick={() => setActiveTab("details")}
                      >
                        Overview
                      </button>
                      <button
                        className={`px-4 py-2 border-b-2 ${
                          activeTab === "activity"
                            ? "border-blue-500 text-blue-400"
                            : "border-transparent text-gray-400 hover:text-white"
                        } font-medium transition-colors`}
                        onClick={() => setActiveTab("activity")}
                      >
                        Activity
                      </button>
                      <button
                        className={`px-4 py-2 border-b-2 ${
                          activeTab === "sla"
                            ? "border-blue-500 text-blue-400"
                            : "border-transparent text-gray-400 hover:text-white"
                        } font-medium transition-colors`}
                        onClick={() => setActiveTab("sla")}
                      >
                        SLA Metrics
                      </button>
                    </div>
                  </div>

                  {/* Main content with more spacing */}
                  <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {/* Title and description */}
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-white mb-4">
                        {ticket.title}
                      </h2>
                      <div className="bg-gray-700/30 rounded-lg p-5">
                        <p className="text-gray-200 leading-relaxed">
                          {ticket.description}
                        </p>
                      </div>
                    </div>

                    {/* Status cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      <div className="bg-gray-700/30 rounded-lg p-5 flex items-center justify-between">
                        <div>
                          <h3 className="text-gray-400 text-sm">Status</h3>
                          <div className="mt-1 flex items-center gap-2">
                            {getStatusBadge(ticket.status)}
                            <button
                              onClick={() => setShowStatusForm(true)}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              Change
                            </button>
                          </div>

                          {/* Status change dropdown */}
                          {showStatusForm && (
                            <div className="mt-3 bg-gray-800 rounded-md p-3 border border-gray-700">
                              <h4 className="text-sm font-medium text-white mb-2">
                                Change Status
                              </h4>
                              <select
                                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-3"
                                value={selectedStatus}
                                onChange={(e) =>
                                  setSelectedStatus(e.target.value)
                                }
                              >
                                <option value="new">New</option>
                                <option value="assigned">Assigned</option>
                                <option value="in_progress">In Progress</option>
                                <option value="on_hold">On Hold</option>
                                <option value="pending_customer">
                                  Pending Customer
                                </option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                              <div className="flex justify-end gap-2">
                                <button
                                  className="px-2 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors"
                                  onClick={() => setShowStatusForm(false)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
                                  onClick={handleStatusChange}
                                  disabled={isChangingStatus}
                                >
                                  {isChangingStatus ? "Updating..." : "Update"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-2xl text-gray-400">
                          {ticket.status === "new" && <FaExclamationCircle />}
                          {ticket.status === "open" && <FaExclamationCircle />}
                          {ticket.status === "assigned" && (
                            <FaUserPlus className="text-blue-400" />
                          )}
                          {ticket.status === "in_progress" && (
                            <FaClock className="text-yellow-400" />
                          )}
                          {ticket.status === "on_hold" ||
                          ticket.status === "pending_customer" ? (
                            <FaTimesCircle className="text-orange-400" />
                          ) : null}
                          {ticket.status === "resolved" && (
                            <FaCheckCircle className="text-green-400" />
                          )}
                          {ticket.status === "closed" && <FaTimesCircle />}
                        </div>
                      </div>

                      <div className="bg-gray-700/30 rounded-lg p-5 flex items-center justify-between">
                        <div>
                          <h3 className="text-gray-400 text-sm">Priority</h3>
                          <div className="mt-1">
                            {getPriorityBadge(ticket.priority)}
                          </div>
                        </div>
                        <div className="text-2xl text-gray-400">
                          {ticket.priority === "critical" && (
                            <FaExclamationCircle className="text-red-400" />
                          )}
                          {ticket.priority === "high" && (
                            <FaExclamationCircle className="text-orange-400" />
                          )}
                          {ticket.priority === "medium" && (
                            <FaExclamationCircle className="text-yellow-400" />
                          )}
                          {ticket.priority === "low" && (
                            <FaExclamationCircle className="text-green-400" />
                          )}
                        </div>
                      </div>

                      <div className="bg-gray-700/30 rounded-lg p-5 flex items-center justify-between">
                        <div>
                          <h3 className="text-gray-400 text-sm">Category</h3>
                          <p className="text-white font-medium mt-1">
                            {ticket.category}
                          </p>
                        </div>
                        <div className="text-2xl text-gray-400">
                          <FaTicketAlt />
                        </div>
                      </div>
                    </div>

                    {/* Tab content */}
                    <div className="mt-8">
                      {activeTab === "details" && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Left column - Main content and charts */}
                          <div className="lg:col-span-2 space-y-6">
                            {/* Activity chart */}
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <h3 className="text-lg font-medium text-white mb-4">
                                Activity Timeline
                              </h3>
                              {activityData && activityData.length > 0 ? (
                                <div className="h-64">
                                  <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                  >
                                    <BarChart
                                      data={activityData}
                                      margin={{
                                        top: 5,
                                        right: 30,
                                        left: 0,
                                        bottom: 5,
                                      }}
                                    >
                                      <XAxis dataKey="name" stroke="#9ca3af" />
                                      <YAxis stroke="#9ca3af" />
                                      <RechartsTooltip
                                        contentStyle={{
                                          backgroundColor: "#374151",
                                          borderColor: "#4b5563",
                                          color: "#e5e7eb",
                                        }}
                                      />
                                      <Legend />
                                      <Bar
                                        dataKey="comments"
                                        fill="#3b82f6"
                                        name="Comments"
                                      />
                                      <Bar
                                        dataKey="updates"
                                        fill="#10b981"
                                        name="Status Updates"
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <div className="h-64 flex items-center justify-center bg-gray-800/30 rounded-lg">
                                  <div className="text-center">
                                    <p className="text-gray-400 mb-2">
                                      No activity data available yet
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Activity will be shown here as actions are
                                      taken on this ticket
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Comments section */}
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-white">
                                  Comments & Updates
                                </h3>
                                <button
                                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 text-sm"
                                  onClick={() => setShowCommentForm(true)}
                                >
                                  <FaComment size={14} />
                                  Add Comment
                                </button>
                              </div>

                              {/* Comment form */}
                              {showCommentForm && (
                                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                                  <h4 className="font-medium text-white mb-2">
                                    Add a Comment
                                  </h4>
                                  <textarea
                                    className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-3"
                                    placeholder="Type your comment here..."
                                    rows={4}
                                    value={commentText}
                                    onChange={(e) =>
                                      setCommentText(e.target.value)
                                    }
                                  />
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        id="internal-comment"
                                        className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500/50"
                                        checked={isInternalComment}
                                        onChange={(e) =>
                                          setIsInternalComment(e.target.checked)
                                        }
                                      />
                                      <label
                                        htmlFor="internal-comment"
                                        className="text-sm text-gray-300"
                                      >
                                        Internal comment (not visible to
                                        customer)
                                      </label>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
                                        onClick={() => {
                                          setShowCommentForm(false);
                                          setCommentText("");
                                          setIsInternalComment(false);
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-1"
                                        onClick={handleAddComment}
                                        disabled={
                                          !commentText.trim() || isAddingComment
                                        }
                                      >
                                        {isAddingComment ? (
                                          <>
                                            <span className="animate-spin">
                                              ⏳
                                            </span>{" "}
                                            Sending...
                                          </>
                                        ) : (
                                          <>
                                            <FaComment size={14} /> Add Comment
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {ticket.comments && ticket.comments.length > 0 ? (
                                <div className="space-y-4">
                                  {[...ticket.comments]
                                    .reverse()
                                    .map((comment, index) => (
                                      <div
                                        key={comment._id || index}
                                        className="bg-gray-700/50 rounded-lg p-4"
                                      >
                                        <div className="flex justify-between items-center mb-3">
                                          <div className="flex items-center gap-2">
                                            <div className="bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center">
                                              <FaUser />
                                            </div>
                                            <div>
                                              <span className="font-medium text-white">
                                                {typeof comment.author ===
                                                "object"
                                                  ? comment.author?.fullName || // Use fullName if available
                                                    (comment.author?.profile
                                                      ?.firstName &&
                                                    comment.author?.profile
                                                      ?.lastName
                                                      ? `${comment.author.profile.firstName} ${comment.author.profile.lastName}`
                                                      : comment.author?.email ||
                                                        "Unknown")
                                                  : comment.author || "Unknown"}
                                                {typeof comment.author ===
                                                  "object" &&
                                                  comment.author?.role && (
                                                    <span className="ml-1 text-xs text-gray-400">
                                                      ({comment.author.role})
                                                    </span>
                                                  )}
                                              </span>
                                              <p className="text-xs text-gray-400">
                                                {formatDate(comment.createdAt)}
                                              </p>
                                            </div>
                                          </div>
                                          {comment.isInternal && (
                                            <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">
                                              Internal
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-gray-200 mb-3">
                                          {comment.text &&
                                          typeof comment.text === "string" &&
                                          comment.text.trim() ? (
                                            comment.text
                                          ) : (
                                            <span className="text-gray-400 italic">
                                              [No comment text]
                                            </span>
                                          )}
                                        </p>
                                        {/* Debug info */}
                                        {process.env.NODE_ENV ===
                                          "development" && (
                                          <div className="text-xs text-gray-500 border-t border-gray-700 pt-2 mt-2">
                                            <p>
                                              Debug:{" "}
                                              {JSON.stringify({
                                                id: comment._id,
                                                hasText: !!comment.text,
                                                textType: typeof comment.text,
                                                textLength:
                                                  comment.text?.length || 0,
                                              })}
                                            </p>
                                          </div>
                                        )}
                                        {comment.attachments &&
                                          comment.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                              {comment.attachments.map(
                                                (attachment, attIndex) => (
                                                  <a
                                                    key={
                                                      attachment._id || attIndex
                                                    }
                                                    href={attachment.path}
                                                    className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded flex items-center gap-1"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    <FaPaperclip size={12} />
                                                    {attachment.filename}
                                                  </a>
                                                )
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <div className="bg-gray-700/50 rounded-lg p-8 text-center">
                                  <p className="text-gray-400">
                                    No comments yet
                                  </p>
                                  <button className="mt-3 text-blue-400 hover:text-blue-300 transition-colors">
                                    Add the first comment
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right column - Metadata and SLA */}
                          <div className="space-y-6">
                            {/* Ticket metadata */}
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <h3 className="text-lg font-medium text-white mb-4">
                                Ticket Details
                              </h3>

                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm text-gray-400">
                                    Created By
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="bg-gray-600 rounded-full w-6 h-6 flex items-center justify-center">
                                      <FaUser size={12} />
                                    </div>
                                    <p className="text-white">
                                      {typeof ticket.createdBy === "object"
                                        ? ticket.createdBy?.profile
                                            ?.firstName &&
                                          ticket.createdBy?.profile?.lastName
                                          ? `${ticket.createdBy.profile.firstName} ${ticket.createdBy.profile.lastName}`
                                          : ticket.createdBy?.email || "Unknown"
                                        : ticket.createdBy || "Unknown"}
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-sm text-gray-400">
                                    Created At
                                  </p>
                                  <p className="text-white mt-1">
                                    {formatDate(ticket.createdAt)}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-sm text-gray-400">
                                    Last Updated
                                  </p>
                                  <p className="text-white mt-1">
                                    {formatDate(ticket.updatedAt)}
                                  </p>
                                </div>

                                {ticket.assignedTo && (
                                  <div>
                                    <div className="flex justify-between items-center">
                                      <p className="text-sm text-gray-400">
                                        Assigned To
                                      </p>
                                      <button
                                        onClick={() => setShowAssignForm(true)}
                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                      >
                                        Change
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="bg-green-500 rounded-full w-6 h-6 flex items-center justify-center">
                                        <FaUser size={12} />
                                      </div>
                                      <p className="text-white">
                                        {typeof ticket.assignedTo === "object"
                                          ? ticket.assignedTo?.profile
                                              ?.firstName &&
                                            ticket.assignedTo?.profile?.lastName
                                            ? `${ticket.assignedTo.profile.firstName} ${ticket.assignedTo.profile.lastName}`
                                            : ticket.assignedTo?.email ||
                                              "Unknown"
                                          : ticket.assignedTo || "Unassigned"}
                                      </p>
                                    </div>

                                    {/* Assign form */}
                                    {showAssignForm && (
                                      <div className="mt-3 bg-gray-800 rounded-md p-3 border border-gray-700">
                                        <h4 className="text-sm font-medium text-white mb-2">
                                          Assign Ticket
                                        </h4>
                                        {isLoadingUsers ? (
                                          <div className="text-center py-2">
                                            <span className="animate-spin inline-block mr-2">
                                              ⏳
                                            </span>{" "}
                                            Loading users...
                                          </div>
                                        ) : (
                                          <select
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-3"
                                            value={selectedAssignee}
                                            onChange={(e) =>
                                              setSelectedAssignee(
                                                e.target.value
                                              )
                                            }
                                          >
                                            <option value="">
                                              Select a user
                                            </option>
                                            {users?.map((user) => (
                                              <option
                                                key={user._id}
                                                value={user._id}
                                              >
                                                {user.profile?.firstName &&
                                                user.profile?.lastName
                                                  ? `${user.profile.firstName} ${user.profile.lastName}`
                                                  : user.email}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                        <div className="flex justify-end gap-2">
                                          <button
                                            className="px-2 py-1 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors"
                                            onClick={() =>
                                              setShowAssignForm(false)
                                            }
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            className="px-2 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
                                            onClick={handleAssignTicket}
                                            disabled={
                                              isAssigning || !selectedAssignee
                                            }
                                          >
                                            {isAssigning
                                              ? "Assigning..."
                                              : "Assign"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {ticket.assignedTeam && (
                                  <div>
                                    <p className="text-sm text-gray-400">
                                      Team
                                    </p>
                                    <p className="text-white mt-1">
                                      {typeof ticket.primaryTeam === "object"
                                        ? typeof ticket.primaryTeam.teamId ===
                                          "object"
                                          ? ticket.primaryTeam.teamId.name
                                          : ticket.primaryTeam.teamId
                                        : ticket.assignedTeam ||
                                          ticket.primaryTeam ||
                                          "Unassigned"}
                                    </p>
                                  </div>
                                )}

                                {ticket.tags && ticket.tags.length > 0 && (
                                  <div>
                                    <p className="text-sm text-gray-400">
                                      Tags
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {ticket.tags.map((tag) => (
                                        <span
                                          key={tag}
                                          className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* SLA section with visualization */}
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-white">
                                  SLA Status
                                </h3>
                                {ticket.sla && ticket.sla.pausedAt ? (
                                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                                    <FaPause size={10} /> Paused
                                  </span>
                                ) : ticket.sla ? (
                                  <span className="bg-green-500/20 text-green-400 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                                    <FaPlay size={10} /> Active
                                  </span>
                                ) : (
                                  <span className="bg-gray-500/20 text-gray-400 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                                    <FaClock size={10} /> Not Set
                                  </span>
                                )}
                              </div>

                              {!ticket.sla ? (
                                <div className="space-y-4">
                                  <div className="text-center py-6 bg-gray-800/50 rounded-lg">
                                    <FaClock className="mx-auto text-gray-400 text-4xl mb-3" />
                                    <p className="text-gray-300">
                                      No SLA policy applied to this ticket
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">
                                      Apply an SLA policy to set response and
                                      resolution deadlines
                                    </p>
                                  </div>

                                  {/* Apply SLA form */}
                                  {showSLAForm ? (
                                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                                      <h4 className="text-sm font-medium text-white mb-3">
                                        Apply SLA Policy
                                      </h4>
                                      {isLoadingSLAPolicies ? (
                                        <div className="text-center py-2">
                                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                                          <p className="text-sm text-gray-400 mt-2">
                                            Loading policies...
                                          </p>
                                        </div>
                                      ) : slaPolicies &&
                                        slaPolicies.length > 0 ? (
                                        <>
                                          <select
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-3"
                                            value={selectedSLAPolicy}
                                            onChange={(e) =>
                                              setSelectedSLAPolicy(
                                                e.target.value
                                              )
                                            }
                                          >
                                            <option value="">
                                              Select a policy
                                            </option>
                                            {slaPolicies.map((policy) => (
                                              <option
                                                key={policy._id}
                                                value={policy._id}
                                              >
                                                {policy.name}
                                              </option>
                                            ))}
                                          </select>
                                          <div className="flex justify-end gap-2">
                                            <button
                                              className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors"
                                              onClick={() =>
                                                setShowSLAForm(false)
                                              }
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors flex items-center gap-1"
                                              onClick={handleApplySLAPolicy}
                                              disabled={
                                                isApplyingSLA ||
                                                !selectedSLAPolicy
                                              }
                                            >
                                              {isApplyingSLA ? (
                                                <>
                                                  <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
                                                  Applying...
                                                </>
                                              ) : (
                                                <>
                                                  <FaCheck size={10} /> Apply
                                                </>
                                              )}
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-center py-2">
                                          <p className="text-sm text-gray-400">
                                            No SLA policies found
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setShowSLAForm(true)}
                                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                                    >
                                      <FaClock /> Apply SLA Policy
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* SLA pie chart */}
                                  <div className="h-40 mb-2">
                                    <ResponsiveContainer
                                      width="100%"
                                      height="100%"
                                    >
                                      <PieChart>
                                        <Pie
                                          data={[
                                            {
                                              name: "Elapsed",
                                              value:
                                                calculateSLAPercentage(ticket),
                                            },
                                            {
                                              name: "Remaining",
                                              value:
                                                100 -
                                                calculateSLAPercentage(ticket),
                                            },
                                          ]}
                                          cx="50%"
                                          cy="50%"
                                          innerRadius={40}
                                          outerRadius={60}
                                          fill="#8884d8"
                                          paddingAngle={5}
                                          dataKey="value"
                                          label={({ name, percent }) =>
                                            `${name} ${(percent * 100).toFixed(
                                              0
                                            )}%`
                                          }
                                        >
                                          <Cell
                                            fill={
                                              calculateSLAPercentage(ticket) >
                                              75
                                                ? "#f87171"
                                                : "#4ade80"
                                            }
                                          />
                                          <Cell fill="#374151" />
                                        </Pie>
                                        <RechartsTooltip
                                          contentStyle={{
                                            backgroundColor: "#374151",
                                            borderColor: "#4b5563",
                                            color: "#e5e7eb",
                                          }}
                                        />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm text-gray-400">
                                        Response Deadline
                                      </p>
                                      <p
                                        className={`text-white mt-1 flex items-center ${
                                          ticket.sla.breached?.response
                                            ? "text-red-400"
                                            : ""
                                        }`}
                                      >
                                        {formatDate(
                                          ticket.sla.responseDeadline
                                        )}
                                        {ticket.sla.breached?.response && (
                                          <span className="ml-2 bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
                                            Breached
                                          </span>
                                        )}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-sm text-gray-400">
                                        Resolution Deadline
                                      </p>
                                      <p
                                        className={`text-white mt-1 flex items-center ${
                                          ticket.sla.breached?.resolution
                                            ? "text-red-400"
                                            : ""
                                        }`}
                                      >
                                        {formatDate(
                                          ticket.sla.resolutionDeadline
                                        )}
                                        {ticket.sla.breached?.resolution && (
                                          <span className="ml-2 bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
                                            Breached
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-sm text-gray-400">
                                      SLA Progress
                                    </p>
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span
                                          className={
                                            calculateSLAPercentage(ticket) > 75
                                              ? "text-orange-400"
                                              : "text-green-400"
                                          }
                                        >
                                          {calculateSLAPercentage(ticket)}%
                                          Complete
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-600 rounded-full h-2.5">
                                        <div
                                          className={`h-2.5 rounded-full ${
                                            calculateSLAPercentage(ticket) > 75
                                              ? "bg-orange-500"
                                              : "bg-green-500"
                                          }`}
                                          style={{
                                            width: `${calculateSLAPercentage(
                                              ticket
                                            )}%`,
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* SLA Actions */}
                                  <div className="pt-2 border-t border-gray-700">
                                    {ticket.sla.pausedAt ? (
                                      <div className="space-y-3">
                                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                                          <div className="flex items-start gap-2">
                                            <FaPause className="text-yellow-400 mt-1" />
                                            <div>
                                              <p className="text-sm text-yellow-400 font-medium">
                                                SLA Paused
                                              </p>
                                              <p className="text-xs text-gray-400 mt-1">
                                                Paused at:{" "}
                                                {formatDate(
                                                  ticket.sla.pausedAt
                                                )}
                                              </p>
                                              {ticket.sla.pauseReason && (
                                                <p className="text-xs text-gray-300 mt-1">
                                                  Reason:{" "}
                                                  {ticket.sla.pauseReason}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <button
                                          onClick={handleResumeSLA}
                                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                                          disabled={isResumingSLA}
                                        >
                                          {isResumingSLA ? (
                                            <>
                                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                              Resuming...
                                            </>
                                          ) : (
                                            <>
                                              <FaPlay /> Resume SLA
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    ) : (
                                      <div>
                                        {showPauseForm ? (
                                          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                                            <h4 className="text-sm font-medium text-white mb-3">
                                              Pause SLA
                                            </h4>
                                            <textarea
                                              className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-3"
                                              placeholder="Reason for pausing SLA"
                                              value={pauseReason}
                                              onChange={(e) =>
                                                setPauseReason(e.target.value)
                                              }
                                              rows={3}
                                            />
                                            <div className="flex justify-end gap-2">
                                              <button
                                                className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors"
                                                onClick={() =>
                                                  setShowPauseForm(false)
                                                }
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                className="px-3 py-1.5 bg-yellow-500 text-white text-xs rounded-md hover:bg-yellow-600 transition-colors flex items-center gap-1"
                                                onClick={handlePauseSLA}
                                                disabled={
                                                  isPausingSLA || !pauseReason
                                                }
                                              >
                                                {isPausingSLA ? (
                                                  <>
                                                    <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
                                                    Pausing...
                                                  </>
                                                ) : (
                                                  <>
                                                    <FaPause size={10} /> Pause
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() =>
                                              setShowPauseForm(true)
                                            }
                                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                                          >
                                            <FaPause /> Pause SLA
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <h3 className="text-lg font-medium text-white mb-4">
                                Actions
                              </h3>
                              <div className="space-y-3">
                                {/* Update Status Button */}
                                {showStatusForm ? (
                                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-3">
                                    <h4 className="text-sm font-medium text-white mb-3">
                                      Update Status
                                    </h4>
                                    <select
                                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-3"
                                      value={selectedStatus}
                                      onChange={(e) =>
                                        setSelectedStatus(e.target.value)
                                      }
                                    >
                                      <option value="">Select a status</option>
                                      <option value="new">New</option>
                                      <option value="assigned">Assigned</option>
                                      <option value="in_progress">
                                        In Progress
                                      </option>
                                      <option value="on_hold">On Hold</option>
                                      <option value="pending_customer">
                                        Pending Customer
                                      </option>
                                      <option value="resolved">Resolved</option>
                                      <option value="closed">Closed</option>
                                    </select>
                                    <div className="flex justify-end gap-2">
                                      <button
                                        className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors"
                                        onClick={() => setShowStatusForm(false)}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors flex items-center gap-1"
                                        onClick={handleStatusChange}
                                        disabled={
                                          isChangingStatus || !selectedStatus
                                        }
                                      >
                                        {isChangingStatus ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
                                            Updating...
                                          </>
                                        ) : (
                                          <>
                                            <FaCheck size={10} /> Update
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowStatusForm(true)}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                                  >
                                    <FaEdit /> Update Status
                                  </button>
                                )}

                                {/* Reassign Ticket Button */}
                                {showAssignForm ? (
                                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-3">
                                    <h4 className="text-sm font-medium text-white mb-3">
                                      Reassign Ticket
                                    </h4>
                                    {isLoadingUsers ? (
                                      <div className="text-center py-2">
                                        <span className="animate-spin inline-block mr-2">
                                          ⏳
                                        </span>{" "}
                                        Loading users...
                                      </div>
                                    ) : (
                                      <select
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white mb-3"
                                        value={selectedAssignee}
                                        onChange={(e) =>
                                          setSelectedAssignee(e.target.value)
                                        }
                                      >
                                        <option value="">Select a user</option>
                                        {users?.map((user) => (
                                          <option
                                            key={user._id}
                                            value={user._id}
                                          >
                                            {user.profile?.firstName &&
                                            user.profile?.lastName
                                              ? `${user.profile.firstName} ${user.profile.lastName}`
                                              : user.email}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                    <div className="flex justify-end gap-2">
                                      <button
                                        className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-md hover:bg-gray-500 transition-colors"
                                        onClick={() => setShowAssignForm(false)}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-md hover:bg-green-600 transition-colors flex items-center gap-1"
                                        onClick={handleAssignTicket}
                                        disabled={
                                          isAssigning || !selectedAssignee
                                        }
                                      >
                                        {isAssigning ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
                                            Assigning...
                                          </>
                                        ) : (
                                          <>
                                            <FaCheck size={10} /> Assign
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowAssignForm(true)}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                                  >
                                    <FaUserPlus /> Reassign Ticket
                                  </button>
                                )}

                                {/* View Audit Log Button */}
                                <button
                                  onClick={() => setActiveTab("activity")}
                                  className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                                >
                                  <FaHistory /> View Audit Log
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "activity" && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-white mb-4">
                            Ticket Activity
                          </h3>

                          {/* Activity mind map visualization with enhanced features */}
                          <div className="bg-gray-700/30 rounded-lg p-5">
                            {isLoadingActivities ? (
                              <div className="flex justify-center items-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                              </div>
                            ) : groupedActivities &&
                              groupedActivities.length > 0 ? (
                              <div className="relative">
                                {/* Timeline line */}
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700"></div>

                                {/* Timeline events grouped by status */}
                                <div className="space-y-10">
                                  {groupedActivities.map(
                                    (group, groupIndex) => (
                                      <div
                                        key={`group-${groupIndex}`}
                                        className="relative"
                                      >
                                        {/* Status header */}
                                        <div className="mb-4 bg-gray-800/50 p-3 rounded-lg border-l-4 border-blue-500">
                                          <div className="flex justify-between items-center">
                                            <h3 className="font-medium text-white text-lg">
                                              {group.statusLabel ||
                                                group.status}
                                            </h3>
                                            <span className="text-xs text-gray-400">
                                              {formatDate(group.startTime)}
                                              {group.endTime &&
                                                ` - ${formatDate(
                                                  group.endTime
                                                )}`}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Activities in this status group */}
                                        <div className="space-y-6 ml-2">
                                          {group.activities.map(
                                            (entry, index) => (
                                              <div
                                                key={
                                                  entry._id ||
                                                  `${groupIndex}-${index}`
                                                }
                                                className="relative pl-10"
                                              >
                                                {/* Timeline dot */}
                                                <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                                  {entry.action ===
                                                    "created" && (
                                                    <FaPlus className="text-blue-400" />
                                                  )}
                                                  {entry.action ===
                                                    "status_changed" && (
                                                    <FaExchangeAlt className="text-yellow-400" />
                                                  )}
                                                  {entry.action ===
                                                    "assigned" && (
                                                    <FaUserPlus className="text-green-400" />
                                                  )}
                                                  {entry.action ===
                                                    "commented" && (
                                                    <FaComment className="text-purple-400" />
                                                  )}
                                                  {entry.action ===
                                                    "updated" && (
                                                    <FaEdit className="text-orange-400" />
                                                  )}
                                                </div>

                                                {/* Event content */}
                                                <div className="bg-gray-700/30 rounded-lg p-4">
                                                  <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-medium text-white">
                                                      {entry.action ===
                                                        "created" &&
                                                        "Ticket Created"}
                                                      {entry.action ===
                                                        "status_changed" &&
                                                        "Status Changed"}
                                                      {entry.action ===
                                                        "assigned" &&
                                                        "Ticket Assigned"}
                                                      {entry.action ===
                                                        "commented" &&
                                                        "Comment Added"}
                                                      {entry.action ===
                                                        "updated" &&
                                                        "Ticket Updated"}
                                                      {![
                                                        "created",
                                                        "status_changed",
                                                        "assigned",
                                                        "commented",
                                                        "updated",
                                                      ].includes(
                                                        entry.action
                                                      ) &&
                                                        entry.action
                                                          .split("_")
                                                          .map(
                                                            (word) =>
                                                              word
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                              word.slice(1)
                                                          )
                                                          .join(" ")}
                                                    </h4>
                                                    <span className="text-xs text-gray-400">
                                                      {formatDate(
                                                        entry.timestamp
                                                      )}
                                                    </span>
                                                  </div>
                                                  <p className="text-gray-300">
                                                    <span className="font-medium">
                                                      {entry.performedBy
                                                        ?.name ||
                                                        "Unknown user"}
                                                    </span>{" "}
                                                    {entry.action ===
                                                      "created" &&
                                                      "created this ticket"}
                                                    {entry.action ===
                                                      "status_changed" && (
                                                      <>
                                                        changed status from{" "}
                                                        <span className="font-medium">
                                                          {entry.details
                                                            ?.oldStatus ||
                                                            "previous status"}
                                                        </span>{" "}
                                                        to{" "}
                                                        <span className="font-medium">
                                                          {entry.details
                                                            ?.newStatus ||
                                                            "new status"}
                                                        </span>
                                                      </>
                                                    )}
                                                    {entry.action ===
                                                      "assigned" && (
                                                      <>
                                                        assigned this ticket to{" "}
                                                        <span className="font-medium">
                                                          {entry.details
                                                            ?.assigneeName ||
                                                            "team member"}
                                                        </span>
                                                      </>
                                                    )}
                                                    {entry.action ===
                                                      "commented" &&
                                                      "added a comment"}
                                                    {entry.action ===
                                                      "updated" && (
                                                      <>
                                                        updated{" "}
                                                        {Object.keys(
                                                          entry.details || {}
                                                        )
                                                          .map((key) =>
                                                            key
                                                              .replace(
                                                                /([A-Z])/g,
                                                                " $1"
                                                              )
                                                              .toLowerCase()
                                                          )
                                                          .join(", ") ||
                                                          "ticket details"}
                                                      </>
                                                    )}
                                                  </p>
                                                  {entry.details &&
                                                    entry.action ===
                                                      "commented" &&
                                                    entry.details.comment && (
                                                      <div className="mt-2 bg-gray-800/50 p-3 rounded-md text-gray-300 text-sm">
                                                        {entry.details.comment}
                                                      </div>
                                                    )}
                                                </div>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <ActivityMindMap events={activityEvents} />

                                {/* Activity filters */}
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs hover:bg-blue-500/30 transition-colors">
                                    Status Changes
                                  </button>
                                  <button className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full text-xs hover:bg-indigo-500/30 transition-colors">
                                    Comments
                                  </button>
                                  <button className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs hover:bg-purple-500/30 transition-colors">
                                    Assignments
                                  </button>
                                  <button className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs hover:bg-amber-500/30 transition-colors">
                                    SLA Updates
                                  </button>
                                  <button className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs hover:bg-emerald-500/30 transition-colors">
                                    Edits
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Activity statistics */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <h4 className="text-md font-medium text-white mb-3">
                                Activity Summary
                              </h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-300">
                                    Total Events
                                  </span>
                                  <span className="font-medium text-white">
                                    {activityEvents && activityEvents.length
                                      ? activityEvents.length
                                      : 0}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-300">
                                    Last Updated
                                  </span>
                                  <span className="font-medium text-white">
                                    {
                                      activityEvents &&
                                      activityEvents.length > 0 &&
                                      activityEvents[0]?.timestamp
                                        ? new Date(
                                            activityEvents[0].timestamp
                                          ).toLocaleString()
                                        : formatDate(
                                            ticket.updatedAt ||
                                              ticket.createdAt ||
                                              new Date().toISOString()
                                          ) // Fallback with multiple options
                                    }
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-300">
                                    Contributors
                                  </span>
                                  <span className="font-medium text-white">
                                    {
                                      activityEvents &&
                                      activityEvents.length > 0
                                        ? new Set(
                                            activityEvents.map(
                                              (e) => e.user?.id || "unknown"
                                            )
                                          ).size
                                        : 1 // Default to 1 (the ticket creator)
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <h4 className="text-md font-medium text-white mb-3">
                                Response Metrics
                              </h4>
                              <div className="flex items-center justify-center h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={responseTimeData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={80}
                                      fill="#8884d8"
                                      paddingAngle={5}
                                      dataKey="value"
                                      label={({ name, percent }) =>
                                        `${name} ${(percent * 100).toFixed(0)}%`
                                      }
                                    >
                                      {responseTimeData.map((entry, index) => (
                                        <Cell
                                          key={`cell-${index}`}
                                          fill={COLORS[index % COLORS.length]}
                                        />
                                      ))}
                                    </Pie>
                                    <RechartsTooltip />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "sla" && (
                        <div className="space-y-6">
                          <h3 className="text-lg font-medium text-white mb-4">
                            SLA Performance
                          </h3>

                          {/* Add loading state and error handling */}
                          {isLoadingSLAPolicies ? (
                            <div className="flex justify-center items-center py-8">
                              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                          ) : ticket.sla && ticket.sla.policyId ? (
                            <>
                              {/* SLA metrics visualization */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-700/30 rounded-lg p-5">
                                  <h4 className="text-md font-medium text-white mb-3">
                                    Response Time
                                  </h4>
                                  <div className="h-64">
                                    <ResponsiveContainer
                                      width="100%"
                                      height="100%"
                                    >
                                      <PieChart>
                                        <Pie
                                          data={[
                                            {
                                              name: "Elapsed",
                                              value: ticket.sla.responseDeadline
                                                ? Math.min(
                                                    100,
                                                    calculateElapsedPercentage(
                                                      ticket.createdAt,
                                                      ticket.sla
                                                        .responseDeadline
                                                    )
                                                  )
                                                : 0,
                                            },
                                            {
                                              name: "Remaining",
                                              value: ticket.sla.responseDeadline
                                                ? Math.max(
                                                    0,
                                                    100 -
                                                      calculateElapsedPercentage(
                                                        ticket.createdAt,
                                                        ticket.sla
                                                          .responseDeadline
                                                      )
                                                  )
                                                : 100,
                                            },
                                          ]}
                                          cx="50%"
                                          cy="50%"
                                          labelLine={false}
                                          outerRadius={80}
                                          fill="#8884d8"
                                          dataKey="value"
                                          label={({ name, percent }) =>
                                            `${name}: ${(percent * 100).toFixed(
                                              0
                                            )}%`
                                          }
                                        >
                                          <Cell fill="#4ade80" />
                                          <Cell fill="#f87171" />
                                        </Pie>
                                        <RechartsTooltip
                                          contentStyle={{
                                            backgroundColor: "#374151",
                                            borderColor: "#4b5563",
                                            color: "#e5e7eb",
                                          }}
                                        />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>

                                <div className="bg-gray-700/30 rounded-lg p-5">
                                  <h4 className="text-md font-medium text-white mb-3">
                                    SLA Timeline
                                  </h4>
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-300">
                                        Created
                                      </span>
                                      <span className="text-gray-300">
                                        {formatDate(ticket.createdAt)}
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                      <div
                                        className="bg-blue-500 h-full"
                                        style={{ width: "100%" }}
                                      ></div>
                                    </div>

                                    {ticket.sla.responseDeadline && (
                                      <>
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-300">
                                            Response Deadline
                                          </span>
                                          <span className="text-gray-300">
                                            {formatDate(
                                              ticket.sla.responseDeadline
                                            )}
                                          </span>
                                        </div>
                                        <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                          <div
                                            className={`${
                                              ticket.sla.breached?.response
                                                ? "bg-red-500"
                                                : "bg-green-500"
                                            } h-full`}
                                            style={{
                                              width: `${Math.min(
                                                100,
                                                calculateElapsedPercentage(
                                                  ticket.createdAt,
                                                  ticket.sla.responseDeadline
                                                )
                                              )}%`,
                                            }}
                                          ></div>
                                        </div>
                                      </>
                                    )}

                                    {ticket.sla.resolutionDeadline && (
                                      <>
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-300">
                                            Resolution Deadline
                                          </span>
                                          <span className="text-gray-300">
                                            {formatDate(
                                              ticket.sla.resolutionDeadline
                                            )}
                                          </span>
                                        </div>
                                        <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                          <div
                                            className={`${
                                              ticket.sla.breached?.resolution
                                                ? "bg-red-500"
                                                : "bg-yellow-500"
                                            } h-full`}
                                            style={{
                                              width: `${Math.min(
                                                100,
                                                calculateElapsedPercentage(
                                                  ticket.createdAt,
                                                  ticket.sla.resolutionDeadline
                                                )
                                              )}%`,
                                            }}
                                          ></div>
                                        </div>
                                      </>
                                    )}

                                    {ticket.sla.resolutionDeadline &&
                                      !ticket.sla.breached?.resolution && (
                                        <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-md flex items-center">
                                          <FaExclamationCircle className="text-yellow-400 mr-2" />
                                          <span className="text-sm text-yellow-300">
                                            This ticket has reached{" "}
                                            {Math.min(
                                              100,
                                              calculateElapsedPercentage(
                                                ticket.createdAt,
                                                ticket.sla.resolutionDeadline
                                              )
                                            )}
                                            % of its resolution SLA time
                                          </span>
                                        </div>
                                      )}

                                    {ticket.sla.pausedAt && (
                                      <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-md flex items-center">
                                        <FaPause className="text-blue-400 mr-2" />
                                        <span className="text-sm text-blue-300">
                                          SLA is currently paused:{" "}
                                          {ticket.sla.pauseReason ||
                                            "No reason provided"}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="bg-gray-700/30 rounded-lg p-5">
                                <h4 className="text-md font-medium text-white mb-3">
                                  SLA Details
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center pb-2 border-b border-gray-600">
                                    <span className="text-gray-300">
                                      Response SLA
                                    </span>
                                    {ticket.sla.breached?.response ? (
                                      <span className="text-red-400 flex items-center">
                                        <FaExclamationCircle className="mr-1" />{" "}
                                        Breached
                                      </span>
                                    ) : ticket.sla.responseDeadline &&
                                      new Date(ticket.sla.responseDeadline) <
                                        new Date() ? (
                                      <span className="text-green-400 flex items-center">
                                        <FaCheck className="mr-1" /> Met
                                      </span>
                                    ) : (
                                      <span className="text-yellow-400 flex items-center">
                                        <FaClock className="mr-1" /> In Progress
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex justify-between items-center pb-2 border-b border-gray-600">
                                    <span className="text-gray-300">
                                      Resolution SLA
                                    </span>
                                    {ticket.sla.breached?.resolution ? (
                                      <span className="text-red-400 flex items-center">
                                        <FaExclamationCircle className="mr-1" />{" "}
                                        Breached
                                      </span>
                                    ) : ticket.status === "resolved" ||
                                      ticket.status === "closed" ? (
                                      <span className="text-green-400 flex items-center">
                                        <FaCheck className="mr-1" /> Met
                                      </span>
                                    ) : (
                                      <span className="text-yellow-400 flex items-center">
                                        <FaClock className="mr-1" /> In Progress
                                        {ticket.sla.resolutionDeadline && (
                                          <>
                                            {" "}
                                            (
                                            {Math.min(
                                              100,
                                              calculateElapsedPercentage(
                                                ticket.createdAt,
                                                ticket.sla.resolutionDeadline
                                              )
                                            )}
                                            % elapsed)
                                          </>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex justify-between items-center pb-2 border-b border-gray-600">
                                    <span className="text-gray-300">
                                      SLA Policy
                                    </span>
                                    <span className="text-blue-400">
                                      {ticket.priority.charAt(0).toUpperCase() +
                                        ticket.priority.slice(1)}{" "}
                                      Priority
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-300">
                                      SLA Status
                                    </span>
                                    <span className="text-gray-300">
                                      {ticket.sla.pausedAt ? (
                                        <span className="text-blue-400 flex items-center">
                                          <FaPause className="mr-1" /> Paused
                                        </span>
                                      ) : (
                                        <span className="text-green-400 flex items-center">
                                          <FaPlay className="mr-1" /> Active
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="bg-gray-700/30 rounded-lg p-8 text-center">
                              <FaClock className="mx-auto text-gray-400 text-4xl mb-3" />
                              <p className="text-gray-300 text-lg font-medium mb-2">
                                No SLA Policy Applied
                              </p>
                              <p className="text-gray-400 mb-6">
                                This ticket doesn't have an SLA policy applied.
                                SLA policies help track response and resolution
                                times.
                              </p>
                              <button
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-flex items-center"
                                onClick={() => setIsSLAPolicySelectorOpen(true)}
                              >
                                <FaPlus className="mr-2" /> Apply SLA Policy
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Add the analytics modal */}
      {ticket && (
        <TicketAnalyticsModal
          isOpen={analyticsModalOpen}
          closeModal={() => setAnalyticsModalOpen(false)}
          ticket={ticket}
        />
      )}

      {/* Add the SLA Policy Selector modal */}
      {ticket && (
        <SLAPolicySelector
          isOpen={isSLAPolicySelectorOpen}
          closeModal={() => setIsSLAPolicySelectorOpen(false)}
          ticketId={ticket.id}
          onSuccess={() => {
            refetch();
            toast.success("SLA policy applied successfully");
          }}
        />
      )}
    </>
  );
};

export default TicketsPage;
