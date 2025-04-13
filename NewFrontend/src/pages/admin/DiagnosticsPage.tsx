import React, { useState } from "react";
import {
  FaTools,
  FaSearch,
  FaDownload,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCheckCircle,
  FaDatabase,
  FaNetworkWired,
  FaServer,
  FaEnvelope,
  FaFileAlt,
  FaPlay,
  FaStop,
  FaSync,
  FaLock,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/buttons/Button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  service: string;
  message: string;
  details?: string;
}

interface DiagnosticTest {
  id: string;
  name: string;
  description: string;
  service: string;
  status: "idle" | "running" | "completed" | "failed";
  lastRun?: string;
  duration?: string;
  result?: string;
}

const DiagnosticsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [logLevelFilter, setLogLevelFilter] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  // const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);

  // Sample logs data
  const logs: LogEntry[] = [
    {
      id: "1",
      timestamp: "2023-10-16 14:30:22",
      level: "error",
      service: "api",
      message: "Database connection timeout",
      details: "Connection to database server timed out after 30 seconds",
    },
    {
      id: "2",
      timestamp: "2023-10-16 14:25:10",
      level: "warning",
      service: "auth",
      message: "Failed login attempt",
      details: "Multiple failed login attempts for user john.doe@example.com",
    },
    {
      id: "3",
      timestamp: "2023-10-16 14:20:33",
      level: "info",
      service: "email",
      message: "Email sent successfully",
      details: "Notification email sent to jane.smith@example.com",
    },
    {
      id: "4",
      timestamp: "2023-10-16 14:15:45",
      level: "debug",
      service: "api",
      message: "API request received",
      details: "GET /api/users?page=1&limit=10",
    },
    {
      id: "5",
      timestamp: "2023-10-16 14:10:18",
      level: "info",
      service: "file",
      message: "File uploaded successfully",
      details: "User john.doe@example.com uploaded file report.pdf (2.5MB)",
    },
    {
      id: "6",
      timestamp: "2023-10-16 14:05:30",
      level: "error",
      service: "email",
      message: "Failed to send email",
      details: "SMTP connection error: Connection refused",
    },
    {
      id: "7",
      timestamp: "2023-10-16 14:00:12",
      level: "warning",
      service: "api",
      message: "High API latency detected",
      details: "Average response time increased to 500ms",
    },
    {
      id: "8",
      timestamp: "2023-10-16 13:55:05",
      level: "info",
      service: "auth",
      message: "User logged in",
      details: "User robert.johnson@example.com logged in successfully",
    },
  ];

  // Sample diagnostic tests
  const diagnosticTests: DiagnosticTest[] = [
    {
      id: "1",
      name: "Database Connectivity",
      description: "Tests connection to the database server",
      service: "database",
      status: "idle",
      lastRun: "2023-10-16 10:30:00",
      duration: "2.5s",
      result: "Success",
    },
    {
      id: "2",
      name: "Email Service",
      description: "Verifies email sending functionality",
      service: "email",
      status: "idle",
      lastRun: "2023-10-16 09:45:00",
      duration: "3.2s",
      result: "Success",
    },
    {
      id: "3",
      name: "API Endpoints",
      description: "Tests all API endpoints for correct responses",
      service: "api",
      status: "idle",
      lastRun: "2023-10-16 08:15:00",
      duration: "5.7s",
      result: "Failed (2 endpoints unreachable)",
    },
    {
      id: "4",
      name: "File Storage",
      description: "Checks file upload and download functionality",
      service: "file",
      status: "idle",
      lastRun: "2023-10-15 15:20:00",
      duration: "4.1s",
      result: "Success",
    },
    {
      id: "5",
      name: "Authentication Service",
      description: "Tests login, logout, and token validation",
      service: "auth",
      status: "idle",
      lastRun: "2023-10-15 14:10:00",
      duration: "3.8s",
      result: "Success",
    },
    {
      id: "6",
      name: "Background Jobs",
      description: "Verifies background job processing",
      service: "jobs",
      status: "idle",
      lastRun: "2023-10-15 11:30:00",
      duration: "6.2s",
      result: "Success",
    },
    {
      id: "7",
      name: "Network Connectivity",
      description: "Tests network connectivity to external services",
      service: "network",
      status: "idle",
      lastRun: "2023-10-15 10:15:00",
      duration: "3.5s",
      result: "Success",
    },
    {
      id: "8",
      name: "System Health Check",
      description: "Comprehensive system health verification",
      service: "system",
      status: "idle",
      lastRun: "2023-10-14 16:45:00",
      duration: "12.3s",
      result: "Success",
    },
  ];

  // Filter logs based on search query and filters
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLevel = logLevelFilter ? log.level === logLevelFilter : true;

    const matchesService = serviceFilter ? log.service === serviceFilter : true;

    return matchesSearch && matchesLevel && matchesService;
  });

  // Get unique log levels and services
  const logLevels = Array.from(new Set(logs.map((log) => log.level)));
  const services = Array.from(new Set(logs.map((log) => log.service)));

  // Handle refresh
  const handleRefresh = () => {
    // Simulate refresh
    setTimeout(() => {
      console.log("Refreshed");
    }, 1000);
  };

  // Handle run diagnostic test
  const handleRunTest = (testId: string) => {
    setSelectedTest(testId);
    setTestRunning(true);

    // Simulate test running
    setTimeout(() => {
      setTestRunning(false);
    }, 3000);
  };

  // Handle stop diagnostic test
  const handleStopTest = () => {
    setTestRunning(false);
  };

  // Get log level badge color
  const getLogLevelBadgeColor = (level: string) => {
    switch (level) {
      case "info":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "debug":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get log level icon
  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case "info":
        return (
          <FaInfoCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        );
      case "warning":
        return (
          <FaExclamationTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        );
      case "error":
        return (
          <FaExclamationTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        );
      case "debug":
        return (
          <FaInfoCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        );
      default:
        return <FaInfoCircle className="h-4 w-4" />;
    }
  };

  // Get service icon
  const getServiceIcon = (service: string) => {
    switch (service) {
      case "api":
        return <FaServer className="h-4 w-4" />;
      case "auth":
        return <FaLock className="h-4 w-4" />;
      case "email":
        return <FaEnvelope className="h-4 w-4" />;
      case "file":
        return <FaFileAlt className="h-4 w-4" />;
      case "database":
        return <FaDatabase className="h-4 w-4" />;
      case "network":
        return <FaNetworkWired className="h-4 w-4" />;
      default:
        return <FaServer className="h-4 w-4" />;
    }
  };

  // Get test result icon
  const getTestResultIcon = (result: string | undefined) => {
    if (!result) return null;

    if (result.startsWith("Success")) {
      return (
        <FaCheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
      );
    } else if (result.startsWith("Failed")) {
      return (
        <FaExclamationTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
      );
    } else {
      return (
        <FaInfoCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      );
    }
  };

  // Animation variants for staggered animations
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
        stiffness: 100,
        damping: 12,
      },
    },
  };

  // Using auth hook for authentication
  useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-gray-200">
      <div className="flex min-h-screen flex-col">
        <TopNavbar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1">
          <div className="flex">
            <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
            <motion.div
              className="flex-1 p-8"
              initial="hidden"
              animate="visible"
              variants={containerVariants}
            >
              <motion.div variants={itemVariants} className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-3xl font-bold text-white flex items-center">
                      <FaTools className="mr-3 text-blue-500" /> Diagnostics
                    </h1>
                    <p className="text-gray-400 mt-1">
                      System diagnostics and troubleshooting tools
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={handleRefresh}
                      className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                    >
                      <FaSync className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => console.log("Exporting logs")}
                      className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                    >
                      <FaDownload className="mr-2 h-4 w-4" /> Export Logs
                    </Button>
                  </div>
                </div>
                <div className="w-full">
                  <Tabs defaultValue="status" className="w-full">
                    <TabsList className="mb-6 bg-gray-700/50 p-1">
                      <TabsTrigger
                        value="status"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                      >
                        System Status
                      </TabsTrigger>
                      <TabsTrigger
                        value="logs"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                      >
                        System Logs
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="status">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-gray-800/50 border-gray-700/50">
                          <CardHeader className="border-gray-700/50">
                            <CardTitle className="text-white">
                              System Health
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mr-3">
                                    <FaServer className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">
                                      API Server
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      Last checked: 2 minutes ago
                                    </p>
                                  </div>
                                </div>
                                <Badge className="bg-green-500 text-white">
                                  Online
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mr-3">
                                    <FaDatabase className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">
                                      Database
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      Last checked: 2 minutes ago
                                    </p>
                                  </div>
                                </div>
                                <Badge className="bg-green-500 text-white">
                                  Online
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 mr-3">
                                    <FaEnvelope className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">
                                      Email Service
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      Last checked: 2 minutes ago
                                    </p>
                                  </div>
                                </div>
                                <Badge className="bg-yellow-500 text-white">
                                  Degraded
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mr-3">
                                    <FaFileAlt className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-white">
                                      File Storage
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      Last checked: 2 minutes ago
                                    </p>
                                  </div>
                                </div>
                                <Badge className="bg-green-500 text-white">
                                  Online
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gray-800/50 border-gray-700/50">
                          <CardHeader className="border-gray-700/50">
                            <CardTitle className="text-white">
                              System Resources
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between items-center text-sm mb-1">
                                  <span className="text-gray-300">
                                    CPU Usage
                                  </span>
                                  <span className="text-gray-300">42%</span>
                                </div>
                                <Progress value={42} className="h-2" />
                              </div>
                              <div>
                                <div className="flex justify-between items-center text-sm mb-1">
                                  <span className="text-gray-300">
                                    Memory Usage
                                  </span>
                                  <span className="text-gray-300">68%</span>
                                </div>
                                <Progress value={68} className="h-2" />
                              </div>
                              <div>
                                <div className="flex justify-between items-center text-sm mb-1">
                                  <span className="text-gray-300">
                                    Disk Usage
                                  </span>
                                  <span className="text-gray-300">54%</span>
                                </div>
                                <Progress value={54} className="h-2" />
                              </div>
                              <div>
                                <div className="flex justify-between items-center text-sm mb-1">
                                  <span className="text-gray-300">Network</span>
                                  <span className="text-gray-300">23%</span>
                                </div>
                                <Progress value={23} className="h-2" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="logs">
                      <Card className="bg-gray-800/50 border-gray-700/50">
                        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-gray-700/50">
                          <div>
                            <CardTitle className="text-white">
                              System Logs
                            </CardTitle>
                            <CardDescription className="text-gray-400">
                              View and filter system log entries
                            </CardDescription>
                          </div>
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
                              value={logLevelFilter || ""}
                              onValueChange={(value) =>
                                setLogLevelFilter(value === "" ? null : value)
                              }
                            >
                              <SelectTrigger className="w-full sm:w-40 bg-gray-900/50 border-gray-700 text-white">
                                <SelectValue placeholder="Log Level" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                <SelectItem value="">All Levels</SelectItem>
                                {logLevels.map((level) => (
                                  <SelectItem key={level} value={level}>
                                    {level.charAt(0).toUpperCase() +
                                      level.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={serviceFilter || ""}
                              onValueChange={(value) =>
                                setServiceFilter(value === "" ? null : value)
                              }
                            >
                              <SelectTrigger className="w-full sm:w-40 bg-gray-900/50 border-gray-700 text-white">
                                <SelectValue placeholder="Service" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                <SelectItem value="">All Services</SelectItem>
                                {services.map((service) => (
                                  <SelectItem key={service} value={service}>
                                    {service.charAt(0).toUpperCase() +
                                      service.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {(searchQuery ||
                              logLevelFilter ||
                              serviceFilter) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSearchQuery("");
                                  setLogLevelFilter(null);
                                  setServiceFilter(null);
                                }}
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
                                <tr className="text-left border-b border-gray-700/50">
                                  <th className="px-4 py-3 font-medium text-gray-300">
                                    Timestamp
                                  </th>
                                  <th className="px-4 py-3 font-medium text-gray-300">
                                    Level
                                  </th>
                                  <th className="px-4 py-3 font-medium text-gray-300">
                                    Service
                                  </th>
                                  <th className="px-4 py-3 font-medium text-gray-300">
                                    Message
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredLogs.length > 0 ? (
                                  filteredLogs.map((log) => (
                                    <tr
                                      key={log.id}
                                      className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors duration-150"
                                    >
                                      <td className="px-4 py-3 text-sm text-gray-300">
                                        {log.timestamp}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center">
                                          {getLogLevelIcon(log.level)}
                                          <Badge
                                            className={`ml-2 ${getLogLevelBadgeColor(
                                              log.level
                                            )}`}
                                          >
                                            {log.level.charAt(0).toUpperCase() +
                                              log.level.slice(1)}
                                          </Badge>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center">
                                          <span className="mr-2">
                                            {getServiceIcon(log.service)}
                                          </span>
                                          <span className="text-gray-300">
                                            {log.service
                                              .charAt(0)
                                              .toUpperCase() +
                                              log.service.slice(1)}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="font-medium text-white">
                                          {log.message}
                                        </div>
                                        {log.details && (
                                          <div className="text-xs text-gray-400 mt-1">
                                            {log.details}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      className="px-4 py-8 text-center"
                                    >
                                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700 mb-4">
                                        <FaSearch className="h-6 w-6 text-gray-400" />
                                      </div>
                                      <h3 className="text-lg font-medium text-white">
                                        No logs found
                                      </h3>
                                      <p className="text-gray-400 mt-2">
                                        {searchQuery ||
                                        logLevelFilter ||
                                        serviceFilter
                                          ? "Try adjusting your filters"
                                          : "No logs available"}
                                      </p>
                                      {(searchQuery ||
                                        logLevelFilter ||
                                        serviceFilter) && (
                                        <Button
                                          variant="link"
                                          onClick={() => {
                                            setSearchQuery("");
                                            setLogLevelFilter(null);
                                            setServiceFilter(null);
                                          }}
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

                    <TabsContent value="diagnostics">
                      <Card>
                        <CardHeader>
                          <CardTitle>Diagnostic Tests</CardTitle>
                          <CardDescription>
                            Run diagnostic tests to verify system functionality
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                                  <th className="px-4 py-3 rounded-tl-lg font-medium">
                                    Test Name
                                  </th>
                                  <th className="px-4 py-3 font-medium">
                                    Service
                                  </th>
                                  <th className="px-4 py-3 font-medium">
                                    Last Run
                                  </th>
                                  <th className="px-4 py-3 font-medium">
                                    Duration
                                  </th>
                                  <th className="px-4 py-3 font-medium">
                                    Result
                                  </th>
                                  <th className="px-4 py-3 rounded-tr-lg font-medium text-right">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {diagnosticTests.map((test) => (
                                  <tr
                                    key={test.id}
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="font-medium">
                                        {test.name}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {test.description}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center">
                                        <span className="mr-2">
                                          {getServiceIcon(test.service)}
                                        </span>
                                        <span>
                                          {test.service
                                            .charAt(0)
                                            .toUpperCase() +
                                            test.service.slice(1)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      {test.lastRun}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      {test.duration}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center">
                                        {getTestResultIcon(test.result)}
                                        <span className="ml-2">
                                          {test.result}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {selectedTest === test.id &&
                                      testRunning ? (
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleStopTest()}
                                          className="w-24"
                                        >
                                          <FaStop className="h-4 w-4 mr-2" />
                                          Stop
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => handleRunTest(test.id)}
                                          className="w-24"
                                        >
                                          <FaPlay className="h-4 w-4 mr-2" />
                                          Run
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="tools">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Database Query Tool</CardTitle>
                            <CardDescription>
                              Execute database queries for troubleshooting
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="query" className="mb-2 block">
                                  SQL Query
                                </Label>
                                <Textarea
                                  id="query"
                                  placeholder="SELECT * FROM users LIMIT 10;"
                                  rows={5}
                                  className="font-mono"
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  onClick={() => console.log("Execute query")}
                                  className="w-full md:w-auto"
                                >
                                  Execute Query
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Network Diagnostics</CardTitle>
                            <CardDescription>
                              Test network connectivity to external services
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="host" className="mb-2 block">
                                  Host or IP Address
                                </Label>
                                <input
                                  id="host"
                                  placeholder="example.com or 192.168.1.1"
                                  className="w-full py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  onClick={() => console.log("Ping host")}
                                >
                                  Ping
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => console.log("Traceroute host")}
                                >
                                  Traceroute
                                </Button>
                                <Button
                                  onClick={() => console.log("Test connection")}
                                >
                                  Test Connection
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Email Test</CardTitle>
                            <CardDescription>
                              Send a test email to verify email functionality
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="email" className="mb-2 block">
                                  Recipient Email
                                </Label>
                                <input
                                  id="email"
                                  type="email"
                                  placeholder="test@example.com"
                                  className="w-full py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  onClick={() => console.log("Send test email")}
                                  className="w-full md:w-auto"
                                >
                                  Send Test Email
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Cache Management</CardTitle>
                            <CardDescription>
                              Clear system caches for troubleshooting
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-medium">
                                    Application Cache
                                  </h3>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Clear application-level cache
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    console.log("Clear application cache")
                                  }
                                >
                                  Clear
                                </Button>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-medium">
                                    Database Cache
                                  </h3>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Clear database query cache
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    console.log("Clear database cache")
                                  }
                                >
                                  Clear
                                </Button>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-medium">Session Cache</h3>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Clear user session cache
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    console.log("Clear session cache")
                                  }
                                >
                                  Clear
                                </Button>
                              </div>
                              <div className="pt-2">
                                <Button
                                  onClick={() =>
                                    console.log("Clear all caches")
                                  }
                                  className="w-full"
                                >
                                  Clear All Caches
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
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

export default DiagnosticsPage;
