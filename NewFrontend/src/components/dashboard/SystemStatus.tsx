import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FaServer,
  FaDatabase,
  FaNetworkWired,
  FaCloudUploadAlt,
  FaCloudDownloadAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaEllipsisH,
  FaSync,
  FaHistory,
} from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/buttons/Button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

interface SystemComponent {
  id: string;
  name: string;
  status: "operational" | "degraded" | "outage" | "maintenance";
  type: "api" | "database" | "server" | "network" | "service";
  metrics?: {
    uptime?: string;
    responseTime?: string;
    load?: number;
    memory?: number;
    disk?: number;
    cpu?: number;
  };
  lastIncident?: {
    date: Date | string;
    description: string;
    duration: string;
  };
}

interface SystemStatusProps {
  components: SystemComponent[];
  lastUpdated: Date | string;
  title?: string;
  className?: string;
  onRefresh?: () => void;
}

const SystemStatus: React.FC<SystemStatusProps> = ({
  components,
  lastUpdated,
  title = "System Status",
  className = "",
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) {
      onRefresh();
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <FaCheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
        return <FaExclamationTriangle className="h-4 w-4 text-yellow-500" />;
      case "outage":
        return <FaTimesCircle className="h-4 w-4 text-red-500" />;
      case "maintenance":
        return <FaInfoCircle className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-500/20 text-green-500 border-green-500/30";
      case "degraded":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "outage":
        return "bg-red-500/20 text-red-500 border-red-500/30";
      case "maintenance":
        return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/30";
    }
  };

  const getComponentIcon = (type: string) => {
    switch (type) {
      case "api":
        return <FaCloudUploadAlt className="h-4 w-4" />;
      case "database":
        return <FaDatabase className="h-4 w-4" />;
      case "server":
        return <FaServer className="h-4 w-4" />;
      case "network":
        return <FaNetworkWired className="h-4 w-4" />;
      case "service":
        return <FaCloudDownloadAlt className="h-4 w-4" />;
      default:
        return <FaServer className="h-4 w-4" />;
    }
  };

  // Calculate overall system status
  const calculateOverallStatus = () => {
    if (components.some((c) => c.status === "outage")) return "outage";
    if (components.some((c) => c.status === "degraded")) return "degraded";
    if (components.some((c) => c.status === "maintenance"))
      return "maintenance";
    return "operational";
  };

  const overallStatus = calculateOverallStatus();

  // Animation variants
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
    <motion.div
      className={`bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 ${className}`}
      variants={itemVariants}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
        <div className="flex items-center">
          <FaServer className="h-5 w-5 text-blue-400 mr-2" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <FaSync
              className={`h-3.5 w-3.5 mr-2 ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
              >
                <FaEllipsisH className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border border-gray-700 text-white">
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                <FaHistory className="h-4 w-4 mr-2" />
                View History
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                Export Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-6">
        <Tabs
          defaultValue={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="mb-4 bg-gray-700/50 p-1">
            <TabsTrigger
              value="overview"
              className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="details"
              className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="metrics"
              className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
            >
              Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <div className="mb-6 p-4 rounded-lg border border-gray-700/50 bg-gray-800/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${getStatusColor(
                      overallStatus
                    )}`}
                  >
                    {getStatusIcon(overallStatus)}
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-medium text-white">
                      System Status
                    </h4>
                    <div className="flex items-center mt-1">
                      <Badge className={getStatusColor(overallStatus)}>
                        {overallStatus === "operational"
                          ? "All Systems Operational"
                          : overallStatus === "degraded"
                          ? "Degraded Performance"
                          : overallStatus === "outage"
                          ? "Partial Outage"
                          : "Scheduled Maintenance"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Last updated</div>
                  <div className="text-sm text-white">
                    {formatDistanceToNow(
                      typeof lastUpdated === "string"
                        ? new Date(lastUpdated)
                        : lastUpdated,
                      { addSuffix: true }
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {components.map((component) => (
                <div
                  key={component.id}
                  className="p-3 rounded-lg border border-gray-700/50 bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${getStatusColor(
                          component.status
                        )}`}
                      >
                        {getComponentIcon(component.type)}
                      </div>
                      <div className="ml-3">
                        <h5 className="text-sm font-medium text-white">
                          {component.name}
                        </h5>
                        <div className="flex items-center mt-1">
                          {getStatusIcon(component.status)}
                          <span className="ml-1 text-xs text-gray-400">
                            {component.status === "operational"
                              ? "Operational"
                              : component.status === "degraded"
                              ? "Degraded"
                              : component.status === "outage"
                              ? "Outage"
                              : "Maintenance"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {component.metrics?.uptime && (
                        <div className="text-xs text-gray-400">
                          Uptime:{" "}
                          <span className="text-white">
                            {component.metrics.uptime}
                          </span>
                        </div>
                      )}
                      {component.metrics?.responseTime && (
                        <div className="text-xs text-gray-400">
                          Response:{" "}
                          <span className="text-white">
                            {component.metrics.responseTime}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="details" className="mt-0">
            <div className="space-y-4">
              {components.map((component) => (
                <div
                  key={component.id}
                  className="p-4 rounded-lg border border-gray-700/50 bg-gray-800/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${getStatusColor(
                          component.status
                        )}`}
                      >
                        {getComponentIcon(component.type)}
                      </div>
                      <div className="ml-4">
                        <h5 className="text-base font-medium text-white">
                          {component.name}
                        </h5>
                        <div className="flex items-center mt-1">
                          <Badge className={getStatusColor(component.status)}>
                            {component.status === "operational"
                              ? "Operational"
                              : component.status === "degraded"
                              ? "Degraded"
                              : component.status === "outage"
                              ? "Outage"
                              : "Maintenance"}
                          </Badge>
                        </div>

                        {component.lastIncident && (
                          <div className="mt-3 p-3 rounded-md bg-gray-700/30 border border-gray-700/50">
                            <div className="text-xs font-medium text-gray-300">
                              Last Incident
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {component.lastIncident.description}
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <div className="text-xs text-gray-500">
                                {formatDistanceToNow(
                                  typeof component.lastIncident.date ===
                                    "string"
                                    ? new Date(component.lastIncident.date)
                                    : component.lastIncident.date,
                                  { addSuffix: true }
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                Duration: {component.lastIncident.duration}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      {component.metrics?.uptime && (
                        <div className="text-xs text-gray-400">
                          Uptime:{" "}
                          <span className="text-white">
                            {component.metrics.uptime}
                          </span>
                        </div>
                      )}
                      {component.metrics?.responseTime && (
                        <div className="text-xs text-gray-400">
                          Response:{" "}
                          <span className="text-white">
                            {component.metrics.responseTime}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="mt-0">
            <div className="space-y-6">
              {components.map(
                (component) =>
                  component.metrics && (
                    <div
                      key={component.id}
                      className="p-4 rounded-lg border border-gray-700/50 bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center ${getStatusColor(
                              component.status
                            )}`}
                          >
                            {getComponentIcon(component.type)}
                          </div>
                          <h5 className="ml-3 text-sm font-medium text-white">
                            {component.name}
                          </h5>
                        </div>
                        <Badge className={getStatusColor(component.status)}>
                          {component.status === "operational"
                            ? "Operational"
                            : component.status === "degraded"
                            ? "Degraded"
                            : component.status === "outage"
                            ? "Outage"
                            : "Maintenance"}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        {component.metrics.cpu !== undefined && (
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <div className="text-xs text-gray-400">
                                CPU Usage
                              </div>
                              <div className="text-xs font-medium text-white">
                                {component.metrics.cpu}%
                              </div>
                            </div>
                            <Progress
                              value={component.metrics.cpu}
                              className="h-2 bg-gray-700"
                              indicatorClassName={
                                component.metrics.cpu > 90
                                  ? "bg-red-500"
                                  : component.metrics.cpu > 70
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }
                            />
                          </div>
                        )}

                        {component.metrics.memory !== undefined && (
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <div className="text-xs text-gray-400">
                                Memory Usage
                              </div>
                              <div className="text-xs font-medium text-white">
                                {component.metrics.memory}%
                              </div>
                            </div>
                            <Progress
                              value={component.metrics.memory}
                              className="h-2 bg-gray-700"
                              indicatorClassName={
                                component.metrics.memory > 90
                                  ? "bg-red-500"
                                  : component.metrics.memory > 70
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }
                            />
                          </div>
                        )}

                        {component.metrics.disk !== undefined && (
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <div className="text-xs text-gray-400">
                                Disk Usage
                              </div>
                              <div className="text-xs font-medium text-white">
                                {component.metrics.disk}%
                              </div>
                            </div>
                            <Progress
                              value={component.metrics.disk}
                              className="h-2 bg-gray-700"
                              indicatorClassName={
                                component.metrics.disk > 90
                                  ? "bg-red-500"
                                  : component.metrics.disk > 70
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }
                            />
                          </div>
                        )}

                        {component.metrics.load !== undefined && (
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <div className="text-xs text-gray-400">
                                Load Average
                              </div>
                              <div className="text-xs font-medium text-white">
                                {component.metrics.load}
                              </div>
                            </div>
                            <Progress
                              value={component.metrics.load * 10}
                              className="h-2 bg-gray-700"
                              indicatorClassName={
                                component.metrics.load > 9
                                  ? "bg-red-500"
                                  : component.metrics.load > 7
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default SystemStatus;
