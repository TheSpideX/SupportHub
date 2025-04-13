import React, { useState } from "react";
import {
  FaCheckSquare,
  FaSearch,
  FaFilter,
  FaEllipsisH,
  FaCheck,
  FaTimes,
  FaEye,
  FaHistory,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";

import { Button } from "@/components/ui/buttons/Button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/Checkbox";

interface Approval {
  id: string;
  title: string;
  type: "access" | "purchase" | "deployment" | "other";
  requestedBy: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  status: "pending" | "approved" | "rejected";
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
  dueDate: string;
}

const ApprovalsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApprovals, setSelectedApprovals] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Sample approvals data
  const approvals: Approval[] = [
    {
      id: "1",
      title: "Access request for admin dashboard",
      type: "access",
      requestedBy: {
        id: "101",
        name: "John Doe",
        email: "john.doe@example.com",
      },
      status: "pending",
      priority: "high",
      createdAt: "2023-10-15",
      dueDate: "2023-10-18",
    },
    {
      id: "2",
      title: "Software license purchase approval",
      type: "purchase",
      requestedBy: {
        id: "102",
        name: "Jane Smith",
        email: "jane.smith@example.com",
      },
      status: "approved",
      priority: "medium",
      createdAt: "2023-10-14",
      dueDate: "2023-10-20",
    },
    {
      id: "3",
      title: "New feature deployment to production",
      type: "deployment",
      requestedBy: {
        id: "103",
        name: "Robert Johnson",
        email: "robert.johnson@example.com",
      },
      status: "pending",
      priority: "critical",
      createdAt: "2023-10-16",
      dueDate: "2023-10-17",
    },
    {
      id: "4",
      title: "Budget increase for support team",
      type: "other",
      requestedBy: {
        id: "104",
        name: "Emily Davis",
        email: "emily.davis@example.com",
      },
      status: "rejected",
      priority: "low",
      createdAt: "2023-10-10",
      dueDate: "2023-10-15",
    },
    {
      id: "5",
      title: "Third-party API integration approval",
      type: "access",
      requestedBy: {
        id: "105",
        name: "Michael Brown",
        email: "michael.brown@example.com",
      },
      status: "pending",
      priority: "high",
      createdAt: "2023-10-16",
      dueDate: "2023-10-19",
    },
  ];

  // Filter approvals based on search query and filters
  const filteredApprovals = approvals.filter((approval) => {
    const matchesSearch = approval.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter
      ? approval.status === statusFilter
      : true;
    const matchesType = typeFilter ? approval.type === typeFilter : true;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Get unique approval types and statuses
  const types = Array.from(new Set(approvals.map((approval) => approval.type)));
  const statuses = Array.from(
    new Set(approvals.map((approval) => approval.status))
  );

  // Handle approval selection
  const toggleApprovalSelection = (approvalId: string) => {
    setSelectedApprovals((prev) =>
      prev.includes(approvalId)
        ? prev.filter((id) => id !== approvalId)
        : [...prev, approvalId]
    );
  };

  // Handle select all approvals
  const toggleSelectAll = () => {
    if (selectedApprovals.length === filteredApprovals.length) {
      setSelectedApprovals([]);
    } else {
      setSelectedApprovals(filteredApprovals.map((approval) => approval.id));
    }
  };

  // Handle approval actions
  const handleApprove = (approvalId: string) => {
    console.log(`Approving request ${approvalId}`);
  };

  const handleReject = (approvalId: string) => {
    console.log(`Rejecting request ${approvalId}`);
  };

  const handleViewDetails = (approvalId: string) => {
    console.log(`Viewing details for request ${approvalId}`);
  };

  const handleViewHistory = (approvalId: string) => {
    console.log(`Viewing history for request ${approvalId}`);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get priority badge color
  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
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

  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                    <FaCheckSquare className="h-8 w-8 text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                      Approvals
                    </h1>
                    <p className="mt-1 text-gray-300">
                      Manage and process approval requests
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-600 text-white shadow-md"
                    onClick={() => console.log("Approve selected items")}
                  >
                    <FaCheck className="mr-2 h-4 w-4" />
                    Approve Selected
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white shadow-md"
                    onClick={() => console.log("Reject selected items")}
                  >
                    <FaTimes className="mr-2 h-4 w-4" />
                    Reject Selected
                  </Button>
                </div>
              </div>
            </motion.div>
            {/* Tabs section */}
            <motion.div variants={itemVariants}>
              <Tabs defaultValue="pending" className="w-full">
                <TabsList className="bg-gray-800/50 border border-gray-700/50 p-1 rounded-lg mb-6">
                  <TabsTrigger
                    value="pending"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                  >
                    Pending
                  </TabsTrigger>
                  <TabsTrigger
                    value="approved"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                  >
                    Approved
                  </TabsTrigger>
                  <TabsTrigger
                    value="rejected"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                  >
                    Rejected
                  </TabsTrigger>
                  <TabsTrigger
                    value="all"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
                  >
                    All Requests
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                  <motion.div
                    variants={itemVariants}
                    className="bg-gray-800/30 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white">
                        Pending Approvals
                      </h2>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-64 relative">
                          <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                            <FaSearch />
                          </div>
                          <input
                            type="text"
                            placeholder="Search approvals..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2 px-10 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                        >
                          <FaFilter />
                        </Button>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="text-left border-b border-gray-700/50">
                              <th className="px-4 py-3">
                                <Checkbox
                                  id="select-all-approvals"
                                  checked={
                                    filteredApprovals.length > 0 &&
                                    selectedApprovals.length ===
                                      filteredApprovals.length
                                  }
                                  onCheckedChange={toggleSelectAll}
                                  className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Request
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Type
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Requested By
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Priority
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-300">
                                Due Date
                              </th>
                              <th className="px-4 py-3 text-right font-medium text-gray-300">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredApprovals
                              .filter(
                                (approval) => approval.status === "pending"
                              )
                              .map((approval) => (
                                <tr
                                  key={approval.id}
                                  className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors duration-150"
                                >
                                  <td className="px-4 py-3">
                                    <Checkbox
                                      id={`select-approval-${approval.id}`}
                                      checked={selectedApprovals.includes(
                                        approval.id
                                      )}
                                      onCheckedChange={() =>
                                        toggleApprovalSelection(approval.id)
                                      }
                                      className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-white">
                                      {approval.title}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      ID: {approval.id}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      variant="outline"
                                      className="bg-gray-800 text-blue-400 border-blue-500/50"
                                    >
                                      {approval.type.charAt(0).toUpperCase() +
                                        approval.type.slice(1)}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center">
                                      <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium mr-2 text-blue-300">
                                        {approval.requestedBy.avatar ? (
                                          <img
                                            src={approval.requestedBy.avatar}
                                            alt={approval.requestedBy.name}
                                            className="h-full w-full rounded-full object-cover"
                                          />
                                        ) : (
                                          approval.requestedBy.name.charAt(0) +
                                          approval.requestedBy.name
                                            .split(" ")[1]
                                            ?.charAt(0)
                                        )}
                                      </div>
                                      <div>
                                        <div className="font-medium text-white">
                                          {approval.requestedBy.name}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {approval.requestedBy.email}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      className={getPriorityBadgeColor(
                                        approval.priority
                                      )}
                                    >
                                      {approval.priority
                                        .charAt(0)
                                        .toUpperCase() +
                                        approval.priority.slice(1)}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    {approval.dueDate}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-green-600 dark:text-green-400"
                                        onClick={() =>
                                          handleApprove(approval.id)
                                        }
                                        title="Approve"
                                      >
                                        <FaCheck className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-600 dark:text-red-400"
                                        onClick={() =>
                                          handleReject(approval.id)
                                        }
                                        title="Reject"
                                      >
                                        <FaTimes className="h-4 w-4" />
                                      </Button>
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
                                            onClick={() =>
                                              handleViewDetails(approval.id)
                                            }
                                          >
                                            <FaEye className="h-4 w-4 mr-2" />
                                            View Details
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleViewHistory(approval.id)
                                            }
                                          >
                                            <FaHistory className="h-4 w-4 mr-2" />
                                            View History
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            {filteredApprovals.filter(
                              (approval) => approval.status === "pending"
                            ).length === 0 && (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="px-4 py-8 text-center"
                                >
                                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                                    <FaSearch className="h-6 w-6 text-gray-400" />
                                  </div>
                                  <h3 className="text-lg font-medium">
                                    No pending approvals found
                                  </h3>
                                  <p className="text-gray-500 dark:text-gray-400 mt-2">
                                    {searchQuery
                                      ? "Try adjusting your search"
                                      : "No pending approvals available"}
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
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                <TabsContent value="approved">
                  <motion.div
                    variants={itemVariants}
                    className="bg-gray-800/30 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white">
                        Approved Requests
                      </h2>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-64 relative">
                          <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                            <FaSearch />
                          </div>
                          <input
                            type="text"
                            placeholder="Search approvals..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2 px-10 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                        >
                          <FaFilter />
                        </Button>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                          <FaCheck className="h-6 w-6 text-green-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white">
                          Approved Requests
                        </h3>
                        <p className="text-gray-300 mt-2">
                          View all approved requests
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                <TabsContent value="rejected">
                  <motion.div
                    variants={itemVariants}
                    className="bg-gray-800/30 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white">
                        Rejected Requests
                      </h2>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-64 relative">
                          <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                            <FaSearch />
                          </div>
                          <input
                            type="text"
                            placeholder="Search approvals..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2 px-10 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                        >
                          <FaFilter />
                        </Button>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
                          <FaTimes className="h-6 w-6 text-red-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white">
                          Rejected Requests
                        </h3>
                        <p className="text-gray-300 mt-2">
                          View all rejected requests
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                <TabsContent value="all">
                  <motion.div
                    variants={itemVariants}
                    className="bg-gray-800/30 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white">
                        All Requests
                      </h2>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-64 relative">
                          <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                            <FaSearch />
                          </div>
                          <input
                            type="text"
                            placeholder="Search approvals..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2 px-10 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                        >
                          <FaFilter />
                        </Button>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                          <FaCheckSquare className="h-6 w-6 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white">
                          All Requests
                        </h3>
                        <p className="text-gray-300 mt-2">
                          View all approval requests
                        </p>
                      </div>
                    </div>
                  </motion.div>
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

export default ApprovalsPage;
