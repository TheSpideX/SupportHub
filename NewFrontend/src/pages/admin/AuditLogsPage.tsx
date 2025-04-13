import React, { useState } from "react";
import {
  FaHistory,
  FaSearch,
  FaDownload,
  FaCalendarAlt,
  FaUser,
  FaExclamationTriangle,
  FaInfoCircle,
  FaEye,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/buttons/Button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  action: string;
  category: "user" | "ticket" | "system" | "security";
  severity: "info" | "warning" | "critical";
  user: {
    id: string;
    name: string;
    email: string;
  };
  ip: string;
  timestamp: string;
  details: string;
}

const AuditLogsPage: React.FC = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
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

  // Sample audit logs data
  const auditLogs: AuditLog[] = [
    {
      id: "1",
      action: "User Login",
      category: "user",
      severity: "info",
      user: {
        id: "101",
        name: "John Doe",
        email: "john.doe@example.com",
      },
      ip: "192.168.1.1",
      timestamp: "2023-10-16 14:30:22",
      details: "Successful login from Chrome on Windows",
    },
    {
      id: "2",
      action: "Ticket Created",
      category: "ticket",
      severity: "info",
      user: {
        id: "102",
        name: "Jane Smith",
        email: "jane.smith@example.com",
      },
      ip: "192.168.1.2",
      timestamp: "2023-10-16 14:25:10",
      details: "Created ticket #1234: 'Server Down'",
    },
    {
      id: "3",
      action: "Permission Changed",
      category: "security",
      severity: "warning",
      user: {
        id: "101",
        name: "John Doe",
        email: "john.doe@example.com",
      },
      ip: "192.168.1.1",
      timestamp: "2023-10-16 13:45:33",
      details:
        "Changed role for user 'jane.smith@example.com' from 'Support' to 'Admin'",
    },
    {
      id: "4",
      action: "System Backup",
      category: "system",
      severity: "info",
      user: {
        id: "103",
        name: "System",
        email: "system@example.com",
      },
      ip: "127.0.0.1",
      timestamp: "2023-10-16 12:30:15",
      details: "Automated daily backup completed successfully",
    },
    {
      id: "5",
      action: "Failed Login Attempt",
      category: "security",
      severity: "critical",
      user: {
        id: "unknown",
        name: "Unknown",
        email: "unknown",
      },
      ip: "203.0.113.1",
      timestamp: "2023-10-16 11:20:05",
      details: "Multiple failed login attempts for user 'admin@example.com'",
    },
    {
      id: "6",
      action: "Ticket Deleted",
      category: "ticket",
      severity: "warning",
      user: {
        id: "101",
        name: "John Doe",
        email: "john.doe@example.com",
      },
      ip: "192.168.1.1",
      timestamp: "2023-10-16 10:15:30",
      details: "Deleted ticket #1235: 'Network Issue'",
    },
    {
      id: "7",
      action: "Configuration Changed",
      category: "system",
      severity: "warning",
      user: {
        id: "101",
        name: "John Doe",
        email: "john.doe@example.com",
      },
      ip: "192.168.1.1",
      timestamp: "2023-10-16 09:45:12",
      details: "Changed system email configuration",
    },
    {
      id: "8",
      action: "User Created",
      category: "user",
      severity: "info",
      user: {
        id: "101",
        name: "John Doe",
        email: "john.doe@example.com",
      },
      ip: "192.168.1.1",
      timestamp: "2023-10-15 16:30:45",
      details: "Created new user 'robert.johnson@example.com'",
    },
  ];

  // Filter audit logs based on search query and filters
  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter
      ? log.category === categoryFilter
      : true;

    const matchesSeverity = severityFilter
      ? log.severity === severityFilter
      : true;

    // Filter by date range if set
    let matchesDateRange = true;
    if (dateRange.from || dateRange.to) {
      const logDate = new Date(log.timestamp);

      if (dateRange.from && dateRange.to) {
        matchesDateRange = logDate >= dateRange.from && logDate <= dateRange.to;
      } else if (dateRange.from) {
        matchesDateRange = logDate >= dateRange.from;
      } else if (dateRange.to) {
        matchesDateRange = logDate <= dateRange.to;
      }
    }

    return (
      matchesSearch && matchesCategory && matchesSeverity && matchesDateRange
    );
  });

  // Get unique categories and severities
  const categories = Array.from(new Set(auditLogs.map((log) => log.category)));
  const severities = Array.from(new Set(auditLogs.map((log) => log.severity)));

  // Handle view log details
  const handleViewLogDetails = (logId: string) => {
    console.log(`Viewing details for log ${logId}`);
  };

  // Get category badge color
  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "user":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "ticket":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "system":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      case "security":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get severity badge color
  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "info":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "info":
        return (
          <FaInfoCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        );
      case "warning":
        return (
          <FaExclamationTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        );
      case "critical":
        return (
          <FaExclamationTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        );
      default:
        return <FaInfoCircle className="h-4 w-4" />;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter(null);
    setSeverityFilter(null);
    setDateRange({ from: undefined, to: undefined });
  };

  // Export logs
  const exportLogs = () => {
    console.log("Exporting logs", filteredLogs);
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
                    <FaHistory className="h-8 w-8 text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                      Audit Logs
                    </h1>
                    <p className="mt-1 text-gray-300">
                      View and analyze system activity logs
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-gray-700/80 hover:bg-gray-600 text-white shadow-md flex items-center gap-2"
                    onClick={exportLogs}
                  >
                    <FaDownload className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 p-6"
              variants={itemVariants}
            >
              <Tabs defaultValue="all-logs" className="w-full">
                <TabsList className="mb-6 bg-gray-700/50 p-1">
                  <TabsTrigger
                    value="all-logs"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    All Logs
                  </TabsTrigger>
                  <TabsTrigger
                    value="user-activity"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    User Activity
                  </TabsTrigger>
                  <TabsTrigger
                    value="system-events"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    System Events
                  </TabsTrigger>
                  <TabsTrigger
                    value="security-events"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Security Events
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all-logs">
                  <Card className="bg-gray-800/50 border-gray-700/50">
                    <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-gray-700/50">
                      <CardTitle className="text-white">Audit Logs</CardTitle>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-64 relative">
                          <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                            <FaSearch />
                          </div>
                          <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2 px-10 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                        </div>

                        <Select
                          value={categoryFilter || ""}
                          onValueChange={(value) =>
                            setCategoryFilter(value === "" ? null : value)
                          }
                        >
                          <SelectTrigger className="w-full sm:w-40 bg-gray-900/50 border-gray-700 text-white">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            <SelectItem value="">All Categories</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category.charAt(0).toUpperCase() +
                                  category.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={severityFilter || ""}
                          onValueChange={(value) =>
                            setSeverityFilter(value === "" ? null : value)
                          }
                        >
                          <SelectTrigger className="w-full sm:w-40 bg-gray-900/50 border-gray-700 text-white">
                            <SelectValue placeholder="Severity" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            <SelectItem value="">All Severities</SelectItem>
                            {severities.map((severity) => (
                              <SelectItem key={severity} value={severity}>
                                {severity.charAt(0).toUpperCase() +
                                  severity.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full sm:w-auto flex items-center justify-center gap-2 border-gray-700 hover:bg-gray-700/50 text-gray-300"
                            >
                              <FaCalendarAlt className="h-4 w-4" />
                              <span>
                                {dateRange.from
                                  ? dateRange.to
                                    ? `${format(
                                        dateRange.from,
                                        "PP"
                                      )} - ${format(dateRange.to, "PP")}`
                                    : format(dateRange.from, "PP")
                                  : "Date Range"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0 bg-gray-800 border-gray-700"
                            align="end"
                          >
                            <Calendar
                              mode="range"
                              selected={dateRange}
                              onSelect={(range) =>
                                setDateRange(
                                  range || { from: undefined, to: undefined }
                                )
                              }
                              className="bg-gray-800 text-white"
                            />
                          </PopoverContent>
                        </Popover>

                        {(searchQuery ||
                          categoryFilter ||
                          severityFilter ||
                          dateRange.from ||
                          dateRange.to) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="w-full sm:w-auto text-gray-300 hover:text-white hover:bg-gray-700/50"
                          >
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                              <th className="px-4 py-3 rounded-tl-lg font-medium">
                                Timestamp
                              </th>
                              <th className="px-4 py-3 font-medium">Action</th>
                              <th className="px-4 py-3 font-medium">
                                Category
                              </th>
                              <th className="px-4 py-3 font-medium">
                                Severity
                              </th>
                              <th className="px-4 py-3 font-medium">User</th>
                              <th className="px-4 py-3 font-medium">
                                IP Address
                              </th>
                              <th className="px-4 py-3 rounded-tr-lg font-medium text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredLogs.length > 0 ? (
                              filteredLogs.map((log) => (
                                <tr
                                  key={log.id}
                                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                  <td className="px-4 py-3 text-sm">
                                    {log.timestamp}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium">
                                      {log.action}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      className={getCategoryBadgeColor(
                                        log.category
                                      )}
                                    >
                                      {log.category.charAt(0).toUpperCase() +
                                        log.category.slice(1)}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center">
                                      {getSeverityIcon(log.severity)}
                                      <Badge
                                        className={`ml-2 ${getSeverityBadgeColor(
                                          log.severity
                                        )}`}
                                      >
                                        {log.severity.charAt(0).toUpperCase() +
                                          log.severity.slice(1)}
                                      </Badge>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium">
                                      {log.user.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {log.user.email}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    {log.ip}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() =>
                                        handleViewLogDetails(log.id)
                                      }
                                      title="View Details"
                                    >
                                      <FaEye className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="px-4 py-8 text-center"
                                >
                                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                                    <FaSearch className="h-6 w-6 text-gray-400" />
                                  </div>
                                  <h3 className="text-lg font-medium">
                                    No logs found
                                  </h3>
                                  <p className="text-gray-500 dark:text-gray-400 mt-2">
                                    {searchQuery ||
                                    categoryFilter ||
                                    severityFilter ||
                                    dateRange.from ||
                                    dateRange.to
                                      ? "Try adjusting your filters"
                                      : "No audit logs available"}
                                  </p>
                                  {(searchQuery ||
                                    categoryFilter ||
                                    severityFilter ||
                                    dateRange.from ||
                                    dateRange.to) && (
                                    <Button
                                      variant="link"
                                      onClick={clearFilters}
                                      className="mt-2"
                                    >
                                      Clear filters
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="user-activity">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                          <FaUser className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium">User Activity</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                          View user login, logout, and account changes
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="system-events">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                          <FaInfoCircle className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium">System Events</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                          View system maintenance and configuration changes
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="security-events">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                          <FaExclamationTriangle className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium">Security Events</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                          View security-related events and potential issues
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </motion.div>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default AuditLogsPage;
