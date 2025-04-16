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
import ActivityMindMap from "@/components/tickets/ActivityMindMap";
import { FaChartLine, FaUserClock } from "react-icons/fa";
import {
  useGetTicketsQuery,
  useGetTicketStatisticsQuery,
} from "@/features/tickets/api/ticketApi";
import { ticketSocket } from "@/features/tickets/api/ticketSocket";
import { toast } from "react-hot-toast";

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

interface SLA {
  responseDeadline: string;
  resolutionDeadline: string;
  breached: boolean;
  percentageComplete: number; // For 75% SLA alert
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string; // "open", "in_progress", "resolved", "closed" or custom status
  priority: string; // "low", "medium", "high", "critical"
  category: string; // Technical area or product
  createdAt: string;
  updatedAt: string;
  createdBy: string; // Customer who created the ticket
  assignedTo?: string; // Technical team member
  assignedTeam?: string; // Team responsible for the ticket
  parentTicketId?: string; // For sub-tickets
  comments?: Comment[];
  attachments?: Attachment[];
  auditLog?: AuditLogEntry[];
  sla?: SLA;
  tags?: string[]; // For additional categorization
  customFields?: Record<string, any>; // For extensibility
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
      return (
        <span className="bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
          Open
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

const getTicketAnalytics = (ticketId: string): TicketAnalytics => {
  // Mock data - would be fetched from API in real implementation
  return {
    avgResponseTime: "1h 24m",
    avgResolutionTime: "8h 15m",
    similarTicketsCount: 12,
    recurrenceRate: "18%",
    escalationRate: "5%",
    firstContactResolution: "62%",
  };
};

const TicketAnalyticsModal = ({
  isOpen,
  closeModal,
  ticketId,
}: {
  isOpen: boolean;
  closeModal: () => void;
  ticketId: string;
}) => {
  const analytics = getTicketAnalytics(ticketId);

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
                          <Tooltip
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { user } = useAuth();

  // Fetch tickets from API
  const {
    data: ticketsData,
    isLoading,
    error,
  } = useGetTicketsQuery({
    filters: {
      status: selectedStatus !== "all" ? selectedStatus : undefined,
      priority: selectedPriority !== "all" ? selectedPriority : undefined,
      search: searchQuery || undefined,
    },
    page,
    limit,
  });

  // Fetch ticket statistics
  const { data: statisticsData } = useGetTicketStatisticsQuery();

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    // Subscribe to ticket events
    const unsubscribeCreated = ticketSocket.onTicketEvent(
      "ticket:created",
      (data) => {
        toast.success(`New ticket created: ${data.title}`);
      }
    );

    const unsubscribeUpdated = ticketSocket.onTicketEvent(
      "ticket:updated",
      (data) => {
        toast.info(`Ticket updated: ${data.title}`);
      }
    );

    const unsubscribeCommentAdded = ticketSocket.onTicketEvent(
      "ticket:comment_added",
      (data) => {
        toast.info(`New comment on ticket ${data.ticketId}`);
      }
    );

    // Clean up listeners on unmount
    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeCommentAdded();
    };
  }, []);

  // Add this function to handle opening the analytics modal
  const openAnalyticsModal = () => {
    setIsAnalyticsModalOpen(true);
  };

  // Add this function to handle closing the analytics modal
  const closeAnalyticsModal = () => {
    setIsAnalyticsModalOpen(false);
  };

  // Use API data if available, otherwise use empty array
  const tickets: Ticket[] = ticketsData?.data || [
    {
      id: "TKT-2389",
      title: "Server connectivity issues in production",
      description:
        "Users are experiencing intermittent connection drops to the main server.",
      status: "in_progress",
      priority: "high",
      category: "Infrastructure",
      createdBy: "customer@example.com",
      assignedTo: "john.doe",
      assignedTeam: "Server Infrastructure",
      createdAt: "2023-10-15T10:30:00Z",
      updatedAt: "2023-10-16T14:20:00Z",
      sla: {
        responseDeadline: "2023-10-15T12:30:00Z",
        resolutionDeadline: "2023-10-17T10:30:00Z",
        breached: false,
        percentageComplete: 65,
      },
      tags: ["server", "connectivity", "production"],
    },
    {
      id: "TKT-2376",
      title: "Dashboard loading slowly for some users",
      description:
        "Several users reported that the dashboard takes more than 10 seconds to load.",
      status: "open",
      priority: "medium",
      category: "Frontend",
      createdBy: "user123@example.com",
      assignedTo: "jane.smith",
      createdAt: "2023-10-14T08:15:00Z",
      updatedAt: "2023-10-14T09:45:00Z",
    },
    {
      id: "TKT-2350",
      title: "Critical security vulnerability in login page",
      description:
        "Security audit revealed a potential XSS vulnerability in the login form.",
      status: "open",
      priority: "high",
      category: "Security",
      createdBy: "security@example.com",
      createdAt: "2023-10-13T16:20:00Z",
      updatedAt: "2023-10-13T16:20:00Z",
    },
    {
      id: "TKT-2345",
      title: "Feature request: Export data to CSV",
      description:
        "Multiple customers have requested the ability to export their data to CSV format.",
      status: "resolved",
      priority: "low",
      category: "Feature Request",
      createdBy: "customer456@example.com",
      assignedTo: "alex.johnson",
      createdAt: "2023-10-12T11:10:00Z",
      updatedAt: "2023-10-14T15:30:00Z",
    },
    {
      id: "TKT-2340",
      title: "Mobile app crashes on startup",
      description:
        "iOS users are reporting that the app crashes immediately after the splash screen.",
      status: "closed",
      priority: "high",
      category: "Mobile",
      createdBy: "mobile.user@example.com",
      assignedTo: "sarah.williams",
      createdAt: "2023-10-10T09:25:00Z",
      updatedAt: "2023-10-13T17:15:00Z",
    },
  ];

  // Filter tickets based on search query and filters
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatus === "all" || ticket.status === selectedStatus;
    const matchesPriority =
      selectedPriority === "all" || ticket.priority === selectedPriority;

    return matchesSearch && matchesStatus && matchesPriority;
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
                    <CreateTicketForm onSuccess={() => setCurrentView("all")} />
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
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>

                        <select
                          className="bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          value={selectedPriority}
                          onChange={(e) => setSelectedPriority(e.target.value)}
                        >
                          <option value="all">All Priority</option>
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
                                    {ticket.id}
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
                                    {ticket.assignedTo || "-"}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {formatDate(ticket.createdAt)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {formatDate(ticket.updatedAt)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right ticket-actions">
                                    <button className="text-gray-400 hover:text-white transition-colors">
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
                                                  {ticket.assignedTo}
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

  // Early return if ticket is null
  if (!ticket) return null;

  // Sample data for activity chart
  const activityData = [
    { name: "Mon", comments: 3, updates: 2 },
    { name: "Tue", comments: 5, updates: 1 },
    { name: "Wed", comments: 2, updates: 4 },
    { name: "Thu", comments: 0, updates: 1 },
    { name: "Fri", comments: 4, updates: 3 },
  ];

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

  // Add this mock activity data for the selected ticket
  // This would normally come from your API
  const getTicketActivityEvents = (ticketId: string) => {
    // Mock data - would be fetched from API in real implementation
    return [
      {
        id: "act-1",
        type: "status_change",
        timestamp: "2023-10-15T10:30:00Z",
        user: {
          id: "user1",
          name: "John Doe",
          avatar: "/avatars/john.jpg",
        },
        details: {
          title: "Status Changed",
          from: "Open",
          to: "In Progress",
        },
      },
      {
        id: "act-2",
        type: "assignment",
        timestamp: "2023-10-15T10:35:00Z",
        user: {
          id: "user2",
          name: "Sarah Admin",
          avatar: "/avatars/sarah.jpg",
        },
        details: {
          title: "Ticket Assigned",
          description: "Assigned to Server Infrastructure team",
        },
      },
      {
        id: "act-3",
        type: "comment",
        timestamp: "2023-10-15T11:20:00Z",
        user: {
          id: "user3",
          name: "Mike Tech",
          avatar: "/avatars/mike.jpg",
        },
        details: {
          title: "Added Comment",
          description:
            "Investigating the server logs to identify the root cause of connectivity issues.",
        },
      },
      {
        id: "act-4",
        type: "sla_update",
        timestamp: "2023-10-16T09:15:00Z",
        user: {
          id: "system",
          name: "System",
        },
        details: {
          title: "SLA Warning",
          description: "This ticket has reached 75% of its resolution SLA",
        },
      },
      {
        id: "act-5",
        type: "edit",
        timestamp: "2023-10-16T14:20:00Z",
        user: {
          id: "user3",
          name: "Mike Tech",
          avatar: "/avatars/mike.jpg",
        },
        details: {
          title: "Ticket Updated",
          description: "Added additional details about the server environment",
        },
      },
    ];
  };

  // Use ticket instead of selectedTicket
  const activityEvents = getTicketActivityEvents(ticket.id);

  const ticketAnalytics = getTicketAnalytics(ticket.id);

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
                        <span>{ticket.id}</span>
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
                          <div className="mt-1">
                            {getStatusBadge(ticket.status)}
                          </div>
                        </div>
                        <div className="text-2xl text-gray-400">
                          {ticket.status === "open" && <FaExclamationCircle />}
                          {ticket.status === "in_progress" && <FaClock />}
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
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
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
                                    <Tooltip
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
                            </div>

                            {/* Comments section */}
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-white">
                                  Comments & Updates
                                </h3>
                                <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 text-sm">
                                  <FaComment size={14} />
                                  Add Comment
                                </button>
                              </div>

                              {ticket.comments && ticket.comments.length > 0 ? (
                                <div className="space-y-4">
                                  {ticket.comments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="bg-gray-700/50 rounded-lg p-4"
                                    >
                                      <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                          <div className="bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center">
                                            <FaUser />
                                          </div>
                                          <div>
                                            <span className="font-medium text-white">
                                              {comment.author}
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
                                        {comment.text}
                                      </p>
                                      {comment.attachments &&
                                        comment.attachments.length > 0 && (
                                          <div className="flex flex-wrap gap-2">
                                            {comment.attachments.map(
                                              (attachment) => (
                                                <a
                                                  key={attachment.id}
                                                  href={attachment.url}
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
                                      {ticket.createdBy}
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
                                    <p className="text-sm text-gray-400">
                                      Assigned To
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="bg-green-500 rounded-full w-6 h-6 flex items-center justify-center">
                                        <FaUser size={12} />
                                      </div>
                                      <p className="text-white">
                                        {ticket.assignedTo}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {ticket.assignedTeam && (
                                  <div>
                                    <p className="text-sm text-gray-400">
                                      Team
                                    </p>
                                    <p className="text-white mt-1">
                                      {ticket.assignedTeam}
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
                            {ticket.sla && (
                              <div className="bg-gray-700/30 rounded-lg p-5">
                                <h3 className="text-lg font-medium text-white mb-4">
                                  SLA Status
                                </h3>

                                <div className="space-y-4">
                                  {/* SLA pie chart */}
                                  <div className="h-40 mb-2">
                                    <ResponsiveContainer
                                      width="100%"
                                      height="100%"
                                    >
                                      <PieChart>
                                        <Pie
                                          data={responseTimeData}
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
                                          {responseTimeData.map(
                                            (entry, index) => (
                                              <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                  COLORS[index % COLORS.length]
                                                }
                                              />
                                            )
                                          )}
                                        </Pie>
                                        <Tooltip
                                          contentStyle={{
                                            backgroundColor: "#374151",
                                            borderColor: "#4b5563",
                                            color: "#e5e7eb",
                                          }}
                                        />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>

                                  <div>
                                    <p className="text-sm text-gray-400">
                                      Response Deadline
                                    </p>
                                    <p className="text-white mt-1">
                                      {formatDate(ticket.sla.responseDeadline)}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-sm text-gray-400">
                                      Resolution Deadline
                                    </p>
                                    <p className="text-white mt-1">
                                      {formatDate(
                                        ticket.sla.resolutionDeadline
                                      )}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-sm text-gray-400">
                                      SLA Progress
                                    </p>
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span
                                          className={
                                            ticket.sla.percentageComplete > 75
                                              ? "text-orange-400"
                                              : "text-green-400"
                                          }
                                        >
                                          {ticket.sla.percentageComplete}%
                                          Complete
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-600 rounded-full h-2.5">
                                        <div
                                          className={`h-2.5 rounded-full ${
                                            ticket.sla.percentageComplete > 75
                                              ? "bg-orange-500"
                                              : "bg-green-500"
                                          }`}
                                          style={{
                                            width: `${ticket.sla.percentageComplete}%`,
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <h3 className="text-lg font-medium text-white mb-4">
                                Actions
                              </h3>
                              <div className="space-y-3">
                                <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2">
                                  <FaEdit /> Update Status
                                </button>
                                <button className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2">
                                  <FaUserPlus /> Reassign Ticket
                                </button>
                                <button className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2">
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
                                    {activityEvents.length}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-300">
                                    Last Updated
                                  </span>
                                  <span className="font-medium text-white">
                                    {new Date(
                                      activityEvents[0].timestamp
                                    ).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-300">
                                    Contributors
                                  </span>
                                  <span className="font-medium text-white">
                                    {
                                      new Set(
                                        activityEvents.map((e) => e.user.id)
                                      ).size
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
                                    <Tooltip />
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

                          {/* SLA metrics visualization */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-700/30 rounded-lg p-5">
                              <h4 className="text-md font-medium text-white mb-3">
                                Response Time
                              </h4>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={responseTimeData}
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
                                      {responseTimeData.map((entry, index) => (
                                        <Cell
                                          key={`cell-${index}`}
                                          fill={COLORS[index % COLORS.length]}
                                        />
                                      ))}
                                    </Pie>
                                    <Tooltip
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
                                  <span className="text-gray-300">Created</span>
                                  <span className="text-gray-300">
                                    Oct 15, 10:30 AM
                                  </span>
                                </div>
                                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-blue-500 h-full"
                                    style={{ width: "100%" }}
                                  ></div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300">
                                    First Response
                                  </span>
                                  <span className="text-gray-300">
                                    Oct 15, 11:15 AM
                                  </span>
                                </div>
                                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-green-500 h-full"
                                    style={{ width: "100%" }}
                                  ></div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300">
                                    Resolution Target
                                  </span>
                                  <span className="text-gray-300">
                                    Oct 17, 10:30 AM
                                  </span>
                                </div>
                                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-yellow-500 h-full"
                                    style={{ width: "75%" }}
                                  ></div>
                                </div>

                                <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-md flex items-center">
                                  <FaExclamationCircle className="text-yellow-400 mr-2" />
                                  <span className="text-sm text-yellow-300">
                                    This ticket has reached 75% of its
                                    resolution SLA time
                                  </span>
                                </div>
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
                                <span className="text-green-400 flex items-center">
                                  <FaCheck className="mr-1" /> Met (45 minutes)
                                </span>
                              </div>
                              <div className="flex justify-between items-center pb-2 border-b border-gray-600">
                                <span className="text-gray-300">
                                  Resolution SLA
                                </span>
                                <span className="text-yellow-400 flex items-center">
                                  <FaClock className="mr-1" /> In Progress (75%
                                  elapsed)
                                </span>
                              </div>
                              <div className="flex justify-between items-center pb-2 border-b border-gray-600">
                                <span className="text-gray-300">
                                  SLA Policy
                                </span>
                                <span className="text-blue-400">
                                  High Priority - Server Issues
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">
                                  Business Hours
                                </span>
                                <span className="text-gray-300">
                                  Mon-Fri, 9:00 AM - 6:00 PM
                                </span>
                              </div>
                            </div>
                          </div>
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
          ticketId={ticket.id}
        />
      )}
    </>
  );
};

export default TicketsPage;
