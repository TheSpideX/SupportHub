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
import EnhancedAdminPageTemplate from "@/components/dashboard/EnhancedAdminPageTemplate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/buttons/Button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const SystemStatusPage: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sample system status data
  const systemComponents = [
    {
      name: "API Server",
      status: "operational",
      uptime: "99.98%",
      lastIncident: "None",
    },
    {
      name: "Database",
      status: "operational",
      uptime: "99.95%",
      lastIncident: "3 days ago",
    },
    {
      name: "Authentication Service",
      status: "operational",
      uptime: "99.99%",
      lastIncident: "None",
    },
    {
      name: "File Storage",
      status: "degraded",
      uptime: "98.75%",
      lastIncident: "Ongoing",
    },
    {
      name: "Email Service",
      status: "operational",
      uptime: "99.90%",
      lastIncident: "7 days ago",
    },
    {
      name: "Search Service",
      status: "operational",
      uptime: "99.95%",
      lastIncident: "None",
    },
    {
      name: "Background Jobs",
      status: "operational",
      uptime: "99.80%",
      lastIncident: "2 days ago",
    },
    {
      name: "CDN",
      status: "operational",
      uptime: "99.99%",
      lastIncident: "None",
    },
  ];

  const incidents = [
    {
      id: "1",
      title: "File Storage Performance Degradation",
      status: "investigating",
      severity: "medium",
      startTime: "2023-10-16 10:30:00",
      lastUpdate: "2023-10-16 14:45:00",
      description:
        "We are currently experiencing slower than normal file upload and download speeds. Our engineering team is investigating the issue.",
      affectedComponents: ["File Storage"],
    },
    {
      id: "2",
      title: "Database Connectivity Issues",
      status: "resolved",
      severity: "major",
      startTime: "2023-10-13 08:15:00",
      lastUpdate: "2023-10-13 09:30:00",
      resolvedTime: "2023-10-13 09:30:00",
      description:
        "Users experienced intermittent database connectivity issues resulting in slow response times and occasional errors. The issue was resolved by scaling up database resources.",
      affectedComponents: ["Database", "API Server"],
    },
    {
      id: "3",
      title: "Email Delivery Delays",
      status: "resolved",
      severity: "minor",
      startTime: "2023-10-09 14:20:00",
      lastUpdate: "2023-10-09 16:45:00",
      resolvedTime: "2023-10-09 16:45:00",
      description:
        "Some users experienced delays in email notifications. The issue was resolved by fixing a configuration issue with our email service provider.",
      affectedComponents: ["Email Service"],
    },
  ];

  const systemMetrics = {
    cpu: 42,
    memory: 68,
    disk: 57,
    network: 35,
    activeUsers: 128,
    requestsPerMinute: 450,
    averageResponseTime: 120, // ms
    errorRate: 0.5, // %
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "outage":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "maintenance":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get incident status badge color
  const getIncidentStatusBadgeColor = (status: string) => {
    switch (status) {
      case "investigating":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "identified":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "monitoring":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get incident severity badge color
  const getIncidentSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "major":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "minor":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <EnhancedAdminPageTemplate
      title="System Status"
      description="Monitor system health and performance"
      icon={FaServer}
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "System Status", href: "/system-status" },
      ]}
      actions={[
        {
          label: "Refresh",
          onClick: handleRefresh,
          variant: "outline",
          icon: FaSync,
        },
      ]}
    >
      {/* Status Overview */}
      <div className="mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">System Status</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Last updated: {new Date().toLocaleString()}
                </p>
              </div>
              <div className="flex items-center mt-4 md:mt-0">
                <div className="flex items-center mr-4">
                  <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm">Operational</span>
                </div>
                <div className="flex items-center mr-4">
                  <div className="h-3 w-3 rounded-full bg-yellow-500 mr-2"></div>
                  <span className="text-sm">Degraded</span>
                </div>
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-sm">Outage</span>
                </div>
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full bg-blue-500 mr-2"></div>
                  <span className="text-sm">Maintenance</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="components" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="metrics">System Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="components">
          <Card>
            <CardHeader>
              <CardTitle>System Components</CardTitle>
              <CardDescription>
                Current status of all system components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                      <th className="px-4 py-3 rounded-tl-lg font-medium">
                        Component
                      </th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Uptime</th>
                      <th className="px-4 py-3 rounded-tr-lg font-medium">
                        Last Incident
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemComponents.map((component, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-4 py-3 font-medium">
                          {component.name}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={getStatusBadgeColor(component.status)}
                          >
                            {component.status.charAt(0).toUpperCase() +
                              component.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{component.uptime}</td>
                        <td className="px-4 py-3">{component.lastIncident}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
              <CardDescription>
                Recent and ongoing system incidents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
                      <h3 className="text-lg font-medium">{incident.title}</h3>
                      <div className="flex items-center mt-2 md:mt-0 space-x-2">
                        <Badge
                          className={getIncidentStatusBadgeColor(
                            incident.status
                          )}
                        >
                          {incident.status.charAt(0).toUpperCase() +
                            incident.status.slice(1)}
                        </Badge>
                        <Badge
                          className={getIncidentSeverityBadgeColor(
                            incident.severity
                          )}
                        >
                          {incident.severity.charAt(0).toUpperCase() +
                            incident.severity.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      <span>Started: {incident.startTime}</span>
                      {incident.resolvedTime && (
                        <span className="ml-4">
                          Resolved: {incident.resolvedTime}
                        </span>
                      )}
                    </div>
                    <p className="mb-2">{incident.description}</p>
                    <div className="text-sm">
                      <span className="font-medium">Affected Components: </span>
                      {incident.affectedComponents.join(", ")}
                    </div>
                    <div className="text-sm mt-2">
                      <span className="font-medium">Last Update: </span>
                      {incident.lastUpdate}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">CPU Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{systemMetrics.cpu}%</div>
                <Progress
                  value={systemMetrics.cpu}
                  className="h-2 mt-2"
                  indicatorClassName={
                    systemMetrics.cpu > 80
                      ? "bg-red-500"
                      : systemMetrics.cpu > 60
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {systemMetrics.memory}%
                </div>
                <Progress
                  value={systemMetrics.memory}
                  className="h-2 mt-2"
                  indicatorClassName={
                    systemMetrics.memory > 80
                      ? "bg-red-500"
                      : systemMetrics.memory > 60
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Disk Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{systemMetrics.disk}%</div>
                <Progress
                  value={systemMetrics.disk}
                  className="h-2 mt-2"
                  indicatorClassName={
                    systemMetrics.disk > 80
                      ? "bg-red-500"
                      : systemMetrics.disk > 60
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Network Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {systemMetrics.network}%
                </div>
                <Progress
                  value={systemMetrics.network}
                  className="h-2 mt-2"
                  indicatorClassName="bg-blue-500"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {systemMetrics.activeUsers}
                </div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↑</span> 12% from average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Requests Per Minute</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {systemMetrics.requestsPerMinute}
                </div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↑</span> 5% from average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">API Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {systemMetrics.averageResponseTime} ms
                </div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↓</span> 15ms from average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {systemMetrics.errorRate}%
                </div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↓</span> 0.2% from average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Database Query Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">250 ms</div>
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↑</span> 50ms from average
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </EnhancedAdminPageTemplate>
  );
};

export default SystemStatusPage;
