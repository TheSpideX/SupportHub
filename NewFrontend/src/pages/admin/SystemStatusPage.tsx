import React, { useState, useEffect } from "react";
import {
  FaServer,
  FaSync,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaDatabase,
  FaNetworkWired,
  FaMemory,
  FaMicrochip,
  FaCloudUploadAlt,
  FaLock,
  FaChartBar,
  FaUsers,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";
import { Button } from "@/components/ui/buttons/Button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import systemApi, {
  SystemComponent,
  SystemIncident,
  SystemMetrics,
  SystemStatus,
} from "@/api/systemApi";
import { toast } from "react-hot-toast";
import DataSourceIndicator from "@/components/system/DataSourceIndicator";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

const SystemStatusPage: React.FC = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemIncidents, setSystemIncidents] = useState<SystemIncident[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(
    null
  );
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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

  // Fetch system status data
  const fetchSystemStatus = async () => {
    try {
      const status = await systemApi.getSystemStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error("Error fetching system status:", error);
      toast.error("Failed to fetch system status");
    }
  };

  // Fetch system incidents
  const fetchSystemIncidents = async () => {
    try {
      const incidents = await systemApi.getSystemIncidents();
      setSystemIncidents(incidents);
    } catch (error) {
      console.error("Error fetching system incidents:", error);
      toast.error("Failed to fetch system incidents");
    }
  };

  // Fetch system metrics
  const fetchSystemMetrics = async () => {
    try {
      const metrics = await systemApi.getSystemMetrics();
      setSystemMetrics(metrics);
    } catch (error) {
      console.error("Error fetching system metrics:", error);
      toast.error("Failed to fetch system metrics");
    }
  };

  // Fetch all system data
  const fetchAllSystemData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchSystemStatus(),
        fetchSystemIncidents(),
        fetchSystemMetrics(),
      ]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching system data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchAllSystemData();
  }, []);

  // Add keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+R to refresh data
      if (e.altKey && e.key === "r") {
        e.preventDefault();
        handleRefresh();
      }

      // Alt+S to toggle sidebar
      if (e.altKey && e.key === "s") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    fetchAllSystemData();
  };

  // Get status badge color
  const getStatusBadgeColor = (status: SystemComponent["status"]) => {
    switch (status) {
      case "operational":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "outage":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "maintenance":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  // Get incident status badge color
  const getIncidentStatusBadgeColor = (status: SystemIncident["status"]) => {
    if (!status)
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";

    switch (status) {
      case "investigating":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "identified":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "monitoring":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  // Get incident severity badge color
  const getIncidentSeverityBadgeColor = (
    severity: SystemIncident["severity"]
  ) => {
    if (!severity)
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";

    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "major":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "minor":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  // Get metric status color
  const getMetricStatusColor = (status?: string) => {
    switch (status) {
      case "normal":
        return "text-green-600 dark:text-green-400";
      case "warning":
        return "text-yellow-600 dark:text-yellow-400";
      case "critical":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  // Get component icon
  const getComponentIcon = (name: string) => {
    if (name.toLowerCase().includes("database")) return FaDatabase;
    if (name.toLowerCase().includes("api")) return FaNetworkWired;
    if (name.toLowerCase().includes("auth")) return FaLock;
    if (name.toLowerCase().includes("storage")) return FaCloudUploadAlt;
    return FaServer;
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
          <ErrorBoundary>
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
                      <FaServer className="h-8 w-8 text-blue-500" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                        System Status
                      </h1>
                      <p className="mt-1 text-gray-300">
                        Monitor system health and performance
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                        <span className="bg-gray-800 px-2 py-1 rounded-md flex items-center">
                          <kbd className="px-1 bg-gray-700 rounded mr-1">
                            Alt
                          </kbd>
                          +
                          <kbd className="px-1 bg-gray-700 rounded mx-1">R</kbd>
                          Refresh Data
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
                      className="bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center font-medium"
                      onClick={handleRefresh}
                      title="Refresh system status data"
                      disabled={isRefreshing}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 mr-2 ${
                          isRefreshing ? "animate-spin" : ""
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
                      Refresh Data
                    </Button>
                  </div>
                </div>
              </motion.div>
              {/* System Status Overview */}
              <motion.div
                className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                variants={itemVariants}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-medium text-white">
                      System Status
                    </h2>
                    <p className="text-sm text-gray-300">
                      Last updated: {lastUpdated.toLocaleString()}
                      {isRefreshing && " (Refreshing...)"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center">
                      <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                      <span className="text-sm text-gray-200">Operational</span>
                    </div>
                    <div className="flex items-center">
                      <div className="h-3 w-3 rounded-full bg-yellow-500 mr-2"></div>
                      <span className="text-sm text-gray-200">Degraded</span>
                    </div>
                    <div className="flex items-center">
                      <div className="h-3 w-3 rounded-full bg-red-500 mr-2"></div>
                      <span className="text-sm text-gray-200">Outage</span>
                    </div>
                    <div className="flex items-center">
                      <div className="h-3 w-3 rounded-full bg-blue-500 mr-2"></div>
                      <span className="text-sm text-gray-200">Maintenance</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Tabs */}
              <motion.div
                className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 p-6"
                variants={itemVariants}
              >
                <Tabs defaultValue="components" className="w-full">
                  <TabsList className="bg-gray-800/50 border border-gray-700/50 p-1 rounded-lg mb-6">
                    <TabsTrigger
                      value="components"
                      className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                    >
                      <FaServer className="h-4 w-4 mr-2" />
                      Components
                    </TabsTrigger>
                    <TabsTrigger
                      value="incidents"
                      className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                    >
                      <FaExclamationTriangle className="h-4 w-4 mr-2" />
                      Incidents
                    </TabsTrigger>
                    <TabsTrigger
                      value="metrics"
                      className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                    >
                      <FaChartBar className="h-4 w-4 mr-2" />
                      System Metrics
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="components" className="space-y-4">
                    {/* Data Source Legend */}
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-4">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">
                        Data Source Legend
                      </h3>
                      <div className="flex flex-wrap gap-4 text-xs">
                        <div className="flex items-center">
                          <FaCheckCircle className="h-3 w-3 text-green-500 mr-1" />
                          <span className="text-gray-400">Real Data</span>
                        </div>
                        <div className="flex items-center">
                          <FaInfoCircle className="h-3 w-3 text-blue-500 mr-1" />
                          <span className="text-gray-400">
                            Partially Real Data
                          </span>
                        </div>
                        <div className="flex items-center">
                          <FaExclamationTriangle className="h-3 w-3 text-amber-500 mr-1" />
                          <span className="text-gray-400">Simulated Data</span>
                        </div>
                        <div className="ml-auto text-gray-400 italic">
                          Hover over indicators for data source details
                        </div>
                      </div>
                    </div>

                    {isRefreshing && !systemStatus?.components && (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    )}

                    {!isRefreshing && !systemStatus?.components && (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4">
                          <FaExclamationTriangle className="h-6 w-6" />
                        </div>
                        <h3 className="text-base font-medium">
                          Failed to load system components
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Please try refreshing the page.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={handleRefresh}
                        >
                          Retry
                        </Button>
                      </div>
                    )}

                    {systemStatus?.components &&
                      systemStatus.components.map((component) => {
                        const ComponentIcon = getComponentIcon(component.name);
                        return (
                          <Card
                            key={component.id}
                            className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden"
                          >
                            <div className="flex flex-col md:flex-row">
                              <div className="flex-1 p-6">
                                <div className="flex items-center">
                                  <div className="h-10 w-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 mr-4">
                                    <ComponentIcon className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <div className="flex items-center">
                                      <h3 className="text-lg font-medium text-white">
                                        {component.name}
                                      </h3>
                                      <Badge
                                        className={`ml-3 ${getStatusBadgeColor(
                                          component.status
                                        )}`}
                                      >
                                        {component.status
                                          .charAt(0)
                                          .toUpperCase() +
                                          component.status.slice(1)}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">
                                      {component.description}
                                    </p>
                                  </div>
                                </div>

                                {component.metrics && (
                                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {component.metrics.map((metric, index) => (
                                      <div
                                        key={index}
                                        className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                                      >
                                        <div className="text-sm text-gray-400 flex items-center">
                                          {metric.name}
                                          <DataSourceIndicator
                                            isReal={metric.isReal}
                                            isPartiallyReal={
                                              metric.isPartiallyReal
                                            }
                                            isMock={metric.isMock}
                                            source={metric.source}
                                          />
                                        </div>
                                        <div
                                          className={`text-lg font-medium ${getMetricStatusColor(
                                            metric.status
                                          )}`}
                                        >
                                          {metric.value} {metric.unit}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="p-4 bg-gray-800/70 border-t md:border-t-0 md:border-l border-gray-700/50 md:w-48 flex flex-col justify-center items-center">
                                <div className="text-sm text-gray-400">
                                  Last Updated
                                </div>
                                <div className="text-sm font-medium text-blue-300">
                                  {new Date(
                                    component.lastUpdated
                                  ).toLocaleString()}
                                </div>
                                <Button
                                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                  size="sm"
                                  onClick={() =>
                                    console.log(
                                      `View details for ${component.name}`
                                    )
                                  }
                                >
                                  <FaInfoCircle className="mr-1.5 h-3.5 w-3.5" />
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                  </TabsContent>

                  <TabsContent value="incidents" className="space-y-6">
                    {/* Mock Data Notice */}
                    {systemIncidents.length > 0 &&
                      systemIncidents[0]?._meta?.isMockData && (
                        <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-4 mb-4">
                          <div className="flex items-start">
                            <FaExclamationTriangle className="h-5 w-5 text-amber-500 mr-3 mt-0.5" />
                            <div>
                              <h3 className="text-sm font-medium text-amber-400">
                                Simulated Incident Data
                              </h3>
                              <p className="text-xs text-gray-400 mt-1">
                                {systemIncidents[0]?._meta?.mockDataNotice ||
                                  "The incident data shown is simulated for demonstration purposes only."}
                              </p>
                              <p className="text-xs text-gray-500 mt-2 italic">
                                {systemIncidents[0]?._meta
                                  ?.realImplementationNote ||
                                  "In a production environment, this would be replaced with real incident data from a database."}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                        <CardHeader className="border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                          <CardTitle className="text-white flex items-center">
                            <div className="p-1.5 bg-red-600/20 rounded-md mr-2">
                              <FaExclamationTriangle className="h-4 w-4 text-red-500" />
                            </div>
                            Active Incidents
                          </CardTitle>
                          <CardDescription className="text-gray-400">
                            Currently ongoing issues
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isRefreshing && systemIncidents.length === 0 ? (
                            <div className="flex justify-center items-center py-12">
                              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                          ) : systemIncidents.filter(
                              (i) => i.status !== "resolved"
                            ).length > 0 ? (
                            <div className="space-y-4">
                              {systemIncidents
                                .filter((i) => i.status !== "resolved")
                                .map((incident) => (
                                  <div
                                    key={incident.id}
                                    className="p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 rounded-lg bg-gray-800/50 backdrop-blur-sm"
                                  >
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-base font-medium">
                                        {incident.title}
                                      </h3>
                                      <Badge
                                        className={getIncidentSeverityBadgeColor(
                                          incident.severity
                                        )}
                                      >
                                        {incident.severity
                                          ? incident.severity
                                              .charAt(0)
                                              .toUpperCase() +
                                            incident.severity.slice(1)
                                          : "Unknown"}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center mt-2">
                                      <Badge
                                        className={getIncidentStatusBadgeColor(
                                          incident.status
                                        )}
                                      >
                                        {incident.status
                                          ? incident.status
                                              .charAt(0)
                                              .toUpperCase() +
                                            incident.status.slice(1)
                                          : "Unknown"}
                                      </Badge>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                        Started:{" "}
                                        {new Date(
                                          incident.startTime
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="mt-3 text-sm">
                                      <strong>Latest update:</strong>{" "}
                                      {incident.updates &&
                                      incident.updates.length > 0
                                        ? incident.updates[0].message
                                        : "No updates available"}
                                    </div>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="mt-2 p-0 h-auto"
                                      onClick={() =>
                                        console.log(
                                          `View incident ${incident.id}`
                                        )
                                      }
                                    >
                                      View details
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-4">
                                <FaCheckCircle className="h-6 w-6" />
                              </div>
                              <h3 className="text-base font-medium">
                                All Systems Operational
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                There are no active incidents at this time.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                        <CardHeader className="border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                          <CardTitle className="text-white flex items-center">
                            <div className="p-1.5 bg-green-600/20 rounded-md mr-2">
                              <FaCheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                            Resolved Incidents
                          </CardTitle>
                          <CardDescription className="text-gray-400">
                            Recently resolved issues
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isRefreshing && systemIncidents.length === 0 ? (
                            <div className="flex justify-center items-center py-12">
                              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                          ) : systemIncidents.filter(
                              (i) => i.status === "resolved"
                            ).length > 0 ? (
                            <div className="space-y-4">
                              {systemIncidents
                                .filter((i) => i.status === "resolved")
                                .map((incident) => (
                                  <div
                                    key={incident.id}
                                    className="p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 rounded-lg bg-gray-800/50 backdrop-blur-sm"
                                  >
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-base font-medium">
                                        {incident.title}
                                      </h3>
                                      <Badge
                                        className={getIncidentSeverityBadgeColor(
                                          incident.severity
                                        )}
                                      >
                                        {incident.severity
                                          ? incident.severity
                                              .charAt(0)
                                              .toUpperCase() +
                                            incident.severity.slice(1)
                                          : "Unknown"}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center mt-2">
                                      <Badge
                                        className={getIncidentStatusBadgeColor(
                                          incident.status
                                        )}
                                      >
                                        {incident.status
                                          ? incident.status
                                              .charAt(0)
                                              .toUpperCase() +
                                            incident.status.slice(1)
                                          : "Unknown"}
                                      </Badge>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                        Resolved:{" "}
                                        {incident.resolvedTime
                                          ? new Date(
                                              incident.resolvedTime
                                            ).toLocaleString()
                                          : "N/A"}
                                      </span>
                                    </div>
                                    <div className="mt-3 text-sm">
                                      <strong>Resolution:</strong>{" "}
                                      {incident.updates &&
                                      incident.updates.length > 0
                                        ? incident.updates[0].message
                                        : "No resolution details available"}
                                    </div>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="mt-2 p-0 h-auto"
                                      onClick={() =>
                                        console.log(
                                          `View incident ${incident.id}`
                                        )
                                      }
                                    >
                                      View details
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 mb-4">
                                <FaInfoCircle className="h-6 w-6" />
                              </div>
                              <h3 className="text-base font-medium">
                                No Recent Incidents
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                There are no recently resolved incidents.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                      <CardHeader className="border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                        <CardTitle className="text-white flex items-center">
                          <div className="p-1.5 bg-blue-600/20 rounded-md mr-2">
                            <FaInfoCircle className="h-4 w-4 text-blue-500" />
                          </div>
                          Incident History
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          View past incidents and their resolutions
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-4">
                          <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                            onClick={() => console.log("View incident history")}
                          >
                            <FaChartBar className="mr-2 h-4 w-4" />
                            View Full Incident History
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="metrics" className="space-y-6">
                    {/* Data Source Information */}
                    {systemMetrics?._meta && (
                      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-4">
                        <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                          <FaInfoCircle className="h-4 w-4 text-blue-500 mr-2" />
                          System Metrics Data Sources
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <h4 className="text-green-400 font-medium mb-1 flex items-center">
                              <FaCheckCircle className="h-3 w-3 mr-1" /> Real
                              Data Sources
                            </h4>
                            <ul className="text-gray-400 space-y-1 list-disc list-inside">
                              {systemMetrics._meta.realDataSources.map(
                                (source, index) => (
                                  <li key={index}>{source}</li>
                                )
                              )}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-blue-400 font-medium mb-1 flex items-center">
                              <FaInfoCircle className="h-3 w-3 mr-1" />{" "}
                              Estimated Data Sources
                            </h4>
                            <ul className="text-gray-400 space-y-1 list-disc list-inside">
                              {systemMetrics._meta.estimatedDataSources.map(
                                (source, index) => (
                                  <li key={index}>{source}</li>
                                )
                              )}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-amber-400 font-medium mb-1 flex items-center">
                              <FaExclamationTriangle className="h-3 w-3 mr-1" />{" "}
                              Simulated Data Sources
                            </h4>
                            <ul className="text-gray-400 space-y-1 list-disc list-inside">
                              {systemMetrics._meta.mockDataSources.map(
                                (source, index) => (
                                  <li key={index}>{source}</li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    {isRefreshing && !systemMetrics ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    ) : !systemMetrics ? (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4">
                          <FaExclamationTriangle className="h-6 w-6" />
                        </div>
                        <h3 className="text-base font-medium">
                          Failed to load system metrics
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Please try refreshing the page.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={handleRefresh}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                            <CardHeader className="border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                              <CardTitle className="text-white flex items-center">
                                <div className="p-1.5 bg-blue-600/20 rounded-md mr-2">
                                  <FaMicrochip className="h-4 w-4 text-blue-500" />
                                </div>
                                CPU Usage
                                {systemMetrics.cpu.isReal && (
                                  <DataSourceIndicator
                                    isReal={systemMetrics.cpu.isReal}
                                    source={systemMetrics.cpu.source}
                                  />
                                )}
                              </CardTitle>
                              <CardDescription className="text-gray-400">
                                Server CPU utilization
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-6">
                                <div>
                                  <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium">
                                      System CPU
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {systemMetrics.cpu.usage}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={systemMetrics.cpu.usage}
                                    className="h-2"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium">
                                      CPU Cores: {systemMetrics.cpu.cores}
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {systemMetrics.cpu.model.substring(0, 30)}
                                      ...
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium">
                                      Load Average
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {systemMetrics.cpu.load
                                        .map((load) => load.toFixed(2))
                                        .join(", ")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                            <CardHeader className="border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                              <CardTitle className="text-white flex items-center">
                                <div className="p-1.5 bg-blue-600/20 rounded-md mr-2">
                                  <FaMemory className="h-4 w-4 text-blue-500" />
                                </div>
                                Memory Usage
                                {systemMetrics.memory.isReal && (
                                  <DataSourceIndicator
                                    isReal={systemMetrics.memory.isReal}
                                    source={systemMetrics.memory.source}
                                  />
                                )}
                              </CardTitle>
                              <CardDescription className="text-gray-400">
                                Server memory utilization
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-6">
                                <div>
                                  <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium">
                                      System Memory
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {systemMetrics.memory.usage.toFixed(1)}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={systemMetrics.memory.usage}
                                    className="h-2"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium">
                                      Total Memory
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {(
                                        systemMetrics.memory.total /
                                        (1024 * 1024 * 1024)
                                      ).toFixed(2)}{" "}
                                      GB
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium">
                                      Free Memory
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {(
                                        systemMetrics.memory.free /
                                        (1024 * 1024 * 1024)
                                      ).toFixed(2)}{" "}
                                      GB
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                            <CardHeader className="pb-2 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                              <CardTitle className="text-base text-white flex items-center">
                                <div className="p-1.5 bg-blue-600/20 rounded-md mr-2">
                                  <FaNetworkWired className="h-3.5 w-3.5 text-blue-500" />
                                </div>
                                API Response Time
                                {systemMetrics.application.isPartiallyReal && (
                                  <DataSourceIndicator
                                    isPartiallyReal={
                                      systemMetrics.application.isPartiallyReal
                                    }
                                    source={systemMetrics.application.source}
                                  />
                                )}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-3xl font-bold">
                                {systemMetrics.application.averageResponseTime}{" "}
                                ms
                              </div>
                              <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                                <span className="inline-block mr-1">↓</span>{" "}
                                15ms from average
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                            <CardHeader className="pb-2 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                              <CardTitle className="text-base text-white flex items-center">
                                <div className="p-1.5 bg-blue-600/20 rounded-md mr-2">
                                  <FaUsers className="h-3.5 w-3.5 text-blue-500" />
                                </div>
                                Active Users
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-3xl font-bold">
                                {systemMetrics.application.activeUsers}
                              </div>
                              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 flex items-center">
                                <span className="inline-block mr-1">↑</span>{" "}
                                {Math.floor(
                                  systemMetrics.application.activeUsers * 0.1
                                )}{" "}
                                from yesterday
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                            <CardHeader className="pb-2 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                              <CardTitle className="text-base text-white flex items-center">
                                <div className="p-1.5 bg-red-600/20 rounded-md mr-2">
                                  <FaExclamationTriangle className="h-3.5 w-3.5 text-red-500" />
                                </div>
                                Error Rate
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-3xl font-bold">
                                {systemMetrics.application.errorRate}%
                              </div>
                              <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                                <span className="inline-block mr-1">↓</span>{" "}
                                0.02% from average
                              </p>
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 bg-gray-800/30 backdrop-blur-md shadow-xl overflow-hidden">
                          <CardHeader className="border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70">
                            <CardTitle className="text-white flex items-center">
                              <div className="p-1.5 bg-blue-600/20 rounded-md mr-2">
                                <FaChartBar className="h-4 w-4 text-blue-500" />
                              </div>
                              System Load
                              <span className="inline-block ml-2">
                                <TooltipPrimitive.Provider>
                                  <TooltipPrimitive.Root>
                                    <TooltipPrimitive.Trigger asChild>
                                      <button
                                        type="button"
                                        className="border-0 bg-transparent p-0 cursor-help"
                                      >
                                        <FaInfoCircle className="h-4 w-4 text-blue-500" />
                                      </button>
                                    </TooltipPrimitive.Trigger>
                                    <TooltipPrimitive.Content
                                      className="z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-w-xs"
                                      sideOffset={4}
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium">
                                          Mixed Data Sources
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          This panel contains a mix of real
                                          system metrics and simulated data for
                                          demonstration purposes.
                                        </p>
                                      </div>
                                    </TooltipPrimitive.Content>
                                  </TooltipPrimitive.Root>
                                </TooltipPrimitive.Provider>
                              </span>
                            </CardTitle>
                            <CardDescription className="text-gray-400">
                              24-hour system load average
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="h-80 flex items-center justify-center bg-gray-800/50 rounded-lg border border-gray-700/50 m-4">
                            <div className="text-center text-gray-500 dark:text-gray-400">
                              {isRefreshing ? (
                                <div className="flex flex-col items-center">
                                  <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2"></div>
                                  <p>Loading chart data...</p>
                                </div>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                  <div className="text-lg font-medium mb-2">
                                    System Statistics
                                  </div>
                                  <div className="grid grid-cols-2 gap-8 w-full max-w-2xl p-4">
                                    <div className="bg-gray-800/70 p-3 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                                      <div className="text-sm text-gray-400 flex items-center">
                                        Disk Usage
                                        {systemMetrics.disk.isReal && (
                                          <DataSourceIndicator
                                            isReal={systemMetrics.disk.isReal}
                                            source={systemMetrics.disk.source}
                                          />
                                        )}
                                      </div>
                                      <div className="text-xl font-medium text-white">
                                        {systemMetrics.disk.usage}%
                                      </div>
                                    </div>
                                    <div className="bg-gray-800/70 p-3 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                                      <div className="text-sm text-gray-400 flex items-center">
                                        Network Connections
                                        {systemMetrics.network
                                          .isPartiallyReal && (
                                          <DataSourceIndicator
                                            isPartiallyReal={
                                              systemMetrics.network
                                                .isPartiallyReal
                                            }
                                            source={
                                              systemMetrics.network.source
                                            }
                                          />
                                        )}
                                      </div>
                                      <div className="text-xl font-medium text-white">
                                        {systemMetrics.network.connections}
                                      </div>
                                    </div>
                                    <div className="bg-gray-800/70 p-3 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                                      <div className="text-sm text-gray-400 flex items-center">
                                        Requests Per Minute
                                        {systemMetrics.application
                                          .isPartiallyReal && (
                                          <DataSourceIndicator
                                            isPartiallyReal={
                                              systemMetrics.application
                                                .isPartiallyReal
                                            }
                                            source={
                                              systemMetrics.application.source
                                            }
                                          />
                                        )}
                                      </div>
                                      <div className="text-xl font-medium text-white">
                                        {
                                          systemMetrics.application
                                            .requestsPerMinute
                                        }
                                      </div>
                                    </div>
                                    <div className="bg-gray-800/70 p-3 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                                      <div className="text-sm text-gray-400 flex items-center">
                                        System Uptime
                                        <DataSourceIndicator
                                          isReal={true}
                                          source="Process uptime from Node.js"
                                        />
                                      </div>
                                      <div className="text-xl font-medium text-white">
                                        {Math.floor(
                                          systemMetrics.application.uptime /
                                            3600
                                        )}{" "}
                                        hours
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </motion.div>
            </motion.div>
          </ErrorBoundary>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default SystemStatusPage;
