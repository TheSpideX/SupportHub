import React, { useState, useEffect } from "react";
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
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaSync,
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
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { userApi, User } from "@/api/userApi";
import CreateUserModal from "@/features/user/components/CreateUserModal";
import EditUserModal from "@/features/user/components/EditUserModal";
import DeleteUserModal from "@/features/user/components/DeleteUserModal";
import ResetPasswordModal from "@/features/user/components/ResetPasswordModal";
import { formatDistanceToNow } from "date-fns";

const UserManagementPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserData, setSelectedUserData] = useState<User | null>(null);

  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userApi.getAllUsers({
        search: searchQuery || undefined,
        role: selectedRole || undefined,
        status: selectedStatus || undefined,
        page: currentPage,
        limit: pageSize,
      });

      setUsers(response.data);
      setTotalPages(response.pagination.pages);
      setTotalUsers(response.pagination.total);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, selectedRole, selectedStatus]);

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    fetchUsers();
  };

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
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((user) => user.id));
    }
  };

  // Handle user actions
  const handleEditUser = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedUserData(user);
    setEditUserModalOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedUserData(user);
    setDeleteUserModalOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedUserData(user);
    setResetPasswordModalOpen(true);
  };

  const handleSendEmail = (userId: string) => {
    console.log(`Sending email to user ${userId}`);
    toast.success("Email functionality not implemented yet");
  };

  const handleChangeStatus = async (userId: string, newStatus: string) => {
    try {
      await userApi.changeUserStatus(userId, newStatus);
      toast.success(`User status changed to ${newStatus}`);
      fetchUsers();
    } catch (error) {
      console.error("Error changing user status:", error);
      toast.error("Failed to change user status");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;

    if (
      confirm(`Are you sure you want to delete ${selectedUsers.length} users?`)
    ) {
      try {
        // In a real implementation, you would use a bulk delete endpoint
        // For now, we'll delete them one by one
        for (const userId of selectedUsers) {
          await userApi.deleteUser(userId);
        }

        toast.success(`${selectedUsers.length} users deleted successfully`);
        setSelectedUsers([]);
        fetchUsers();
      } catch (error) {
        console.error("Error deleting users:", error);
        toast.error("Failed to delete users");
      }
    }
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    if (selectedUsers.length === 0) return;

    try {
      // In a real implementation, you would use a bulk update endpoint
      // For now, we'll update them one by one
      for (const userId of selectedUsers) {
        await userApi.changeUserStatus(userId, newStatus);
      }

      toast.success(`${selectedUsers.length} users updated to ${newStatus}`);
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      console.error("Error updating users:", error);
      toast.error("Failed to update users");
    }
  };

  // Define available roles and statuses
  const availableRoles = ["admin", "team_lead", "technical", "support"];
  const availableStatuses = ["active", "inactive", "pending"];

  // Filter users based on search query, role, and status
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === "" ||
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = selectedRole === null || user.role === selectedRole;
    const matchesStatus =
      selectedStatus === null || user.status === selectedStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

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

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500 text-white">
            <FaCheck className="mr-1 h-3 w-3" /> Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge className="bg-red-500 text-white">
            <FaTimes className="mr-1 h-3 w-3" /> Inactive
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500 text-white">
            <FaExclamationTriangle className="mr-1 h-3 w-3" /> Pending
          </Badge>
        );
      default:
        return <Badge className="bg-gray-500 text-white">{status}</Badge>;
    }
  };

  // Get role badge
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-500 text-white">Admin</Badge>;
      case "team_lead":
        return <Badge className="bg-blue-500 text-white">Team Lead</Badge>;
      case "technical":
        return <Badge className="bg-indigo-500 text-white">Technical</Badge>;
      case "support":
        return <Badge className="bg-teal-500 text-white">Support</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white">{role}</Badge>;
    }
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
                    onClick={() => setCreateUserModalOpen(true)}
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
                    value={selectedRole || "all"}
                    onValueChange={(value) =>
                      setSelectedRole(value === "all" ? null : value)
                    }
                  >
                    <SelectTrigger className="w-[150px] bg-gray-900/50 border-gray-700 text-white">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="all">All Roles</SelectItem>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedStatus || "all"}
                    onValueChange={(value) =>
                      setSelectedStatus(value === "all" ? null : value)
                    }
                  >
                    <SelectTrigger className="w-[150px] bg-gray-900/50 border-gray-700 text-white">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="all">All Statuses</SelectItem>
                      {availableStatuses.map((status) => (
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
                            Created
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
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-xs text-gray-400">
                                ID: {user.id}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-white">
                              {user.email}
                            </td>
                            <td className="px-4 py-3">
                              {getRoleBadge(user.role)}
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(user.status)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white">
                              {user.createdAt
                                ? formatDistanceToNow(
                                    new Date(user.createdAt),
                                    { addSuffix: true }
                                  )
                                : "Unknown"}
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
                                    onClick={() => handleEditUser(user)}
                                  >
                                    <FaUserEdit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleResetPassword(user)}
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
                                    onClick={() => handleDeleteUser(user)}
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

      {/* Modals */}
      <CreateUserModal
        isOpen={createUserModalOpen}
        onClose={() => setCreateUserModalOpen(false)}
        onSuccess={() => {
          setCreateUserModalOpen(false);
          fetchUsers();
        }}
      />

      {selectedUserData && (
        <>
          <EditUserModal
            isOpen={editUserModalOpen}
            onClose={() => setEditUserModalOpen(false)}
            user={selectedUserData}
            onSuccess={() => {
              setEditUserModalOpen(false);
              fetchUsers();
            }}
          />

          <DeleteUserModal
            isOpen={deleteUserModalOpen}
            onClose={() => setDeleteUserModalOpen(false)}
            user={selectedUserData}
            onSuccess={() => {
              setDeleteUserModalOpen(false);
              fetchUsers();
            }}
          />

          <ResetPasswordModal
            isOpen={resetPasswordModalOpen}
            onClose={() => setResetPasswordModalOpen(false)}
            user={selectedUserData}
            onSuccess={() => {
              setResetPasswordModalOpen(false);
              toast.success("Password reset successfully");
            }}
          />
        </>
      )}
    </div>
  );
};

export default UserManagementPage;
