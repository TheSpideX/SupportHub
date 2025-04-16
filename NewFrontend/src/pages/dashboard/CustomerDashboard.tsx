import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  FaTicketAlt,
  FaCheckCircle,
  FaPlus,
  FaUser,
  FaExclamationTriangle,
  FaQuestion,
  FaSpinner,
  FaExclamationCircle,
  FaArrowRight,
} from "react-icons/fa";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useGetMyQueriesQuery } from "@/features/tickets/api/queryApi";
import { useGetTicketStatisticsQuery } from "@/features/tickets/api/ticketApi";

const CustomerDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [expandedActivity, setExpandedActivity] = useState(true);
  const [userName, setUserName] = useState<string>("User");

  // Update username when user data is available
  useEffect(() => {
    if (isLoading) return; // Skip if still loading

    console.log("CustomerDashboard user data:", user);

    if (user?.name) {
      setUserName(user.name);
    } else if (user?.role === "admin") {
      setUserName("Admin");
    } else if (isAuthenticated) {
      // If authenticated but no name/role, use email or a default
      setUserName(user?.email || "Authenticated User");
    }
  }, [user, isAuthenticated, isLoading]);

  const navigate = useNavigate();

  // Fetch customer's queries
  const {
    data: queriesData,
    isLoading: isLoadingQueries,
    error: queriesError,
  } = useGetMyQueriesQuery({ limit: 5 });

  // Fetch ticket statistics
  const { data: statsData, isLoading: isLoadingStats } =
    useGetTicketStatisticsQuery();

  // Prepare stats data
  const stats = [
    {
      title: "Open Queries",
      value: statsData?.customerStats?.openQueries || "0",
      change: statsData?.customerStats?.openQueriesChange || "No change",
      icon: FaQuestion,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Resolved Queries",
      value: statsData?.customerStats?.resolvedQueries || "0",
      change: statsData?.customerStats?.resolvedQueriesChange || "No change",
      icon: FaCheckCircle,
      gradient: "from-green-500 to-green-600",
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
      }))
    : [];

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

  // Get recent activity from queries
  const recentActivity = queriesData?.data
    ? queriesData.data.slice(0, 3).map((query, index) => ({
        id: index,
        title: `Your query "${query.subject || query.title}" was ${
          query.status === "new" ? "created" : query.status.replace("_", " ")
        }`,
        time: formatDate(query.updatedAt),
        type:
          query.status === "new"
            ? "create"
            : query.status === "resolved"
            ? "reply"
            : "status",
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {userName}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Here's what's happening with your support tickets today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
          >
            <div className={`bg-gradient-to-r ${stat.gradient} px-6 py-4`}>
              <div className="flex items-center">
                <stat.icon className="h-8 w-8 text-white" />
                <h3 className="ml-3 text-lg font-medium text-white">
                  {stat.title}
                </h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stat.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* My Queries */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            My Queries
          </h3>
          <button
            onClick={() => navigate("/queries/create")}
            className="flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
          >
            <FaPlus className="h-3 w-3 mr-1" />
            New Query
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingQueries ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <FaSpinner className="animate-spin text-blue-500 text-2xl mx-auto mb-2" />
                    <p className="text-gray-400">Loading your queries...</p>
                  </td>
                </tr>
              ) : queriesError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <FaExclamationCircle className="text-red-500 text-2xl mx-auto mb-2" />
                    <p className="text-gray-400">
                      Error loading queries. Please try again.
                    </p>
                  </td>
                </tr>
              ) : myQueries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <FaQuestion className="text-gray-500 text-2xl mx-auto mb-2" />
                    <p className="text-gray-400">
                      You don't have any queries yet.
                    </p>
                    <button
                      onClick={() => navigate("/queries/create")}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-flex items-center"
                    >
                      <FaPlus className="mr-2" /> Create Your First Query
                    </button>
                  </td>
                </tr>
              ) : (
                myQueries.map((query) => (
                  <tr
                    key={query.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => navigate(`/queries/${query.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600 dark:text-primary-400">
                      {query.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {query.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          query.status === "new"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                            : query.status === "under_review"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                            : query.status === "resolved"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                            : query.status === "closed"
                            ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            : query.status === "converted"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          query.priority === "high" || query.priority === "High"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                            : query.priority === "medium" ||
                              query.priority === "Medium"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200"
                            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                        }`}
                      >
                        {query.priority.charAt(0).toUpperCase() +
                          query.priority.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {query.updated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/queries/${query.id}`);
                        }}
                        className="text-blue-500 hover:text-blue-400 transition-colors flex items-center"
                      >
                        View <FaArrowRight className="ml-1" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div
          className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
          onClick={() => setExpandedActivity(!expandedActivity)}
        >
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Recent Activity
          </h3>
          <span className="text-gray-500 dark:text-gray-400">
            {expandedActivity ? "−" : "+"}
          </span>
        </div>
        {expandedActivity && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="px-6 py-4 flex items-start">
                <div
                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    activity.type === "reply"
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : activity.type === "status"
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-purple-100 dark:bg-purple-900/30"
                  }`}
                >
                  <FaUser
                    className={`h-4 w-4 ${
                      activity.type === "reply"
                        ? "text-blue-600 dark:text-blue-400"
                        : activity.type === "status"
                        ? "text-green-600 dark:text-green-400"
                        : "text-purple-600 dark:text-purple-400"
                    }`}
                  />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {activity.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View All Queries Button */}
      <div className="flex justify-center">
        <button
          onClick={() => navigate("/queries")}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center shadow-lg hover:shadow-xl"
        >
          View All Queries <FaArrowRight className="ml-2" />
        </button>
      </div>
    </div>
  );
};

export default CustomerDashboard;
