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
  FaBuilding,
  FaPhone,
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
import { customerApi, Customer } from "@/api/customerApi";
import CreateCustomerModal from "@/features/customer/components/CreateCustomerModal";
import EditCustomerModal from "@/features/customer/components/EditCustomerModal";
import DeleteCustomerModal from "@/features/customer/components/DeleteCustomerModal";
import ResetPasswordModal from "@/features/customer/components/ResetPasswordModal";
import { formatDistanceToNow } from "date-fns";

const CustomerManagementPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [createCustomerModalOpen, setCreateCustomerModalOpen] = useState(false);
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false);
  const [deleteCustomerModalOpen, setDeleteCustomerModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [selectedCustomerData, setSelectedCustomerData] =
    useState<Customer | null>(null);

  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch customers
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerApi.getAllCustomers({
        search: searchQuery || undefined,
        status: selectedStatus || undefined,
        page: currentPage,
        limit: pageSize,
      });

      setCustomers(response.data);
      setTotalPages(response.pagination.pages);
      setTotalCustomers(response.pagination.total);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCustomers();
  }, [currentPage, pageSize, selectedStatus]);

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    fetchCustomers();
  };

  // Handle customer selection
  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  // Handle select all customers
  const toggleSelectAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map((customer) => customer.id));
    }
  };

  // Handle customer actions
  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerData(customer);
    setEditCustomerModalOpen(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerData(customer);
    setDeleteCustomerModalOpen(true);
  };

  const handleResetPassword = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerData(customer);
    setResetPasswordModalOpen(true);
  };

  const handleSendEmail = (customerId: string) => {
    console.log(`Sending email to customer ${customerId}`);
    toast.success("Email functionality not implemented yet");
  };

  const handleChangeStatus = async (customerId: string, newStatus: string) => {
    try {
      await customerApi.changeCustomerStatus(customerId, newStatus);
      toast.success(`Customer status changed to ${newStatus}`);
      fetchCustomers();
    } catch (error) {
      console.error("Error changing customer status:", error);
      toast.error("Failed to change customer status");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCustomers.length === 0) return;

    if (
      confirm(
        `Are you sure you want to delete ${selectedCustomers.length} customers?`
      )
    ) {
      try {
        // In a real implementation, you would use a bulk delete endpoint
        // For now, we'll delete them one by one
        for (const customerId of selectedCustomers) {
          await customerApi.deleteCustomer(customerId);
        }

        toast.success(
          `${selectedCustomers.length} customers deleted successfully`
        );
        setSelectedCustomers([]);
        fetchCustomers();
      } catch (error) {
        console.error("Error deleting customers:", error);
        toast.error("Failed to delete customers");
      }
    }
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    if (selectedCustomers.length === 0) return;

    try {
      // In a real implementation, you would use a bulk update endpoint
      // For now, we'll update them one by one
      for (const customerId of selectedCustomers) {
        await customerApi.changeCustomerStatus(customerId, newStatus);
      }

      toast.success(
        `${selectedCustomers.length} customers updated to ${newStatus}`
      );
      setSelectedCustomers([]);
      fetchCustomers();
    } catch (error) {
      console.error("Error updating customers:", error);
      toast.error("Failed to update customers");
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

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-7xl mx-auto space-y-6"
          >
            {/* Header */}
            <motion.div variants={itemVariants}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div className="mb-4 md:mb-0">
                  <div className="flex items-center">
                    <div className="mr-4 p-2 bg-teal-600/20 rounded-lg">
                      <FaUsers className="h-8 w-8 text-teal-500" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-gray-300">
                        Customer Management
                      </h1>
                      <p className="mt-1 text-gray-300">
                        Manage your organization's customers
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white shadow-md"
                    onClick={() => setCreateCustomerModalOpen(true)}
                  >
                    <FaUserPlus className="mr-2 h-4 w-4" />
                    Add Customer
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Filters and Search */}
            <motion.div variants={itemVariants}>
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Search customers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="w-full bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        onClick={handleSearch}
                      >
                        <FaSearch className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select
                      value={selectedStatus || "all"}
                      onValueChange={(value) =>
                        setSelectedStatus(value === "all" ? null : value)
                      }
                    >
                      <SelectTrigger className="w-full sm:w-40 bg-gray-700/50 border-gray-600 text-white">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-white">
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:text-white"
                      onClick={fetchCustomers}
                    >
                      <FaSync className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Bulk Actions */}
            {selectedCustomers.length > 0 && (
              <motion.div variants={itemVariants}>
                <div className="bg-teal-900/30 rounded-lg border border-teal-700/50 p-4 mb-6">
                  <div className="flex flex-col sm:flex-row justify-between items-center">
                    <div className="mb-2 sm:mb-0">
                      <span className="text-teal-300">
                        {selectedCustomers.length} customers selected
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="border-teal-600 text-teal-300 hover:text-white"
                          >
                            <FaEllipsisH className="h-4 w-4 mr-2" />
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-gray-800 border-gray-700 text-white">
                          <DropdownMenuItem
                            onClick={() => handleBulkChangeStatus("active")}
                          >
                            <FaCheck className="h-4 w-4 mr-2 text-green-500" />
                            Set Active
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleBulkChangeStatus("inactive")}
                          >
                            <FaTimes className="h-4 w-4 mr-2 text-red-500" />
                            Set Inactive
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleBulkDelete}>
                            <FaTrash className="h-4 w-4 mr-2 text-red-500" />
                            Delete Selected
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:text-white"
                        onClick={() => setSelectedCustomers([])}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Customers Table */}
            <motion.div variants={itemVariants}>
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-700/50 text-left">
                        <th className="p-4">
                          <Checkbox
                            checked={
                              selectedCustomers.length === customers.length &&
                              customers.length > 0
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                        <th className="p-4 font-medium text-gray-300">Name</th>
                        <th className="p-4 font-medium text-gray-300">Email</th>
                        <th className="p-4 font-medium text-gray-300">
                          Company
                        </th>
                        <th className="p-4 font-medium text-gray-300">Phone</th>
                        <th className="p-4 font-medium text-gray-300">
                          Status
                        </th>
                        <th className="p-4 font-medium text-gray-300">
                          Created
                        </th>
                        <th className="p-4 font-medium text-gray-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-4 text-center text-gray-400"
                          >
                            Loading customers...
                          </td>
                        </tr>
                      ) : customers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-4 text-center text-gray-400"
                          >
                            No customers found
                          </td>
                        </tr>
                      ) : (
                        customers.map((customer) => (
                          <tr
                            key={customer.id}
                            className="hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="p-4">
                              <Checkbox
                                checked={selectedCustomers.includes(
                                  customer.id
                                )}
                                onCheckedChange={() =>
                                  toggleCustomerSelection(customer.id)
                                }
                              />
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-white">
                                {customer.fullName ||
                                  `${customer.firstName} ${customer.lastName}`}
                              </div>
                            </td>
                            <td className="p-4 text-gray-300">
                              {customer.email}
                            </td>
                            <td className="p-4 text-gray-300">
                              {customer.company ? (
                                <div className="flex items-center">
                                  <FaBuilding className="mr-2 h-3 w-3 text-gray-400" />
                                  {customer.company}
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="p-4 text-gray-300">
                              {customer.phone ? (
                                <div className="flex items-center">
                                  <FaPhone className="mr-2 h-3 w-3 text-gray-400" />
                                  {customer.phone}
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              {getStatusBadge(customer.status)}
                            </td>
                            <td className="p-4 text-gray-300">
                              {customer.createdAt
                                ? formatDistanceToNow(
                                    new Date(customer.createdAt),
                                    { addSuffix: true }
                                  )
                                : "Unknown"}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center space-x-2">
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
                                      onClick={() =>
                                        handleEditCustomer(customer)
                                      }
                                    >
                                      <FaUserEdit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleResetPassword(customer)
                                      }
                                    >
                                      <FaLock className="h-4 w-4 mr-2" />
                                      Reset Password
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleSendEmail(customer.id)
                                      }
                                    >
                                      <FaEnvelope className="h-4 w-4 mr-2" />
                                      Send Email
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleDeleteCustomer(customer)
                                      }
                                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                    >
                                      <FaTrash className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-700/30 px-4 py-3 flex items-center justify-between border-t border-gray-700">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <Button
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:text-white"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:text-white"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-400">
                        Showing{" "}
                        <span className="font-medium">{customers.length}</span>{" "}
                        of <span className="font-medium">{totalCustomers}</span>{" "}
                        customers
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <Button
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:text-white rounded-l-md"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:text-white"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(currentPage - 1)}
                        >
                          Previous
                        </Button>
                        <div className="bg-gray-700 border border-gray-600 text-white px-4 py-2">
                          Page {currentPage} of {totalPages}
                        </div>
                        <Button
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:text-white"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(currentPage + 1)}
                        >
                          Next
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:text-white rounded-r-md"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                        >
                          Last
                        </Button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>

      <Footer />

      {/* Modals */}
      <CreateCustomerModal
        isOpen={createCustomerModalOpen}
        onClose={() => setCreateCustomerModalOpen(false)}
        onSuccess={() => {
          setCreateCustomerModalOpen(false);
          fetchCustomers();
        }}
      />

      {selectedCustomerData && (
        <>
          <EditCustomerModal
            isOpen={editCustomerModalOpen}
            onClose={() => setEditCustomerModalOpen(false)}
            customer={selectedCustomerData}
            onSuccess={() => {
              setEditCustomerModalOpen(false);
              fetchCustomers();
            }}
          />

          <DeleteCustomerModal
            isOpen={deleteCustomerModalOpen}
            onClose={() => setDeleteCustomerModalOpen(false)}
            customer={selectedCustomerData}
            onSuccess={() => {
              setDeleteCustomerModalOpen(false);
              fetchCustomers();
            }}
          />

          <ResetPasswordModal
            isOpen={resetPasswordModalOpen}
            onClose={() => setResetPasswordModalOpen(false)}
            customer={selectedCustomerData}
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

export default CustomerManagementPage;
