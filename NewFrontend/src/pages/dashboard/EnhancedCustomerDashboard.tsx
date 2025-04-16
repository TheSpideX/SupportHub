import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FaQuestion,
  FaCheckCircle,
  FaUserClock,
  FaExclamationTriangle,
  FaChartLine,
  FaUsers,
  FaPlus,
  FaArrowRight,
  FaSpinner,
  FaExclamationCircle,
  FaUser,
  FaCalendarAlt,
  FaCommentAlt,
  FaSearch,
  FaFilter,
  FaSort,
  FaEye,
  FaChartBar,
  FaTicketAlt,
  FaInfoCircle,
  FaBell,
} from "react-icons/fa";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTheme } from "next-themes";
import { useGetMyQueriesQuery } from "@/features/tickets/api/queryApi";
import { useGetTicketStatisticsQuery } from "@/features/tickets/api/ticketApi";
import EnhancedStatCard from "@/components/dashboard/EnhancedStatCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/buttons/Button";
import { Tooltip } from "@/components/ui/tooltip";
import EnhancedCustomerPageTemplate from "@/components/dashboard/EnhancedCustomerPageTemplate";

const EnhancedCustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<
    "day" | "week" | "month"
  >("week");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch customer's queries
  const {
    data: queriesData,
    isLoading: isLoadingQueries,
    error: queriesError,
  } = useGetMyQueriesQuery({ limit: 5 });

  // Fetch ticket statistics
  const { data: statsData, isLoading: isLoadingStats } =
    useGetTicketStatisticsQuery();

  // Format date helper function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
      }
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  // Enhanced stats with more metrics
  const stats = [
    {
      title: "Open Queries",
      value: statsData?.customerStats?.openQueries || "0",
      change: statsData?.customerStats?.openQueriesChange || "No change",
      icon: FaQuestion,
      color: "bg-blue-500",
      gradient: "from-blue-500 to-blue-600",
      trend: "neutral",
      info: "Your currently open support queries",
    },
    {
      title: "Resolved Queries",
      value: statsData?.customerStats?.resolvedQueries || "0",
      change: statsData?.customerStats?.resolvedQueriesChange || "No change",
      icon: FaCheckCircle,
      color: "bg-green-500",
      gradient: "from-green-500 to-green-600",
      trend: "neutral",
      info: "Queries that have been resolved",
    },
    {
      title: "Average Response",
      value: statsData?.customerStats?.avgResponseTime || "N/A",
      change: "Based on your recent queries",
      icon: FaUserClock,
      color: "bg-yellow-500",
      gradient: "from-yellow-500 to-yellow-600",
      trend: "neutral",
      info: "Average time to first response",
    },
    {
      title: "Satisfaction Rate",
      value: statsData?.customerStats?.satisfactionRate || "N/A",
      change: "Based on your feedback",
      icon: FaChartLine,
      color: "bg-purple-500",
      gradient: "from-purple-500 to-purple-600",
      trend: "neutral",
      info: "Your satisfaction with our support",
    },
  ];

  // Format queries for display
  const myQueries = queriesData?.data
    ? queriesData.data.map((query) => ({
        id: query.queryNumber || query._id.substring(0, 8),
        title: query.subject || query.title,
        status: query.status,
        priority: query.priority || "medium",
        updated: formatDate(query.updatedAt),
        createdAt: new Date(query.createdAt),
      }))
    : [];

  // Get recent activity from queries
  const activities = queriesData?.data
    ? queriesData.data.slice(0, 5).map((query, index) => ({
        id: query._id || `activity-${index}`,
        type: query.status === "resolved" ? "ticket" : "user",
        action:
          query.status === "new"
            ? "Created new query:"
            : query.status === "resolved"
            ? "Query resolved:"
            : "Updated query status to " + query.status.replace("_", " ") + ":",
        subject: query.subject || query.title,
        timestamp: query.updatedAt,
        status:
          query.status === "resolved"
            ? "success"
            : query.status === "new"
            ? "info"
            : "warning",
        user: {
          name: user?.name || "You",
          avatar: user?.avatar,
          role: "Customer",
        },
      }))
    : [];

  // Handle refresh
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
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

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
      },
    },
  };

  return (
    <EnhancedCustomerPageTemplate
      title="Customer Dashboard"
      description="Monitor and manage your support queries"
      icon={FaUser}
    >
      <motion.div
        className="max-w-7xl mx-auto space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Welcome Section */}
        <motion.div
          className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
          variants={itemVariants}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                Welcome back, {user?.name || "Customer"}
              </h1>
              <p className="mt-1 text-gray-300">
                Here's an overview of your support queries and activity
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-3">
              <select
                value={selectedPeriod}
                onChange={(e) =>
                  setSelectedPeriod(e.target.value as "day" | "week" | "month")
                }
                className="bg-gray-700/50 border border-gray-600/50 rounded-lg py-2 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="day">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <Button
                variant="outline"
                onClick={handleRefresh}
                className="bg-gray-700/50 border-gray-600/50 text-gray-200 hover:bg-gray-600/50 hover:text-white"
              >
                {isLoading ? (
                  <FaSpinner className="h-4 w-4 animate-spin" />
                ) : (
                  <FaArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Decorative elements */}
          <div className="absolute -top-6 -left-6 w-12 h-12 rounded-full bg-blue-500/10 blur-xl" />
          <div className="absolute -bottom-6 -right-6 w-12 h-12 rounded-full bg-purple-500/10 blur-xl" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <EnhancedStatCard
                  title={stat.title}
                  value={stat.value}
                  change={stat.change}
                  icon={stat.icon}
                  color={stat.color}
                  gradient={stat.gradient}
                  trend={stat.trend as "up" | "down" | "neutral"}
                  info={stat.info}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Queries */}
          <motion.div
            className="lg:col-span-2 relative"
            variants={itemVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="absolute -top-6 left-12 w-12 h-12 rounded-full bg-blue-500/10 blur-xl" />
            <div className="absolute -bottom-6 right-24 w-12 h-12 rounded-full bg-cyan-500/10 blur-xl" />

            <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300">
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center bg-gradient-to-r from-blue-600/20 to-blue-600/5">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                    <FaQuestion className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      My Queries
                    </h3>
                    <p className="text-xs text-gray-400">
                      Your recent support queries
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {myQueries.length} total
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/queries/create")}
                    className="bg-gray-700/50 border-gray-600/50 text-gray-200 hover:bg-gray-600/50 hover:text-white"
                  >
                    <FaPlus className="h-3 w-3 mr-1" /> New
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700/50">
                  <thead>
                    <tr className="bg-gray-800/30">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider rounded-l-lg">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider rounded-r-lg">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {isLoadingQueries ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <FaSpinner className="animate-spin text-blue-500 text-2xl mx-auto mb-2" />
                          <p className="text-gray-400">
                            Loading your queries...
                          </p>
                        </td>
                      </tr>
                    ) : queriesError ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <FaExclamationCircle className="text-red-500 text-2xl mx-auto mb-2" />
                          <p className="text-gray-400">
                            Error loading queries. Please try again.
                          </p>
                        </td>
                      </tr>
                    ) : myQueries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <FaQuestion className="text-gray-500 text-2xl mx-auto mb-2" />
                          <p className="text-gray-400">
                            You don't have any queries yet.
                          </p>
                          <Button
                            onClick={() => navigate("/queries/create")}
                            className="mt-4"
                          >
                            <FaPlus className="mr-2" /> Create Your First Query
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      myQueries.map((query) => (
                        <tr
                          key={query.id}
                          className="hover:bg-gray-700/30 cursor-pointer transition-colors"
                          onClick={() => navigate(`/queries/${query.id}`)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-400">
                            {query.id}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                            {query.title}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                query.status === "new"
                                  ? "bg-blue-500/20 text-blue-300"
                                  : query.status === "under_review"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : query.status === "resolved"
                                  ? "bg-green-500/20 text-green-300"
                                  : query.status === "closed"
                                  ? "bg-gray-500/20 text-gray-300"
                                  : query.status === "converted"
                                  ? "bg-purple-500/20 text-purple-300"
                                  : "bg-gray-500/20 text-gray-300"
                              }`}
                            >
                              {query.status === "new"
                                ? "New"
                                : query.status === "under_review"
                                ? "Under Review"
                                : query.status === "resolved"
                                ? "Resolved"
                                : query.status === "closed"
                                ? "Closed"
                                : query.status === "converted"
                                ? "Converted"
                                : query.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                query.priority === "high" ||
                                query.priority === "High"
                                  ? "bg-red-500/20 text-red-300"
                                  : query.priority === "medium" ||
                                    query.priority === "Medium"
                                  ? "bg-orange-500/20 text-orange-300"
                                  : "bg-green-500/20 text-green-300"
                              }`}
                            >
                              {query.priority.charAt(0).toUpperCase() +
                                query.priority.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {query.updated}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-gray-700/50 flex justify-center">
                <Button
                  onClick={() => navigate("/queries")}
                  variant="outline"
                  className="bg-gray-700/50 border-gray-600/50 text-gray-200 hover:bg-gray-600/50 hover:text-white"
                >
                  View All Queries <FaArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="relative"
          >
            <div className="absolute -top-6 left-24 w-12 h-12 rounded-full bg-purple-500/10 blur-xl" />

            <ActivityFeed
              activities={activities}
              title="Recent Activity"
              onViewAll={() => navigate("/queries")}
              className="shadow-lg shadow-purple-900/5 border-purple-500/20 hover:shadow-purple-900/10 hover:border-purple-500/30"
            />
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-indigo-500/30 transition-all duration-300"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <FaBell className="mr-2 text-indigo-400" /> Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => navigate("/queries/create")}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 h-auto py-4"
            >
              <div className="flex flex-col items-center">
                <FaPlus className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Create New Query</span>
                <span className="text-xs mt-1 text-blue-200">
                  Get support for an issue
                </span>
              </div>
            </Button>
            <Button
              onClick={() => navigate("/queries")}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 h-auto py-4"
            >
              <div className="flex flex-col items-center">
                <FaEye className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">View All Queries</span>
                <span className="text-xs mt-1 text-purple-200">
                  Check status of all queries
                </span>
              </div>
            </Button>
            <Button
              onClick={() => navigate("/profile")}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 h-auto py-4"
            >
              <div className="flex flex-col items-center">
                <FaUser className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Manage Profile</span>
                <span className="text-xs mt-1 text-green-200">
                  Update your information
                </span>
              </div>
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </EnhancedCustomerPageTemplate>
  );
};

export default EnhancedCustomerDashboard;
