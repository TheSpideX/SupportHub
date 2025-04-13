import React, { useState } from "react";
import {
  FaChartBar,
  FaDownload,
  FaPlus,
  FaSearch,
  FaFilter,
  FaEllipsisH,
} from "react-icons/fa";
import AdminPageTemplate from "@/components/dashboard/AdminPageTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/buttons/Button";
import { InputField } from "@/components/ui/inputs/InputField";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Report {
  id: string;
  name: string;
  description: string;
  category: string;
  lastRun: string;
  status: "scheduled" | "completed" | "failed";
  schedule: string;
}

const ReportsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Sample reports data
  const reports: Report[] = [
    {
      id: "1",
      name: "Monthly Ticket Summary",
      description:
        "Overview of ticket volume, resolution time, and satisfaction scores",
      category: "Tickets",
      lastRun: "2023-10-15",
      status: "completed",
      schedule: "Monthly",
    },
    {
      id: "2",
      name: "Agent Performance",
      description:
        "Detailed metrics on agent response times and resolution rates",
      category: "Performance",
      lastRun: "2023-10-14",
      status: "completed",
      schedule: "Weekly",
    },
    {
      id: "3",
      name: "Customer Satisfaction Trends",
      description:
        "Analysis of CSAT scores over time with breakdown by category",
      category: "Customers",
      lastRun: "2023-10-10",
      status: "completed",
      schedule: "Monthly",
    },
    {
      id: "4",
      name: "SLA Compliance",
      description:
        "Report on SLA compliance rates across different ticket categories",
      category: "Performance",
      lastRun: "2023-10-16",
      status: "scheduled",
      schedule: "Weekly",
    },
    {
      id: "5",
      name: "System Usage Analytics",
      description: "Analysis of system usage patterns and user engagement",
      category: "System",
      lastRun: "2023-10-01",
      status: "failed",
      schedule: "Monthly",
    },
  ];

  // Filter reports based on search query and selected category
  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      searchQuery === "" ||
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === null || report.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(
    new Set(reports.map((report) => report.category))
  );

  // Handle running a report
  const handleRunReport = (reportId: string) => {
    console.log(`Running report ${reportId}`);
  };

  // Handle downloading a report
  const handleDownloadReport = (reportId: string) => {
    console.log(`Downloading report ${reportId}`);
  };

  // Handle editing a report
  const handleEditReport = (reportId: string) => {
    console.log(`Editing report ${reportId}`);
  };

  // Handle deleting a report
  const handleDeleteReport = (reportId: string) => {
    console.log(`Deleting report ${reportId}`);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: Report["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "scheduled":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <AdminPageTemplate
      title="Reports"
      description="Generate and manage analytical reports"
      icon={FaChartBar}
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Analytics", href: "/analytics" },
        { label: "Reports", href: "/analytics/reports" },
      ]}
      actions={[
        {
          label: "Create Report",
          onClick: () => console.log("Create new report"),
          icon: FaPlus,
        },
      ]}
    >
      {/* Filters and Search */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="h-4 w-4 text-gray-400" />
            </div>
            <InputField
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => setSelectedCategory(null)}
              className={
                selectedCategory === null
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-100"
                  : ""
              }
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant="outline"
                onClick={() =>
                  setSelectedCategory(
                    category === selectedCategory ? null : category
                  )
                }
                className={
                  category === selectedCategory
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-100"
                    : ""
                }
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {filteredReports.length > 0 ? (
            filteredReports.map((report) => (
              <Card key={report.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center">
                  <div className="flex-1 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">{report.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {report.description}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <FaEllipsisH className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleRunReport(report.id)}
                          >
                            Run Now
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDownloadReport(report.id)}
                          >
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditReport(report.id)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteReport(report.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap items-center mt-4 gap-2">
                      <Badge variant="outline">{report.category}</Badge>
                      <Badge className={getStatusBadgeColor(report.status)}>
                        {report.status.charAt(0).toUpperCase() +
                          report.status.slice(1)}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Last run: {report.lastRun}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Schedule: {report.schedule}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end p-4 bg-gray-50 dark:bg-gray-800/50 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRunReport(report.id)}
                      >
                        Run Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReport(report.id)}
                      >
                        <FaDownload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                <FaSearch className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium">No reports found</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {searchQuery
                  ? `No reports matching "${searchQuery}"`
                  : "No reports available"}
              </p>
              {searchQuery && (
                <Button
                  variant="link"
                  onClick={() => setSearchQuery("")}
                  className="mt-2"
                >
                  Clear search
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 dark:text-gray-400">
                Scheduled reports will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom">
          <Card>
            <CardHeader>
              <CardTitle>Custom Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 dark:text-gray-400">
                Custom reports will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="favorites">
          <Card>
            <CardHeader>
              <CardTitle>Favorite Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 dark:text-gray-400">
                Your favorite reports will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminPageTemplate>
  );
};

export default ReportsPage;
