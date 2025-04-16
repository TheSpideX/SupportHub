import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaTicketAlt,
  FaUserClock,
  FaChartLine,
  FaUsers,
  FaExclamationTriangle,
  FaComments,
  FaClipboardCheck,
  FaSearch,
  FaFilter,
  FaEllipsisH,
  FaArrowRight,
  FaBars,
} from "react-icons/fa";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useGetTicketStatisticsQuery } from "@/features/tickets/api/ticketApi";
import { useGetMyAssignedQueriesQuery } from "@/features/tickets/api/queryApi";
import { Link } from "react-router-dom";
import Footer from "@/components/dashboard/Footer";
import Sidebar from "@/components/dashboard/Sidebar";
import TopNavbar from "@/components/dashboard/TopNavbar";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Tooltip } from "@/components/ui/tooltip";

const EnhancedSupportDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: statsData, isLoading: isLoadingStats } =
    useGetTicketStatisticsQuery();
  const { data: queriesData, isLoading: isLoadingQueries } =
    useGetMyAssignedQueriesQuery();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      transition: { type: "spring", stiffness: 100 },
    },
  };

  if (isLoadingStats || isLoadingQueries) {
    return <DashboardSkeleton role="support" />;
  }

  // Prepare stats data
  const stats = [
    {
      title: "Assigned Queries",
      value: queriesData?.data?.length || "0",
      change: "Requiring attention",
      icon: FaComments,
      color: "bg-blue-500",
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Assigned Tickets",
      value: statsData?.supportMemberStats?.assignedTickets || "0",
      change: "Active tickets",
      icon: FaTicketAlt,
      color: "bg-purple-500",
      gradient: "from-purple-500 to-purple-600",
    },
    {
      title: "Avg. Response Time",
      value: statsData?.supportMemberStats?.avgResponseTime || "0h",
      change: "Your performance",
      icon: FaUserClock,
      color: "bg-green-500",
      gradient: "from-green-500 to-green-600",
    },
    {
      title: "Resolved This Week",
      value: statsData?.supportMemberStats?.resolvedThisWeek || "0",
      change: "Tickets & queries",
      icon: FaClipboardCheck,
      color: "bg-amber-500",
      gradient: "from-amber-500 to-amber-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      <TopNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          userRole={user?.role}
        />

        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <h1 className="text-3xl font-bold text-white">
                Welcome back, {user?.name || "Support Agent"}
              </h1>
              <p className="mt-2 text-gray-300">
                You have{" "}
                {queriesData?.data?.filter((q) => q.status === "new").length ||
                  0}{" "}
                new queries and{" "}
                {statsData?.supportMemberStats?.urgentTickets || 0} urgent
                tickets requiring attention.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 gap-6"
            >
              {/* Stats Cards */}
              <motion.div
                variants={itemVariants}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                    whileHover={{
                      y: -5,
                      scale: 1.02,
                      transition: { duration: 0.2 },
                    }}
                  >
                    <div
                      className={`px-6 py-4 border-b border-gray-700/70 flex items-center`}
                    >
                      <div className={`p-2 rounded-lg ${stat.color}/20`}>
                        <stat.icon
                          className={`h-5 w-5 text-${stat.color.replace(
                            "bg-",
                            ""
                          )}`}
                        />
                      </div>
                      <h3 className="ml-3 text-sm font-medium text-gray-200">
                        {stat.title}
                      </h3>
                    </div>
                    <div className="px-6 py-4">
                      <div className="text-2xl font-bold text-white">
                        {stat.value}
                      </div>
                      <p className="mt-1 text-sm text-gray-400">
                        {stat.change}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Assigned Queries Section */}
              <motion.div
                variants={itemVariants}
                className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              >
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaComments className="h-5 w-5 text-blue-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">
                      My Assigned Queries
                    </h3>
                  </div>
                  <Link
                    to="/queries"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View All
                  </Link>
                </div>
                <div className="p-6">
                  {queriesData?.data?.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">
                        No queries assigned to you yet.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              Query ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              Subject
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              Customer
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              Created
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {queriesData?.data?.slice(0, 5).map((query: any) => (
                            <tr
                              key={query._id}
                              className="hover:bg-gray-700/50 transition-colors"
                            >
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-white">
                                  {query.queryNumber}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">
                                  {query.subject}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">
                                  {query.customer?.name ||
                                    query.customerId?.profile?.firstName ||
                                    "Customer"}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge
                                  variant={
                                    query.status === "new"
                                      ? "destructive"
                                      : query.status === "under_review"
                                      ? "warning"
                                      : query.status === "converted"
                                      ? "success"
                                      : "default"
                                  }
                                >
                                  {query.status.replace("_", " ")}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">
                                  {query.createdAt
                                    ? formatDistanceToNow(
                                        new Date(query.createdAt),
                                        { addSuffix: true }
                                      )
                                    : "N/A"}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex space-x-2">
                                  <Link
                                    to={`/queries?id=${query._id}`}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                                  >
                                    View
                                  </Link>
                                  {query.status !== "converted" && (
                                    <Link
                                      to={`/queries?id=${query._id}&action=convert`}
                                      className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded flex items-center"
                                    >
                                      <FaArrowRight className="mr-1 h-3 w-3" />{" "}
                                      Convert
                                    </Link>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Urgent Tickets Section */}
              <motion.div
                variants={itemVariants}
                className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-red-500/30 transition-all duration-300"
              >
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaExclamationTriangle className="h-5 w-5 text-red-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">
                      Urgent Tickets
                    </h3>
                  </div>
                  <Link
                    to="/tickets"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View All Tickets
                  </Link>
                </div>
                <div className="p-6">
                  {!statsData?.supportMemberStats?.urgentTickets ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">
                        No urgent tickets at the moment.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* This would be populated with actual urgent tickets data */}
                      <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-white">
                              TKT-2023-00123
                            </h4>
                            <p className="text-sm text-gray-300 mt-1">
                              Server outage in production
                            </p>
                          </div>
                          <Badge variant="destructive">Critical</Badge>
                        </div>
                        <div className="mt-3 flex justify-between items-center">
                          <span className="text-xs text-gray-400">
                            2 hours ago
                          </span>
                          <Link
                            to="/tickets/TKT-2023-00123"
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                          >
                            Respond Now
                          </Link>
                        </div>
                      </div>

                      <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-white">
                              TKT-2023-00125
                            </h4>
                            <p className="text-sm text-gray-300 mt-1">
                              Payment gateway integration failing
                            </p>
                          </div>
                          <Badge variant="destructive">Critical</Badge>
                        </div>
                        <div className="mt-3 flex justify-between items-center">
                          <span className="text-xs text-gray-400">
                            1 hour ago
                          </span>
                          <Link
                            to="/tickets/TKT-2023-00125"
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                          >
                            Respond Now
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Performance Metrics */}
              <motion.div
                variants={itemVariants}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-green-500/30 transition-all duration-300">
                  <div className="px-6 py-4 border-b border-gray-700/70">
                    <h3 className="text-lg font-semibold text-white">
                      Response Time
                    </h3>
                  </div>
                  <div className="p-6 flex flex-col items-center justify-center">
                    <div className="text-4xl font-bold text-green-400">
                      {statsData?.supportMemberStats?.avgResponseTime || "0h"}
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                      Your average response time
                    </p>
                    <div className="mt-4 w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-green-500 h-full rounded-full"
                        style={{ width: "70%" }}
                      ></div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Target: 1.5h</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300">
                  <div className="px-6 py-4 border-b border-gray-700/70">
                    <h3 className="text-lg font-semibold text-white">
                      Resolution Rate
                    </h3>
                  </div>
                  <div className="p-6 flex flex-col items-center justify-center">
                    <div className="text-4xl font-bold text-blue-400">
                      {statsData?.supportMemberStats?.resolutionRate || "0%"}
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                      First contact resolution rate
                    </p>
                    <div className="mt-4 w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: "85%" }}
                      ></div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Target: 80%</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300">
                  <div className="px-6 py-4 border-b border-gray-700/70">
                    <h3 className="text-lg font-semibold text-white">
                      Customer Satisfaction
                    </h3>
                  </div>
                  <div className="p-6 flex flex-col items-center justify-center">
                    <div className="text-4xl font-bold text-purple-400">
                      {statsData?.supportMemberStats?.satisfactionRate || "0%"}
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                      Based on customer feedback
                    </p>
                    <div className="mt-4 w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full"
                        style={{ width: "92%" }}
                      ></div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Target: 90%</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default EnhancedSupportDashboard;
