import React, { useState } from "react";
import {
  FaUsers,
  FaUserPlus,
  FaSearch,
  FaFilter,
  FaEllipsisH,
  FaUserEdit,
  FaTrash,
  FaEnvelope,
  FaTicketAlt,
  FaInfoCircle,
  FaExternalLinkAlt,
} from "react-icons/fa";
import EnhancedAdminPageTemplate from "@/components/dashboard/EnhancedAdminPageTemplate";
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
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/label";

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  status: "active" | "inactive";
  tickets: number;
  lastActivity: string;
  joinDate: string;
}

const CustomersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Sample customers data
  const customers: Customer[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john.doe@example.com",
      company: "Acme Inc.",
      status: "active",
      tickets: 3,
      lastActivity: "2023-10-16 14:30",
      joinDate: "2023-01-15",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      company: "XYZ Corp",
      status: "active",
      tickets: 1,
      lastActivity: "2023-10-15 09:45",
      joinDate: "2023-02-20",
    },
    {
      id: "3",
      name: "Robert Johnson",
      email: "robert.johnson@example.com",
      company: "123 Industries",
      status: "inactive",
      tickets: 0,
      lastActivity: "2023-09-30 16:20",
      joinDate: "2023-03-10",
    },
    {
      id: "4",
      name: "Emily Davis",
      email: "emily.davis@example.com",
      company: "Tech Solutions",
      status: "active",
      tickets: 5,
      lastActivity: "2023-10-16 11:15",
      joinDate: "2023-04-05",
    },
    {
      id: "5",
      name: "Michael Brown",
      email: "michael.brown@example.com",
      company: "Global Services",
      status: "active",
      tickets: 2,
      lastActivity: "2023-10-14 13:50",
      joinDate: "2023-05-12",
    },
    {
      id: "6",
      name: "Sarah Wilson",
      email: "sarah.wilson@example.com",
      company: "Innovative Solutions",
      status: "inactive",
      tickets: 0,
      lastActivity: "2023-09-20 10:30",
      joinDate: "2023-06-18",
    },
    {
      id: "7",
      name: "David Miller",
      email: "david.miller@example.com",
      company: "Premier Products",
      status: "active",
      tickets: 4,
      lastActivity: "2023-10-16 09:15",
      joinDate: "2023-07-22",
    },
    {
      id: "8",
      name: "Lisa Taylor",
      email: "lisa.taylor@example.com",
      company: "Smart Systems",
      status: "active",
      tickets: 1,
      lastActivity: "2023-10-15 15:40",
      joinDate: "2023-08-05",
    },
  ];

  // Filter customers based on search query and status filter
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.company.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter
      ? customer.status === statusFilter
      : true;

    return matchesSearch && matchesStatus;
  });

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
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map((customer) => customer.id));
    }
  };

  // Handle customer actions
  const handleEditCustomer = (customerId: string) => {
    console.log(`Editing customer ${customerId}`);
  };

  const handleDeleteCustomer = (customerId: string) => {
    console.log(`Deleting customer ${customerId}`);
  };

  const handleSendEmail = (customerId: string) => {
    console.log(`Sending email to customer ${customerId}`);
  };

  const handleViewTickets = (customerId: string) => {
    console.log(`Viewing tickets for customer ${customerId}`);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "inactive":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <EnhancedAdminPageTemplate
      title="Customers"
      description="Manage customer accounts and information"
      icon={FaUsers}
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Customers", href: "/customers" },
      ]}
      actions={[
        {
          label: "Add Customer",
          onClick: () => console.log("Add new customer"),
          icon: FaUserPlus,
        },
      ]}
    >
      <Tabs defaultValue="all-customers" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all-customers">All Customers</TabsTrigger>
          <TabsTrigger value="active-customers">Active</TabsTrigger>
          <TabsTrigger value="inactive-customers">Inactive</TabsTrigger>
          <TabsTrigger value="recent-activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="all-customers">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
              <CardTitle>Customer List</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <InputField
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<FaSearch className="text-gray-400" />}
                  className="w-full sm:w-64"
                />
                <Button variant="outline" size="icon">
                  <FaFilter />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                      <th className="px-4 py-3 rounded-tl-lg">
                        <Checkbox
                          id="select-all-customers"
                          checked={
                            filteredCustomers.length > 0 &&
                            selectedCustomers.length ===
                              filteredCustomers.length
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Tickets</th>
                      <th className="px-4 py-3 font-medium">Last Activity</th>
                      <th className="px-4 py-3 rounded-tr-lg text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((customer) => (
                        <tr
                          key={customer.id}
                          className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              id={`select-customer-${customer.id}`}
                              checked={selectedCustomers.includes(customer.id)}
                              onCheckedChange={() =>
                                toggleCustomerSelection(customer.id)
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {customer.email}
                            </div>
                          </td>
                          <td className="px-4 py-3">{customer.company}</td>
                          <td className="px-4 py-3">
                            <Badge
                              className={getStatusBadgeColor(customer.status)}
                            >
                              {customer.status.charAt(0).toUpperCase() +
                                customer.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <span className="font-medium">
                                {customer.tickets}
                              </span>
                              {customer.tickets > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 ml-2"
                                  onClick={() => handleViewTickets(customer.id)}
                                  title="View Tickets"
                                >
                                  <FaExternalLinkAlt className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {customer.lastActivity}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleSendEmail(customer.id)}
                                title="Send Email"
                              >
                                <FaEnvelope className="h-4 w-4" />
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
                                      handleEditCustomer(customer.id)
                                    }
                                  >
                                    <FaUserEdit className="h-4 w-4 mr-2" />
                                    Edit Customer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleViewTickets(customer.id)
                                    }
                                  >
                                    <FaTicketAlt className="h-4 w-4 mr-2" />
                                    View Tickets
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSendEmail(customer.id)}
                                  >
                                    <FaEnvelope className="h-4 w-4 mr-2" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDeleteCustomer(customer.id)
                                    }
                                    className="text-red-600 dark:text-red-400"
                                  >
                                    <FaTrash className="h-4 w-4 mr-2" />
                                    Delete Customer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                            <FaSearch className="h-6 w-6 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-medium">
                            No customers found
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 mt-2">
                            {searchQuery || statusFilter
                              ? "Try adjusting your filters"
                              : "No customers available"}
                          </p>
                          {(searchQuery || statusFilter) && (
                            <Button
                              variant="link"
                              onClick={() => {
                                setSearchQuery("");
                                setStatusFilter(null);
                              }}
                              className="mt-2"
                            >
                              Clear filters
                            </Button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active-customers">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <FaUsers className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium">Active Customers</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  View all currently active customers
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive-customers">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <FaUsers className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium">Inactive Customers</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  View all inactive customers
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent-activity">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <FaInfoCircle className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium">Recent Activity</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  View customers with recent activity
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </EnhancedAdminPageTemplate>
  );
};

export default CustomersPage;
