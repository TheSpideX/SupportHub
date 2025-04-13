import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaUserPlus,
  FaTicketAlt,
  FaUserClock,
  FaExclamationTriangle,
  FaChartLine,
  FaUsers,
  FaServer,
  FaDatabase,
  FaNetworkWired,
  FaCloudUploadAlt,
  FaCloudDownloadAlt,
  FaUserShield,
  FaArrowUp,
  FaArrowDown,
  FaChartBar,
  FaChartPie,
  FaRobot,
  FaCube,
  FaExpand,
} from "react-icons/fa";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTheme } from "next-themes";
import EnhancedDashboardHeader from "@/components/dashboard/EnhancedDashboardHeader";
import EnhancedStatCard from "@/components/dashboard/EnhancedStatCard";
import DataVisualization from "@/components/dashboard/DataVisualization";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import SystemStatus from "@/components/dashboard/SystemStatus";
import DraggableDashboard from "@/components/dashboard/DraggableDashboard";
import AIInsights from "@/components/dashboard/AIInsights";
import ThreeDVisualization from "@/components/dashboard/ThreeDVisualization";
import VoiceAssistant from "@/components/dashboard/VoiceAssistant";
import { Button } from "@/components/ui/buttons/Button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const EnhancedAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState<
    "day" | "week" | "month"
  >("week");
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardLayout, setDashboardLayout] = useState<string[]>([
    "stats",
    "performance",
    "tickets",
    "ai-insights",
    "3d-visualization",
    "alerts",
    "activity",
    "system",
  ]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);

  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      // Simulate new notifications
      setNotifications([
        {
          id: 1,
          title: "Critical SLA breach",
          message: "Ticket #TKT-2350 has breached SLA",
          time: "5 minutes ago",
          type: "critical",
        },
        {
          id: 2,
          title: "New user registered",
          message: "John Smith has registered",
          time: "10 minutes ago",
          type: "info",
        },
        {
          id: 3,
          title: "System update scheduled",
          message: "System update scheduled for tonight",
          time: "1 hour ago",
          type: "warning",
        },
      ]);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Fix for tab closing popup
  useEffect(() => {
    // This prevents the "Changes you made may not be saved" popup
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Remove the default message
      e.returnValue = "";
      return "";
    };

    // Remove the event listener to prevent the popup
    window.removeEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Enhanced stats with more metrics
  const stats = [
    {
      title: "New Users",
      value: "128",
      change: "+12% from last week",
      icon: FaUserPlus,
      color: "bg-blue-500",
      gradient: "from-blue-500 to-blue-600",
      trend: "up",
      info: "New user registrations in the selected period",
    },
    {
      title: "Open Tickets",
      value: "64",
      change: "-8% from last week",
      icon: FaTicketAlt,
      color: "bg-orange-500",
      gradient: "from-orange-500 to-orange-600",
      trend: "down",
      info: "Currently open support tickets",
    },
    {
      title: "Response Time",
      value: "42m",
      change: "+5% from last week",
      icon: FaUserClock,
      color: "bg-yellow-500",
      gradient: "from-yellow-500 to-yellow-600",
      trend: "up",
      info: "Average first response time for tickets",
    },
    {
      title: "SLA Breaches",
      value: "7",
      change: "-22% from last week",
      icon: FaExclamationTriangle,
      color: "bg-red-500",
      gradient: "from-red-500 to-red-600",
      trend: "down",
      info: "Number of SLA breaches in the selected period",
    },
    {
      title: "Customer Satisfaction",
      value: "94%",
      change: "+2% from last week",
      icon: FaChartLine,
      color: "bg-green-500",
      gradient: "from-green-500 to-green-600",
      trend: "up",
      info: "Average customer satisfaction rating",
    },
    {
      title: "Active Users",
      value: "1,254",
      change: "+18% from last week",
      icon: FaUsers,
      color: "bg-purple-500",
      gradient: "from-purple-500 to-purple-600",
      trend: "up",
      info: "Users active in the last 24 hours",
    },
  ];

  // Team performance data
  const teamPerformance = [
    {
      name: "Technical Support",
      ticketsResolved: 145,
      avgResponseTime: "28m",
      slaCompliance: "98%",
      satisfaction: "4.8/5",
    },
    {
      name: "Customer Success",
      ticketsResolved: 89,
      avgResponseTime: "45m",
      slaCompliance: "92%",
      satisfaction: "4.6/5",
    },
    {
      name: "Product Support",
      ticketsResolved: 112,
      avgResponseTime: "37m",
      slaCompliance: "95%",
      satisfaction: "4.7/5",
    },
    {
      name: "Billing Support",
      ticketsResolved: 64,
      avgResponseTime: "52m",
      slaCompliance: "89%",
      satisfaction: "4.4/5",
    },
  ];

  // Chart data
  const ticketTrendsData = [
    { name: "Jan", New: 65, Resolved: 42, Backlog: 23 },
    { name: "Feb", New: 78, Resolved: 50, Backlog: 28 },
    { name: "Mar", New: 91, Resolved: 70, Backlog: 21 },
    { name: "Apr", New: 84, Resolved: 90, Backlog: 15 },
    { name: "May", New: 62, Resolved: 61, Backlog: 16 },
    { name: "Jun", New: 58, Resolved: 63, Backlog: 11 },
    { name: "Jul", New: 74, Resolved: 70, Backlog: 15 },
  ];

  const userActivityData = [
    { name: "Mon", Active: 1200, New: 40 },
    { name: "Tue", Active: 1350, New: 35 },
    { name: "Wed", Active: 1400, New: 50 },
    { name: "Thu", Active: 1250, New: 45 },
    { name: "Fri", Active: 1500, New: 60 },
    { name: "Sat", Active: 1100, New: 30 },
    { name: "Sun", Active: 950, New: 25 },
  ];

  const categoryDistributionData = [
    { name: "Technical", value: 35 },
    { name: "Billing", value: 25 },
    { name: "Account", value: 20 },
    { name: "Product", value: 15 },
    { name: "Other", value: 5 },
  ];

  // Activity feed data
  const activities = [
    {
      id: "1",
      type: "ticket",
      action: "Ticket created:",
      subject: "Unable to access account",
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      user: {
        name: "John Smith",
        avatar: "https://i.pravatar.cc/150?img=1",
        role: "Customer",
      },
      status: "info",
    },
    {
      id: "2",
      type: "ticket",
      action: "Ticket resolved:",
      subject: "Payment not processing",
      timestamp: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
      user: {
        name: "Sarah Johnson",
        avatar: "https://i.pravatar.cc/150?img=5",
        role: "Support Agent",
      },
      status: "success",
    },
    {
      id: "3",
      type: "user",
      action: "User registered:",
      subject: "Michael Brown",
      timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      status: "info",
    },
    {
      id: "4",
      type: "system",
      action: "System update:",
      subject: "Database maintenance completed",
      timestamp: new Date(Date.now() - 1000 * 60 * 180), // 3 hours ago
      status: "success",
    },
    {
      id: "5",
      type: "security",
      action: "Security alert:",
      subject: "Multiple failed login attempts",
      timestamp: new Date(Date.now() - 1000 * 60 * 240), // 4 hours ago
      user: {
        name: "Security System",
        role: "Automated",
      },
      status: "warning",
    },
    {
      id: "6",
      type: "ticket",
      action: "SLA breached:",
      subject: "Account upgrade request",
      timestamp: new Date(Date.now() - 1000 * 60 * 300), // 5 hours ago
      status: "error",
    },
  ];

  // Alerts data
  const alerts = [
    {
      id: "1",
      title: "Critical SLA Breach",
      message:
        "Ticket #TKT-2350 has breached SLA and requires immediate attention.",
      type: "critical",
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      source: "Ticket System",
      actionRequired: true,
      actionLink: "#/tickets/2350",
    },
    {
      id: "2",
      title: "Database Performance Degraded",
      message:
        "The main database is experiencing high load and degraded performance.",
      type: "warning",
      timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      source: "Monitoring System",
      actionRequired: true,
    },
    {
      id: "3",
      title: "New Agent Onboarded",
      message:
        "Sarah Johnson has completed onboarding and is ready to take tickets.",
      type: "info",
      timestamp: new Date(Date.now() - 1000 * 60 * 180), // 3 hours ago
      source: "HR System",
      isRead: true,
    },
    {
      id: "4",
      title: "System Update Completed",
      message: "The scheduled system update has been completed successfully.",
      type: "success",
      timestamp: new Date(Date.now() - 1000 * 60 * 240), // 4 hours ago
      source: "System Admin",
    },
  ];

  // System status data
  const systemComponents = [
    {
      id: "1",
      name: "API Gateway",
      status: "operational",
      type: "api",
      metrics: {
        uptime: "99.98%",
        responseTime: "120ms",
        cpu: 45,
        memory: 60,
      },
    },
    {
      id: "2",
      name: "Main Database",
      status: "degraded",
      type: "database",
      metrics: {
        uptime: "99.5%",
        responseTime: "350ms",
        cpu: 85,
        memory: 78,
        disk: 92,
      },
      lastIncident: {
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        description: "High load causing degraded performance",
        duration: "45 minutes",
      },
    },
    {
      id: "3",
      name: "Web Server",
      status: "operational",
      type: "server",
      metrics: {
        uptime: "100%",
        responseTime: "85ms",
        cpu: 35,
        memory: 45,
        disk: 60,
      },
    },
    {
      id: "4",
      name: "Authentication Service",
      status: "operational",
      type: "service",
      metrics: {
        uptime: "99.99%",
        responseTime: "95ms",
        cpu: 30,
        memory: 40,
      },
    },
    {
      id: "5",
      name: "CDN",
      status: "operational",
      type: "network",
      metrics: {
        uptime: "100%",
        responseTime: "30ms",
        load: 4.2,
      },
    },
  ];

  // Available widgets for customization
  const availableWidgets = [
    { id: "stats", title: "Key Metrics" },
    { id: "performance", title: "Team Performance" },
    { id: "tickets", title: "Ticket Trends" },
    { id: "users", title: "User Activity" },
    { id: "categories", title: "Ticket Categories" },
    { id: "ai-insights", title: "AI Insights" },
    { id: "3d-visualization", title: "3D Visualization" },
    { id: "alerts", title: "System Alerts" },
    { id: "activity", title: "Recent Activity" },
    { id: "system", title: "System Status" },
  ];

  // Handle refresh
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  // Handle mark alert as read
  const handleMarkAlertAsRead = (id: string) => {
    // In a real app, you would call an API to mark the alert as read
    console.log(`Marking alert ${id} as read`);
  };

  // Handle dismiss alert
  const handleDismissAlert = (id: string) => {
    // In a real app, you would call an API to dismiss the alert
    console.log(`Dismissing alert ${id}`);
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

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4 md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <motion.div
          className="absolute top-[10%] left-[15%] w-[30rem] h-[30rem] rounded-full bg-blue-600/10 blur-[8rem]"
          animate={{
            x: [0, 30, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-[10%] right-[15%] w-[25rem] h-[25rem] rounded-full bg-purple-600/10 blur-[7rem]"
          animate={{
            x: [0, -20, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-[40%] right-[25%] w-[20rem] h-[20rem] rounded-full bg-cyan-600/10 blur-[6rem]"
          animate={{
            x: [0, 25, 0],
            y: [0, 25, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0aDR2MWgtNHYtMXptMC0yaDF2NGgtMXYtNHptMi0yaDF2MWgtMXYtMXptLTIgMmgxdjFoLTF2LTF6bS0yLTJoMXYxaC0xdi0xem0yLTJoMXYxaC0xdi0xem0tMiAyaDF2MWgtMXYtMXptLTItMmgxdjFoLTF2LTF6bTggMGgxdjFoLTF2LTF6bS0yIDBoMXYxaC0xdi0xem0tMi0yaDF2MWgtMXYtMXptLTIgMGgxdjFoLTF2LTF6bS0yIDBoMXYxaC0xdi0xem0xMCAwaDJ2MWgtMnYtMXptLTIgMGgxdjFoLTF2LTF6bS04IDBoMXYxaC0xdi0xem0tMiAwaDJ2MWgtMnYtMXptMC0yaDF2MWgtMXYtMXptMTYgMGgxdjFoLTF2LTF6bS0xMiAwaDJ2MWgtMnYtMXptLTQgMGgydjFoLTJ2LTF6bS0yIDBoMXYxaC0xdi0xem04IDBoMnYxaC0ydi0xem0tMi0yaDF2MWgtMXYtMXptLTIgMGgxdjFoLTF2LTF6bS0yIDBoMXYxaC0xdi0xem0tMiAwaDJ2MWgtMnYtMXptLTIgMGgxdjFoLTF2LTF6bTE2IDBoMnYxaC0ydi0xem0tOCAwaDJ2MWgtMnYtMXptLTQgMGgxdjFoLTF2LTF6bTEwIDBoMXYxaC0xdi0xem0yIDBoMXYxaC0xdi0xeiIvPjwvZz48L2c+PC9zdmc+')] opacity-10" />
      </div>

      {/* Dark mode toggle */}
      <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 bg-gray-800/80 backdrop-blur-md p-2 rounded-lg border border-gray-700/50 shadow-lg hover:border-blue-500/30 transition-all duration-300">
        <Switch
          id="dark-mode"
          checked={theme === "dark"}
          onCheckedChange={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="data-[state=checked]:bg-blue-600"
        />
        <Label htmlFor="dark-mode" className="text-sm text-gray-300">
          Dark Mode
        </Label>
      </div>

      {/* Welcome message */}
      {showWelcomeMessage && (
        <motion.div
          className="mb-8 p-6 rounded-xl bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-purple-600/20 border border-blue-500/30 relative backdrop-blur-sm shadow-xl"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          layoutId="welcome-message"
        >
          <div className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-blue-500/30 blur-xl" />
          <div className="absolute -bottom-3 -right-3 h-6 w-6 rounded-full bg-purple-500/30 blur-xl" />

          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full h-8 w-8 p-0 flex items-center justify-center"
            onClick={() => setShowWelcomeMessage(false)}
          >
            ✕
          </Button>

          <div className="flex items-center mb-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="h-6 w-6 text-blue-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2L14.5 9H21L16 13.5L18 21L12 17L6 21L8 13.5L3 9H9.5L12 2Z"
                    fill="currentColor"
                  />
                </svg>
              </motion.div>
            </div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              Welcome to the Enhanced Dashboard!
            </h2>
          </div>

          <p className="text-gray-300 leading-relaxed ml-1">
            This dashboard has been redesigned with modern UI/UX features.
            Explore the new capabilities:
          </p>

          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            <motion.li
              className="flex items-center"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center mr-2">
                <span className="text-blue-400 text-xs">✓</span>
              </div>
              <span>Customizable layout with drag-and-drop widgets</span>
            </motion.li>
            <motion.li
              className="flex items-center"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="h-5 w-5 rounded-full bg-purple-500/20 flex items-center justify-center mr-2">
                <span className="text-purple-400 text-xs">✓</span>
              </div>
              <span>
                Interactive data visualizations with real-time updates
              </span>
            </motion.li>
            <motion.li
              className="flex items-center"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center mr-2">
                <span className="text-green-400 text-xs">✓</span>
              </div>
              <span>AI-powered insights and smart notifications</span>
            </motion.li>
          </ul>

          <div className="mt-5 flex justify-end">
            <Button
              variant="outline"
              className="bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30 hover:text-blue-200 shadow-lg shadow-blue-900/10"
              onClick={() => setShowWelcomeMessage(false)}
            >
              Get Started
            </Button>
          </div>
        </motion.div>
      )}

      <motion.div
        className="max-w-7xl mx-auto space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Enhanced Dashboard Header */}
        <EnhancedDashboardHeader
          user={user}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={(period) =>
            setSelectedPeriod(period as "day" | "week" | "month")
          }
          notifications={notifications}
          onRefresh={handleRefresh}
        />

        {/* Main Dashboard Content */}
        <DraggableDashboard
          layout={dashboardLayout}
          onLayoutChange={setDashboardLayout}
          availableWidgets={availableWidgets}
        >
          {/* Stats Cards */}
          <motion.div
            className="relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Decorative elements */}
            <div className="absolute -top-6 -left-6 w-12 h-12 rounded-full bg-blue-500/10 blur-xl" />
            <div className="absolute -bottom-6 -right-6 w-12 h-12 rounded-full bg-purple-500/10 blur-xl" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                  <EnhancedStatCard
                    title={stat.title}
                    value={stat.value}
                    change={stat.change}
                    icon={stat.icon}
                    color={stat.color}
                    gradient={stat.gradient}
                    trend={stat.trend as "up" | "down" | "neutral"}
                    info={stat.info}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Team Performance */}
          <motion.div
            className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            {/* Decorative elements */}
            <div className="absolute -top-6 right-12 w-12 h-12 rounded-full bg-indigo-500/10 blur-xl" />

            <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center bg-gradient-to-r from-indigo-600/20 to-indigo-600/5">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center mr-3">
                  <FaUsers className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Team Performance
                  </h3>
                  <p className="text-xs text-gray-400">
                    Real-time performance metrics
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <span className="flex items-center">
                    <FaArrowUp className="h-2.5 w-2.5 mr-1" /> 8% overall
                  </span>
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-indigo-500/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 hover:text-indigo-200"
                >
                  View Details
                </Button>
              </div>
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700/50">
                  <thead>
                    <tr className="bg-gray-800/30">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider rounded-l-lg">
                        Team
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Tickets Resolved
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Avg Response
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        SLA Compliance
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider rounded-r-lg">
                        Satisfaction
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {teamPerformance.map((team, index) => (
                      <motion.tr
                        key={index}
                        className="hover:bg-gray-700/50 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + index * 0.1, duration: 0.3 }}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mr-3 border border-indigo-500/30">
                              <span className="text-xs font-medium text-indigo-300">
                                {team.name.charAt(0)}
                                {team.name.split(" ")[1]?.charAt(0)}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-white">
                              {team.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-200">
                              {team.ticketsResolved}
                            </div>
                            <div className="ml-2 h-1.5 w-24 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (parseInt(team.ticketsResolved) / 150) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-200">
                            {team.avgResponseTime}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className={`text-sm font-medium ${
                                parseInt(team.slaCompliance) > 95
                                  ? "text-green-400"
                                  : parseInt(team.slaCompliance) > 90
                                  ? "text-yellow-400"
                                  : "text-red-400"
                              }`}
                            >
                              {team.slaCompliance}
                            </div>
                            <div className="ml-2 h-1.5 w-16 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  parseInt(team.slaCompliance) > 95
                                    ? "bg-green-500"
                                    : parseInt(team.slaCompliance) > 90
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{
                                  width: `${parseInt(team.slaCompliance)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-200">
                              {team.satisfaction}
                            </div>
                            <div className="ml-2 flex text-yellow-400">
                              {[...Array(5)].map((_, i) => {
                                const rating = parseFloat(team.satisfaction);
                                const fullStars = Math.floor(rating);
                                const hasHalfStar = rating % 1 >= 0.5;

                                if (i < fullStars) {
                                  return <span key={i}>★</span>;
                                } else if (i === fullStars && hasHalfStar) {
                                  return <span key={i}>⯨</span>;
                                } else {
                                  return (
                                    <span key={i} className="text-gray-600">
                                      ★
                                    </span>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>

          {/* Ticket Trends Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="relative"
          >
            {/* Decorative elements */}
            <div className="absolute -top-6 left-12 w-12 h-12 rounded-full bg-blue-500/10 blur-xl" />
            <div className="absolute -bottom-6 right-24 w-12 h-12 rounded-full bg-cyan-500/10 blur-xl" />

            <DataVisualization
              title="Ticket Trends"
              description="Ticket volume over time"
              icon={FaTicketAlt}
              data={ticketTrendsData}
              type="multi"
              onRefresh={handleRefresh}
              className="shadow-lg shadow-blue-900/5 border-blue-500/20 hover:shadow-blue-900/10 hover:border-blue-500/30"
            />
          </motion.div>

          {/* AI Insights */}
          {dashboardLayout.includes("ai-insights") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="relative"
            >
              {/* Decorative elements */}
              <div className="absolute -top-6 left-24 w-12 h-12 rounded-full bg-indigo-500/10 blur-xl" />
              <div className="absolute -bottom-6 right-12 w-12 h-12 rounded-full bg-purple-500/10 blur-xl" />

              <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-indigo-500/30 transition-all duration-300 shadow-lg shadow-indigo-900/5 border-indigo-500/20 hover:shadow-indigo-900/10 hover:border-indigo-500/30">
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaRobot className="h-5 w-5 text-indigo-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">
                      AI Insights
                    </h3>
                    <Badge className="ml-2 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                      4
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
                    >
                      Auto-play
                    </Button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start mb-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <FaChartLine className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center">
                        <h4 className="text-lg font-medium text-white">
                          Increasing ticket volume detected
                        </h4>
                        <Badge className="ml-3 bg-red-500/20 text-red-400 border-red-500/30">
                          High Impact
                        </Badge>
                      </div>
                      <div className="flex items-center mt-1">
                        <Badge className="bg-gray-700/50 text-gray-300 border-gray-600/50">
                          92% Confidence
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-300 mb-6 leading-relaxed">
                    There has been a 27% increase in ticket volume over the past
                    24 hours, primarily in the "Account Access" category. This
                    may indicate a potential issue with the latest
                    authentication system update.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="text-sm text-gray-400 mb-1">
                        Ticket Volume
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-semibold text-white">
                          127
                        </div>
                        <div className="flex items-center text-sm text-red-400">
                          <FaArrowUp className="h-3 w-3 mr-1" />
                          +27%
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="text-sm text-gray-400 mb-1">
                        Affected Category
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-semibold text-white">
                          Account Access
                        </div>
                        <div className="flex items-center text-sm text-red-400">
                          <FaArrowUp className="h-3 w-3 mr-1" />
                          +43%
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="text-sm text-gray-400 mb-1">
                        Avg. Resolution Time
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-semibold text-white">
                          47m
                        </div>
                        <div className="flex items-center text-sm text-red-400">
                          <FaArrowUp className="h-3 w-3 mr-1" />
                          +15%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200"
                    >
                      Investigate Auth System
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200"
                    >
                      Alert Dev Team
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3D Visualization */}
          {dashboardLayout.includes("3d-visualization") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="relative"
            >
              {/* Decorative elements */}
              <div className="absolute -top-6 right-24 w-12 h-12 rounded-full bg-cyan-500/10 blur-xl" />
              <div className="absolute -bottom-6 left-24 w-12 h-12 rounded-full bg-blue-500/10 blur-xl" />

              <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-cyan-500/30 transition-all duration-300 shadow-lg shadow-cyan-900/5 border-cyan-500/20 hover:shadow-cyan-900/10 hover:border-cyan-500/30">
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaCube className="h-5 w-5 text-cyan-400 mr-2" />
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        3D Data Visualization
                      </h3>
                      <p className="text-sm text-gray-400">
                        Interactive 3D view of your data
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
                    >
                      <FaExpand className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-4 bg-gray-700/50 p-1 rounded-lg inline-flex">
                    <button className="px-3 py-1 rounded-md bg-cyan-600 text-white text-sm flex items-center">
                      <FaChartBar className="h-3.5 w-3.5 mr-1.5" />
                      Tickets
                    </button>
                    <button className="px-3 py-1 rounded-md text-gray-300 text-sm flex items-center ml-1">
                      <FaChartLine className="h-3.5 w-3.5 mr-1.5" />
                      Users
                    </button>
                    <button className="px-3 py-1 rounded-md text-gray-300 text-sm flex items-center ml-1">
                      <FaChartPie className="h-3.5 w-3.5 mr-1.5" />
                      Performance
                    </button>
                  </div>

                  <div className="relative h-[300px] bg-gray-800/30 rounded-lg border border-gray-700/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 bg-cyan-500/10 rounded-full animate-ping"></div>
                        <div className="absolute inset-2 bg-cyan-500/20 rounded-full animate-pulse"></div>
                        <div className="absolute inset-4 bg-cyan-500/30 rounded-full"></div>
                        <FaCube className="absolute inset-0 m-auto h-8 w-8 text-cyan-400" />
                      </div>
                      <p className="text-gray-400 text-sm">
                        Click and drag to rotate the 3D visualization
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        Showing distribution of tickets by category and priority
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* AI Insights */}
          {dashboardLayout.includes("ai-insights") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="relative"
            >
              {/* Decorative elements */}
              <div className="absolute -top-6 left-24 w-12 h-12 rounded-full bg-indigo-500/10 blur-xl" />
              <div className="absolute -bottom-6 right-12 w-12 h-12 rounded-full bg-purple-500/10 blur-xl" />

              <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-indigo-500/30 transition-all duration-300 shadow-lg shadow-indigo-900/5 border-indigo-500/20 hover:shadow-indigo-900/10 hover:border-indigo-500/30">
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaRobot className="h-5 w-5 text-indigo-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">
                      AI Insights
                    </h3>
                    <Badge className="ml-2 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                      4
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
                    >
                      Auto-play
                    </Button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start mb-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <FaChartLine className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center">
                        <h4 className="text-lg font-medium text-white">
                          Increasing ticket volume detected
                        </h4>
                        <Badge className="ml-3 bg-red-500/20 text-red-400 border-red-500/30">
                          High Impact
                        </Badge>
                      </div>
                      <div className="flex items-center mt-1">
                        <Badge className="bg-gray-700/50 text-gray-300 border-gray-600/50">
                          92% Confidence
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-300 mb-6 leading-relaxed">
                    There has been a 27% increase in ticket volume over the past
                    24 hours, primarily in the "Account Access" category. This
                    may indicate a potential issue with the latest
                    authentication system update.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="text-sm text-gray-400 mb-1">
                        Ticket Volume
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-semibold text-white">
                          127
                        </div>
                        <div className="flex items-center text-sm text-red-400">
                          <FaArrowUp className="h-3 w-3 mr-1" />
                          +27%
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="text-sm text-gray-400 mb-1">
                        Affected Category
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-semibold text-white">
                          Account Access
                        </div>
                        <div className="flex items-center text-sm text-red-400">
                          <FaArrowUp className="h-3 w-3 mr-1" />
                          +43%
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="text-sm text-gray-400 mb-1">
                        Avg. Resolution Time
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-semibold text-white">
                          47m
                        </div>
                        <div className="flex items-center text-sm text-red-400">
                          <FaArrowUp className="h-3 w-3 mr-1" />
                          +15%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200"
                    >
                      Investigate Auth System
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200"
                    >
                      Alert Dev Team
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3D Visualization */}
          {dashboardLayout.includes("3d-visualization") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="relative"
            >
              {/* Decorative elements */}
              <div className="absolute -top-6 right-24 w-12 h-12 rounded-full bg-cyan-500/10 blur-xl" />
              <div className="absolute -bottom-6 left-24 w-12 h-12 rounded-full bg-blue-500/10 blur-xl" />

              <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-cyan-500/30 transition-all duration-300 shadow-lg shadow-cyan-900/5 border-cyan-500/20 hover:shadow-cyan-900/10 hover:border-cyan-500/30">
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaCube className="h-5 w-5 text-cyan-400 mr-2" />
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        3D Data Visualization
                      </h3>
                      <p className="text-sm text-gray-400">
                        Interactive 3D view of your data
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
                    >
                      <FaExpand className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-4 bg-gray-700/50 p-1 rounded-lg inline-flex">
                    <button className="px-3 py-1 rounded-md bg-cyan-600 text-white text-sm flex items-center">
                      <FaChartBar className="h-3.5 w-3.5 mr-1.5" />
                      Tickets
                    </button>
                    <button className="px-3 py-1 rounded-md text-gray-300 text-sm flex items-center ml-1">
                      <FaChartLine className="h-3.5 w-3.5 mr-1.5" />
                      Users
                    </button>
                    <button className="px-3 py-1 rounded-md text-gray-300 text-sm flex items-center ml-1">
                      <FaChartPie className="h-3.5 w-3.5 mr-1.5" />
                      Performance
                    </button>
                  </div>

                  <div className="relative h-[300px] bg-gray-800/30 rounded-lg border border-gray-700/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 bg-cyan-500/10 rounded-full animate-ping"></div>
                        <div className="absolute inset-2 bg-cyan-500/20 rounded-full animate-pulse"></div>
                        <div className="absolute inset-4 bg-cyan-500/30 rounded-full"></div>
                        <FaCube className="absolute inset-0 m-auto h-8 w-8 text-cyan-400" />
                      </div>
                      <p className="text-gray-400 text-sm">
                        Click and drag to rotate the 3D visualization
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        Showing distribution of tickets by category and priority
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* System Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="relative"
          >
            <div className="absolute -top-6 right-12 w-12 h-12 rounded-full bg-red-500/10 blur-xl" />

            <AlertsPanel
              alerts={alerts}
              onMarkAsRead={handleMarkAlertAsRead}
              onDismiss={handleDismissAlert}
              onViewAll={() => console.log("View all alerts")}
              className="shadow-lg shadow-red-900/5 border-red-500/20 hover:shadow-red-900/10 hover:border-red-500/30"
            />
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="relative"
          >
            <div className="absolute -top-6 left-24 w-12 h-12 rounded-full bg-purple-500/10 blur-xl" />

            <ActivityFeed
              activities={activities}
              onViewAll={() => console.log("View all activities")}
              onFilter={(filter) => console.log(`Filter by ${filter}`)}
              className="shadow-lg shadow-purple-900/5 border-purple-500/20 hover:shadow-purple-900/10 hover:border-purple-500/30"
            />
          </motion.div>

          {/* System Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="relative"
          >
            <div className="absolute -top-6 right-24 w-12 h-12 rounded-full bg-green-500/10 blur-xl" />
            <div className="absolute -bottom-6 left-12 w-12 h-12 rounded-full bg-blue-500/10 blur-xl" />

            <SystemStatus
              components={systemComponents}
              lastUpdated={new Date()}
              onRefresh={handleRefresh}
              className="shadow-lg shadow-green-900/5 border-green-500/20 hover:shadow-green-900/10 hover:border-green-500/30"
            />
          </motion.div>
        </DraggableDashboard>
      </motion.div>

      {/* Voice Assistant */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => console.log("Voice assistant activated")}
        >
          <div className="relative">
            <FaRobot className="h-6 w-6" />
            <motion.div
              className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default EnhancedAdminDashboard;
