import React, { useState } from "react";
import { FaChartBar, FaDownload, FaFilter, FaSync } from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/buttons/Button";

const AnalyticsDashboardPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState("7d");
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const handleExport = () => {
    console.log("Exporting data...");
  };

  return (
    <AdminPageTemplate
      title="Analytics Dashboard"
      description="View key metrics and performance indicators"
      icon={FaChartBar}
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Analytics", href: "/analytics" },
        { label: "Dashboard", href: "/analytics/dashboard" },
      ]}
      actions={[
        {
          label: "Refresh",
          onClick: handleRefresh,
          variant: "outline",
          icon: FaSync,
        },
        {
          label: "Export",
          onClick: handleExport,
          variant: "outline",
          icon: FaDownload,
        },
      ]}
    >
      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium">Dashboard Overview</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Time Range:
            </span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm">
            <FaFilter className="mr-2 h-3.5 w-3.5" />
            More Filters
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">1,284</div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↑</span> 12% from last
                  period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Open Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">237</div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↑</span> 8% from last
                  period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Avg. Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">2.4h</div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↓</span> 15% from last
                  period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Customer Satisfaction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">94%</div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                  <span className="inline-block mr-1">↑</span> 3% from last
                  period
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Volume Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2"></div>
                      <p>Loading chart data...</p>
                    </div>
                  ) : (
                    <p>Chart visualization will appear here</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ticket Categories</CardTitle>
              </CardHeader>
              <CardContent className="h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-2"></div>
                      <p>Loading chart data...</p>
                    </div>
                  ) : (
                    <p>Chart visualization will appear here</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className="flex items-start pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mr-4">
                          <span className="text-sm font-medium">{i + 1}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">
                            Ticket #{1000 + i} updated
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Status changed to "In Progress"
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            2 hours ago
                          </p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 dark:text-gray-400">
                Detailed ticket analytics will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 dark:text-gray-400">
                Detailed user analytics will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 dark:text-gray-400">
                Detailed performance analytics will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminPageTemplate>
  );
};

export default AnalyticsDashboardPage;
