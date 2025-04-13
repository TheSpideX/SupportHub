import React, { useState } from "react";
import {
  FaUsers,
  FaUserPlus,
  FaSearch,
  FaFilter,
  FaEllipsisH,
  FaUserEdit,
  FaTrash,
  FaLock,
  FaEnvelope,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive" | "pending";
  lastLogin: string;
  createdAt: string;
}

const UserManagementPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Sample users data
  const users: User[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john.doe@example.com",
      role: "Admin",
      status: "active",
      lastLogin: "2023-10-16 14:30",
      createdAt: "2023-01-15",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      role: "Agent",
      status: "active",
      lastLogin: "2023-10-15 09:45",
      createdAt: "2023-02-20",
    },
    {
      id: "3",
      name: "Robert Johnson",
      email: "robert.johnson@example.com",
      role: "Manager",
      status: "active",
      lastLogin: "2023-10-14 16:20",
      createdAt: "2023-03-10",
    },
    {
      id: "4",
      name: "Emily Davis",
      email: "emily.davis@example.com",
      role: "Agent",
      status: "inactive",
      lastLogin: "2023-09-30 11:15",
      createdAt: "2023-04-05",
    },
    {
      id: "5",
      name: "Michael Wilson",
      email: "michael.wilson@example.com",
      role: "Customer",
      status: "pending",
      lastLogin: "Never",
      createdAt: "2023-10-10",
    },
  ];

  // Filter users based on search query, role, and status
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === "" ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = selectedRole === null || user.role === selectedRole;
    const matchesStatus =
      selectedStatus === null || user.status === selectedStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Get unique roles and statuses
  const roles = Array.from(new Set(users.map((user) => user.role)));
  const statuses = Array.from(new Set(users.map((user) => user.status)));

  // Handle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Handle select all users
  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((user) => user.id));
    }
  };

  // Handle user actions
  const handleEditUser = (userId: string) => {
    console.log(`Editing user ${userId}`);
  };

  const handleDeleteUser = (userId: string) => {
    console.log(`Deleting user ${userId}`);
  };

  const handleResetPassword = (userId: string) => {
    console.log(`Resetting password for user ${userId}`);
  };

  const handleSendEmail = (userId: string) => {
    console.log(`Sending email to user ${userId}`);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: User["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "inactive":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                    <FaUsers className="h-8 w-8 text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                      User Management
                    </h1>
                    <p className="mt-1 text-gray-300">
                      Manage users, roles, and permissions
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white shadow-md"
                    onClick={() => console.log("Add new user")}
                  >
                    <FaUserPlus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                </div>
              </div>
            </motion.div>
            {/* Filters and Search */}
            <motion.div
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="relative flex-1">
                  <div className="w-full sm:w-64 relative">
                    <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                      <FaSearch />
                    </div>
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full py-2 px-10 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedRole || ""}
                    onValueChange={(value) => setSelectedRole(value || null)}
                  >
                    <SelectTrigger className="w-[150px] bg-gray-900/50 border-gray-700 text-white">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="">All Roles</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedStatus || ""}
                    onValueChange={(value) => setSelectedStatus(value || null)}
                  >
                    <SelectTrigger className="w-[150px] bg-gray-900/50 border-gray-700 text-white">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="">All Statuses</SelectItem>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedRole(null);
                      setSelectedStatus(null);
                    }}
                    className="ml-2 border-gray-700 hover:bg-gray-700/50 text-gray-300"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Users Table */}
            <motion.div
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
            >
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Users</h2>
                {selectedUsers.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-300">
                      {selectedUsers.length} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => console.log("Bulk action")}
                      className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                    >
                      Bulk Actions
                    </Button>
                  </div>
                )}
              </div>
              <div className="p-6">
                {filteredUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-700/50">
                          <th className="px-4 py-3 text-left">
                            <div className="flex items-center">
                              <Checkbox
                                id="select-all"
                                checked={
                                  selectedUsers.length ===
                                    filteredUsers.length &&
                                  filteredUsers.length > 0
                                }
                                onCheckedChange={toggleSelectAll}
                                className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                            Role
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                            Last Login
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr
                            key={user.id}
                            className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors duration-150"
                          >
                            <td className="px-4 py-3">
                              <Checkbox
                                id={`select-user-${user.id}`}
                                checked={selectedUsers.includes(user.id)}
                                onCheckedChange={() =>
                                  toggleUserSelection(user.id)
                                }
                                className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-white">
                                {user.name}
                              </div>
                              <div className="text-xs text-gray-400">
                                ID: {user.id}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-white">
                              {user.email}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className="bg-gray-800 text-blue-400 border-blue-500/50"
                              >
                                {user.role}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                className={getStatusBadgeColor(user.status)}
                              >
                                {user.status.charAt(0).toUpperCase() +
                                  user.status.slice(1)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-white">
                              {user.lastLogin}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-gray-300 hover:text-white"
                                  >
                                    <FaEllipsisH className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-gray-800 border-gray-700 text-white"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleEditUser(user.id)}
                                  >
                                    <FaUserEdit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleResetPassword(user.id)}
                                  >
                                    <FaLock className="h-4 w-4 mr-2" />
                                    Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSendEmail(user.id)}
                                  >
                                    <FaEnvelope className="h-4 w-4 mr-2" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-400"
                                  >
                                    <FaTrash className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800/50 mb-4">
                      <FaSearch className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white">
                      No users found
                    </h3>
                    <p className="text-gray-300 mt-2">
                      {searchQuery || selectedRole || selectedStatus
                        ? "Try adjusting your filters"
                        : "No users available"}
                    </p>
                    {(searchQuery || selectedRole || selectedStatus) && (
                      <Button
                        variant="link"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedRole(null);
                          setSelectedStatus(null);
                        }}
                        className="mt-2 text-blue-400 hover:text-blue-300"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default UserManagementPage;
