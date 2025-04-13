import React, { useState } from "react";
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

interface SystemComponent {
  id: string;
  name: string;
  status: "operational" | "degraded" | "outage" | "maintenance";
  description: string;
  lastUpdated: string;
  metrics?: {
    name: string;
    value: string | number;
    unit?: string;
    status?: "normal" | "warning" | "critical";
  }[];
}

interface SystemIncident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "critical" | "major" | "minor";
  startTime: string;
  lastUpdate: string;
  resolvedTime?: string;
  affectedComponents: string[];
  updates: {
    time: string;
    message: string;
  }[];
}

const SystemStatusPage: React.FC = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Sample system components data
  const systemComponents: SystemComponent[] = [
    {
      id: "1",
      name: "API Services",
      status: "operational",
      description: "Core API endpoints and services",
      lastUpdated: "2023-10-16 15:30",
      metrics: [
        { name: "Response Time", value: 120, unit: "ms", status: "normal" },
        { name: "Success Rate", value: "99.98%", status: "normal" },
        { name: "Request Volume", value: "1.2K/min", status: "normal" },
      ],
    },
    {
      id: "2",
      name: "Database Cluster",
      status: "degraded",
      description: "Primary database and read replicas",
      lastUpdated: "2023-10-16 14:45",
      metrics: [
        { name: "Query Time", value: 250, unit: "ms", status: "warning" },
        { name: "Connection Pool", value: "85%", status: "warning" },
        { name: "Disk Usage", value: "78%", status: "normal" },
      ],
    },
    {
      id: "3",
      name: "Authentication Service",
      status: "operational",
      description: "User authentication and authorization",
      lastUpdated: "2023-10-16 15:15",
      metrics: [
        { name: "Auth Latency", value: 95, unit: "ms", status: "normal" },
        { name: "Token Issuance", value: "450/min", status: "normal" },
        { name: "Failed Attempts", value: "2%", status: "normal" },
      ],
    },
    {
      id: "4",
      name: "Storage Service",
      status: "maintenance",
      description: "File storage and CDN",
      lastUpdated: "2023-10-16 12:00",
      metrics: [
        { name: "Upload Speed", value: "N/A", status: "normal" },
        { name: "Download Speed", value: "N/A", status: "normal" },
        { name: "Storage Usage", value: "62%", status: "normal" },
      ],
    },
    {
      id: "5",
      name: "Notification Service",
      status: "outage",
      description: "Email and push notifications",
      lastUpdated: "2023-10-16 13:20",
      metrics: [
        { name: "Delivery Rate", value: "0%", status: "critical" },
        { name: "Queue Size", value: "10K+", status: "critical" },
        { name: "Processing Time", value: "N/A", status: "critical" },
      ],
    },
  ];

  // Sample incidents data
  const incidents: SystemIncident[] = [
    {
      id: "1",
      title: "Notification Service Outage",
      status: "investigating",
      severity: "critical",
      startTime: "2023-10-16 13:15",
      lastUpdate: "2023-10-16 13:45",
      affectedComponents: ["5"],
      updates: [
        {
          time: "2023-10-16 13:45",
          message:
            "We are investigating issues with the notification delivery system. Users may experience delays or failures in receiving notifications.",
        },
        {
          time: "2023-10-16 13:20",
          message:
            "Monitoring systems have detected an issue with the notification service. Investigation is underway.",
        },
      ],
    },
    {
      id: "2",
      title: "Database Performance Degradation",
      status: "identified",
      severity: "major",
      startTime: "2023-10-16 14:30",
      lastUpdate: "2023-10-16 14:50",
      affectedComponents: ["2"],
      updates: [
        {
          time: "2023-10-16 14:50",
          message:
            "We have identified the cause as an inefficient query pattern from a recent deployment. Engineers are working on a fix.",
        },
        {
          time: "2023-10-16 14:35",
          message:
            "Users may experience slower response times for certain operations. We are investigating the cause.",
        },
      ],
    },
    {
      id: "3",
      title: "Scheduled Maintenance: Storage Service",
      status: "monitoring",
      severity: "minor",
      startTime: "2023-10-16 12:00",
      lastUpdate: "2023-10-16 12:30",
      affectedComponents: ["4"],
      updates: [
        {
          time: "2023-10-16 12:30",
          message:
            "Maintenance is proceeding as planned. Storage service is currently offline but all other systems are functioning normally.",
        },
        {
          time: "2023-10-16 12:00",
          message:
            "Beginning scheduled maintenance of the storage service. Expected completion time is 16:00 UTC.",
        },
      ],
    },
    {
      id: "4",
      title: "API Rate Limiting Issue",
      status: "resolved",
      severity: "minor",
      startTime: "2023-10-15 18:20",
      lastUpdate: "2023-10-15 19:45",
      resolvedTime: "2023-10-15 19:45",
      affectedComponents: ["1"],
      updates: [
        {
          time: "2023-10-15 19:45",
          message:
            "The issue has been resolved. Rate limiting is now functioning correctly.",
        },
        {
          time: "2023-10-15 19:00",
          message: "We have identified the issue and are deploying a fix.",
        },
        {
          time: "2023-10-15 18:20",
          message:
            "Some users are experiencing unexpected rate limiting on API requests. We are investigating.",
        },
      ],
    },
  ];

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
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
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-gray-700/80 hover:bg-gray-600 text-white shadow-md flex items-center gap-2"
                    onClick={handleRefresh}
                  >
                    <FaSync
                      className={`h-4 w-4 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
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
                    Last updated: {new Date().toLocaleString()}
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
                <TabsList className="mb-6 bg-gray-700/50 p-1">
                  <TabsTrigger
                    value="components"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Components
                  </TabsTrigger>
                  <TabsTrigger
                    value="incidents"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Incidents
                  </TabsTrigger>
                  <TabsTrigger
                    value="metrics"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    System Metrics
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="components" className="space-y-4">
                  {systemComponents.map((component) => {
                    const ComponentIcon = getComponentIcon(component.name);
                    return (
                      <Card key={component.id}>
                        <div className="flex flex-col md:flex-row">
                          <div className="flex-1 p-6">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 mr-4">
                                <ComponentIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center">
                                  <h3 className="text-lg font-medium">
                                    {component.name}
                                  </h3>
                                  <Badge
                                    className={`ml-3 ${getStatusBadgeColor(
                                      component.status
                                    )}`}
                                  >
                                    {component.status.charAt(0).toUpperCase() +
                                      component.status.slice(1)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  {component.description}
                                </p>
                              </div>
                            </div>

                            {component.metrics && (
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {component.metrics.map((metric, index) => (
                                  <div
                                    key={index}
                                    className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg"
                                  >
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {metric.name}
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
                          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 md:w-48 flex flex-col justify-center items-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Last Updated
                            </div>
                            <div className="text-sm font-medium">
                              {component.lastUpdated}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={() =>
                                console.log(
                                  `View details for ${component.name}`
                                )
                              }
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </TabsContent>

                <TabsContent value="incidents" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Active Incidents</CardTitle>
                        <CardDescription>
                          Currently ongoing issues
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {incidents.filter((i) => i.status !== "resolved")
                          .length > 0 ? (
                          <div className="space-y-4">
                            {incidents
                              .filter((i) => i.status !== "resolved")
                              .map((incident) => (
                                <div
                                  key={incident.id}
                                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
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
                                        .charAt(0)
                                        .toUpperCase() +
                                        incident.severity.slice(1)}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center mt-2">
                                    <Badge
                                      className={getIncidentStatusBadgeColor(
                                        incident.status
                                      )}
                                    >
                                      {incident.status.charAt(0).toUpperCase() +
                                        incident.status.slice(1)}
                                    </Badge>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                      Started: {incident.startTime}
                                    </span>
                                  </div>
                                  <div className="mt-3 text-sm">
                                    <strong>Latest update:</strong>{" "}
                                    {incident.updates[0].message}
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

                    <Card>
                      <CardHeader>
                        <CardTitle>Resolved Incidents</CardTitle>
                        <CardDescription>
                          Recently resolved issues
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {incidents.filter((i) => i.status === "resolved")
                          .length > 0 ? (
                          <div className="space-y-4">
                            {incidents
                              .filter((i) => i.status === "resolved")
                              .map((incident) => (
                                <div
                                  key={incident.id}
                                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
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
                                        .charAt(0)
                                        .toUpperCase() +
                                        incident.severity.slice(1)}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center mt-2">
                                    <Badge
                                      className={getIncidentStatusBadgeColor(
                                        incident.status
                                      )}
                                    >
                                      {incident.status.charAt(0).toUpperCase() +
                                        incident.status.slice(1)}
                                    </Badge>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                      Resolved: {incident.resolvedTime}
                                    </span>
                                  </div>
                                  <div className="mt-3 text-sm">
                                    <strong>Resolution:</strong>{" "}
                                    {incident.updates[0].message}
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

                  <Card>
                    <CardHeader>
                      <CardTitle>Incident History</CardTitle>
                      <CardDescription>
                        View past incidents and their resolutions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-4">
                        <Button
                          variant="outline"
                          onClick={() => console.log("View incident history")}
                        >
                          View Full Incident History
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="metrics" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>CPU Usage</CardTitle>
                        <CardDescription>
                          Server CPU utilization
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">
                                API Server
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                45%
                              </span>
                            </div>
                            <Progress value={45} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">
                                Database Server
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                72%
                              </span>
                            </div>
                            <Progress value={72} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">
                                Cache Server
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                28%
                              </span>
                            </div>
                            <Progress value={28} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Memory Usage</CardTitle>
                        <CardDescription>
                          Server memory utilization
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">
                                API Server
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                3.2 GB / 8 GB
                              </span>
                            </div>
                            <Progress value={40} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">
                                Database Server
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                12.8 GB / 16 GB
                              </span>
                            </div>
                            <Progress value={80} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">
                                Cache Server
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                2.4 GB / 4 GB
                              </span>
                            </div>
                            <Progress value={60} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          API Response Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">120 ms</div>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                          <span className="inline-block mr-1">↓</span> 15ms from
                          average
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Database Query Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">250 ms</div>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1 flex items-center">
                          <span className="inline-block mr-1">↑</span> 50ms from
                          average
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Error Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">0.05%</div>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                          <span className="inline-block mr-1">↓</span> 0.02%
                          from average
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>System Load</CardTitle>
                      <CardDescription>
                        24-hour system load average
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        {isRefreshing ? (
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2"></div>
                            <p>Loading chart data...</p>
                          </div>
                        ) : (
                          <p>System load chart will appear here</p>
                        )}
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

export default SystemStatusPage;
