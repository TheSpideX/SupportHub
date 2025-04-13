import React, { useState } from "react";
import {
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaCalendarAlt,
  FaDownload,
  FaSync,
  FaTicketAlt,
  FaUsers,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFilter,
  FaArrowRight,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { cn } from "@/lib/utils";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Footer from "@/components/dashboard/Footer";
import Sidebar from "@/components/dashboard/Sidebar";
import StatCard from "@/components/shared/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AnalyticsMetricsPage: React.FC = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sample metrics data
  const ticketMetrics = {
    total: 256,
    open: 42,
    inProgress: 78,
    resolved: 136,
    avgResolutionTime: "4h 23m",
    slaCompliance: 92,
    firstResponseTime: "28m",
    customerSatisfaction: 4.7,
  };

  const teamMetrics = {
    totalMembers: 12,
    activeMembers: 10,
    ticketsPerAgent: 8.5,
    avgResolutionTimePerAgent: {
      "John Doe": "3h 45m",
      "Jane Smith": "4h 12m",
      "Robert Johnson": "5h 30m",
      "Emily Davis": "3h 20m",
      "Michael Brown": "4h 05m",
    },
    topPerformers: [
      { name: "Emily Davis", performance: 96 },
      { name: "John Doe", performance: 94 },
      { name: "Michael Brown", performance: 92 },
    ],
  };

  const customerMetrics = {
    totalCustomers: 128,
    activeCustomers: 85,
    newCustomers: 12,
    ticketsPerCustomer: 2.3,
    topCustomersByTickets: [
      { name: "Acme Inc.", tickets: 15 },
      { name: "XYZ Corp", tickets: 12 },
      { name: "Tech Solutions", tickets: 10 },
    ],
  };

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

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Handle time range change
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
  };

  // Get time range label
  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case "24h":
        return "Last 24 Hours";
      case "7d":
        return "Last 7 Days";
      case "30d":
        return "Last 30 Days";
      case "90d":
        return "Last 90 Days";
      default:
        return "Last 7 Days";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

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
            {/* Welcome section */}
            <motion.div
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                    Analytics Metrics
                  </h1>
                  <p className="mt-2 text-gray-200 text-base md:text-lg">
                    Detailed metrics and performance indicators for{" "}
                    {getTimeRangeLabel().toLowerCase()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Select
                    value={timeRange}
                    onValueChange={handleTimeRangeChange}
                  >
                    <SelectTrigger className="bg-gray-700/80 border-gray-600 text-white w-40">
                      <SelectValue placeholder="Select time range" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="90d">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    onClick={handleRefresh}
                    className="p-2 bg-gray-700/80 hover:bg-gray-600 text-white rounded-md transition-colors"
                  >
                    <FaSync
                      className={`h-5 w-5 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => console.log("Export metrics")}
                    className="p-2 bg-gray-700/80 hover:bg-gray-600 text-white rounded-md transition-colors"
                  >
                    <FaDownload className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Metrics Tabs */}
            <motion.div
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 p-6"
              variants={itemVariants}
            >
              <Tabs defaultValue="tickets" className="w-full">
                <TabsList className="mb-6 bg-gray-700/50 p-1">
                  <TabsTrigger
                    value="tickets"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Ticket Metrics
                  </TabsTrigger>
                  <TabsTrigger
                    value="team"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Team Metrics
                  </TabsTrigger>
                  <TabsTrigger
                    value="customers"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Customer Metrics
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tickets">
                  {/* Ticket Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
                    <motion.div
                      variants={itemVariants}
                      whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    >
                      <StatCard
                        title="Total Tickets"
                        value={ticketMetrics.total.toString()}
                        change="+12% from previous period"
                        icon={FaTicketAlt}
                        color="bg-blue-500"
                        gradient="from-blue-500 to-blue-600"
                        variant="gradient"
                      />
                    </motion.div>

                    <motion.div
                      variants={itemVariants}
                      whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    >
                      <StatCard
                        title="Open Tickets"
                        value={ticketMetrics.open.toString()}
                        change="+5% from previous period"
                        icon={FaTicketAlt}
                        color="bg-yellow-500"
                        gradient="from-yellow-500 to-yellow-600"
                        variant="gradient"
                      />
                    </motion.div>

                    <motion.div
                      variants={itemVariants}
                      whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    >
                      <StatCard
                        title="In Progress"
                        value={ticketMetrics.inProgress.toString()}
                        change="+8% from previous period"
                        icon={FaTicketAlt}
                        color="bg-blue-500"
                        gradient="from-blue-500 to-blue-600"
                        variant="gradient"
                      />
                    </motion.div>

                    <motion.div
                      variants={itemVariants}
                      whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    >
                      <StatCard
                        title="Resolved Tickets"
                        value={ticketMetrics.resolved.toString()}
                        change="+15% from previous period"
                        icon={FaTicketAlt}
                        color="bg-green-500"
                        gradient="from-green-500 to-green-600"
                        variant="gradient"
                      />
                    </motion.div>
                  </div>

                  {/* Ticket Performance Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <motion.div
                      className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-green-500/30 transition-all duration-300"
                      variants={itemVariants}
                      whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    >
                      <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                        <div className="flex items-center">
                          <FaClock className="h-5 w-5 text-green-400 mr-2" />
                          <h3 className="text-lg font-semibold text-white">
                            Resolution Time
                          </h3>
                        </div>
                        <div className="text-sm text-gray-300">
                          Average time to resolve tickets
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-3xl font-bold text-white">
                              {ticketMetrics.avgResolutionTime}
                            </div>
                            <p className="text-sm text-green-400 mt-1 flex items-center">
                              <span className="inline-block mr-1">↓</span> 15%
                              from previous period
                            </p>
                          </div>
                          <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                            <FaClock className="h-8 w-8 text-green-400" />
                          </div>
                        </div>
                        <div className="space-y-3 mt-4">
                          <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-white">Priority: High</span>
                              <span className="text-white font-medium">
                                2h 15m
                              </span>
                            </div>
                          </div>
                          <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-white">
                                Priority: Medium
                              </span>
                              <span className="text-white font-medium">
                                4h 30m
                              </span>
                            </div>
                          </div>
                          <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-white">Priority: Low</span>
                              <span className="text-white font-medium">
                                8h 45m
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                      variants={itemVariants}
                      whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    >
                      <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                        <div className="flex items-center">
                          <FaCheckCircle className="h-5 w-5 text-blue-400 mr-2" />
                          <h3 className="text-lg font-semibold text-white">
                            SLA Compliance
                          </h3>
                        </div>
                        <div className="text-sm text-gray-300">
                          Percentage of tickets resolved within SLA
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-3xl font-bold text-white">
                              {ticketMetrics.slaCompliance}%
                            </div>
                            <p className="text-sm text-green-400 mt-1 flex items-center">
                              <span className="inline-block mr-1">↑</span> 3%
                              from previous period
                            </p>
                          </div>
                          <div className="h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <FaCheckCircle className="h-8 w-8 text-blue-400" />
                          </div>
                        </div>
                        <div className="space-y-4 mt-4">
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1 text-white">
                              <span>Priority: High</span>
                              <span>95%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-green-500"
                                style={{ width: "95%" }}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1 text-white">
                              <span>Priority: Medium</span>
                              <span>92%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-blue-500"
                                style={{ width: "92%" }}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1 text-white">
                              <span>Priority: Low</span>
                              <span>88%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-yellow-500"
                                style={{ width: "88%" }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Additional Ticket Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>First Response Time</CardTitle>
                        <CardDescription>
                          Average time to first response
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-3xl font-bold">
                              {ticketMetrics.firstResponseTime}
                            </div>
                            <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                              <span className="inline-block mr-1">↓</span> 10%
                              from previous period
                            </p>
                          </div>
                          <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                            <FaClock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span>Priority: High</span>
                            <span>15m</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Priority: Medium</span>
                            <span>28m</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Priority: Low</span>
                            <span>45m</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Customer Satisfaction</CardTitle>
                        <CardDescription>
                          Average rating from customer feedback
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-3xl font-bold">
                              {ticketMetrics.customerSatisfaction}/5
                            </div>
                            <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                              <span className="inline-block mr-1">↑</span> 0.2
                              from previous period
                            </p>
                          </div>
                          <div className="h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                            <FaUsers className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>5 Stars</span>
                              <span>72%</span>
                            </div>
                            <Progress value={72} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>4 Stars</span>
                              <span>23%</span>
                            </div>
                            <Progress value={23} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>3 Stars</span>
                              <span>3%</span>
                            </div>
                            <Progress value={3} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>2 Stars</span>
                              <span>1%</span>
                            </div>
                            <Progress value={1} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>1 Star</span>
                              <span>1%</span>
                            </div>
                            <Progress value={1} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="team">
                  {/* Team Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Team Members
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {teamMetrics.totalMembers}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {teamMetrics.activeMembers} currently active
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Tickets Per Agent
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {teamMetrics.ticketsPerAgent}
                        </div>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1 flex items-center">
                          <span className="inline-block mr-1">↑</span> 0.5 from
                          previous period
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Team Efficiency
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">87%</div>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                          <span className="inline-block mr-1">↑</span> 5% from
                          previous period
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Team Performance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Performers</CardTitle>
                        <CardDescription>
                          Team members with highest performance scores
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {teamMetrics.topPerformers.map((performer, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium mr-3">
                                  {performer.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-medium">
                                    {performer.name}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Performance Score: {performer.performance}%
                                  </div>
                                </div>
                              </div>
                              <Badge
                                className={
                                  performer.performance >= 95
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                }
                              >
                                {performer.performance}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Resolution Time Per Agent</CardTitle>
                        <CardDescription>
                          Average time to resolve tickets per agent
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {Object.entries(
                            teamMetrics.avgResolutionTimePerAgent
                          ).map(([name, time], index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium mr-3">
                                  {name.charAt(0)}
                                </div>
                                <div className="font-medium">{name}</div>
                              </div>
                              <div className="flex items-center">
                                <FaClock className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                                <span>{time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="customers">
                  {/* Customer Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Total Customers
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {customerMetrics.totalCustomers}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {customerMetrics.activeCustomers} currently active
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          New Customers
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {customerMetrics.newCustomers}
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center">
                          <span className="inline-block mr-1">↑</span> 20% from
                          previous period
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          Tickets Per Customer
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {customerMetrics.ticketsPerCustomer}
                        </div>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center">
                          <span className="inline-block mr-1">↑</span> 0.3 from
                          previous period
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Customer Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Customers by Tickets</CardTitle>
                        <CardDescription>
                          Customers with the most support tickets
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {customerMetrics.topCustomersByTickets.map(
                            (customer, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between"
                              >
                                <div className="font-medium">
                                  {customer.name}
                                </div>
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                  {customer.tickets} tickets
                                </Badge>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Customer Satisfaction</CardTitle>
                        <CardDescription>
                          Average satisfaction rating by customer segment
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>Enterprise</span>
                              <span>4.8/5</span>
                            </div>
                            <Progress value={96} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>Mid-Market</span>
                              <span>4.6/5</span>
                            </div>
                            <Progress value={92} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>Small Business</span>
                              <span>4.5/5</span>
                            </div>
                            <Progress value={90} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span>Individual</span>
                              <span>4.3/5</span>
                            </div>
                            <Progress value={86} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
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

export default AnalyticsMetricsPage;
