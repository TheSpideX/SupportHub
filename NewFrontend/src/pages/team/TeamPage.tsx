import React, { useState } from "react";
import {
  FaUsersCog,
  FaSearch,
  FaFilter,
  FaEllipsisH,
  FaUserEdit,
  FaTrash,
  FaEnvelope,
  FaChartBar,
  FaExchangeAlt,
  FaTicketAlt,
  FaInfoCircle,
  FaUserPlus,
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
import { Progress } from "@/components/ui/progress";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "online" | "offline" | "away";
  avatar?: string;
  assignedTickets: number;
  resolvedTickets: number;
  performance: number;
  lastActive: string;
}

const TeamPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  // Sample team members data
  const teamMembers: TeamMember[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john.doe@example.com",
      role: "Team Lead",
      status: "online",
      assignedTickets: 8,
      resolvedTickets: 5,
      performance: 92,
      lastActive: "Just now",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      role: "Technical Specialist",
      status: "online",
      assignedTickets: 12,
      resolvedTickets: 9,
      performance: 88,
      lastActive: "5 minutes ago",
    },
    {
      id: "3",
      name: "Robert Johnson",
      email: "robert.johnson@example.com",
      role: "Support Engineer",
      status: "away",
      assignedTickets: 6,
      resolvedTickets: 4,
      performance: 85,
      lastActive: "15 minutes ago",
    },
    {
      id: "4",
      name: "Emily Davis",
      email: "emily.davis@example.com",
      role: "Technical Specialist",
      status: "offline",
      assignedTickets: 10,
      resolvedTickets: 8,
      performance: 90,
      lastActive: "1 hour ago",
    },
    {
      id: "5",
      name: "Michael Brown",
      email: "michael.brown@example.com",
      role: "Support Engineer",
      status: "online",
      assignedTickets: 7,
      resolvedTickets: 6,
      performance: 94,
      lastActive: "Just now",
    },
    {
      id: "6",
      name: "Sarah Wilson",
      email: "sarah.wilson@example.com",
      role: "Technical Specialist",
      status: "offline",
      assignedTickets: 9,
      resolvedTickets: 7,
      performance: 87,
      lastActive: "3 hours ago",
    },
    {
      id: "7",
      name: "David Miller",
      email: "david.miller@example.com",
      role: "Support Engineer",
      status: "away",
      assignedTickets: 5,
      resolvedTickets: 3,
      performance: 82,
      lastActive: "30 minutes ago",
    },
    {
      id: "8",
      name: "Lisa Taylor",
      email: "lisa.taylor@example.com",
      role: "Technical Specialist",
      status: "online",
      assignedTickets: 11,
      resolvedTickets: 10,
      performance: 96,
      lastActive: "10 minutes ago",
    },
  ];

  // Filter team members based on search query and role filter
  const filteredTeamMembers = teamMembers.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter ? member.role === roleFilter : true;

    return matchesSearch && matchesRole;
  });

  // Get unique roles
  const roles = Array.from(new Set(teamMembers.map((member) => member.role)));

  // Handle team member actions
  const handleEditMember = (memberId: string) => {
    console.log(`Editing team member ${memberId}`);
  };

  const handleDeleteMember = (memberId: string) => {
    console.log(`Deleting team member ${memberId}`);
  };

  const handleSendEmail = (memberId: string) => {
    console.log(`Sending email to team member ${memberId}`);
  };

  const handleViewTickets = (memberId: string) => {
    console.log(`Viewing tickets for team member ${memberId}`);
  };

  const handleReassignTickets = (memberId: string) => {
    console.log(`Reassigning tickets for team member ${memberId}`);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "offline":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      case "away":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get performance color
  const getPerformanceColor = (performance: number) => {
    if (performance >= 90) return "bg-green-500";
    if (performance >= 80) return "bg-blue-500";
    if (performance >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <EnhancedAdminPageTemplate
      title="Team Management"
      description="Manage your support team members"
      icon={FaUsersCog}
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Team", href: "/team" },
      ]}
      actions={[
        {
          label: "Add Team Member",
          onClick: () => console.log("Add new team member"),
          icon: FaUserPlus,
        },
      ]}
    >
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="mb-6 bg-gray-700/50 p-1">
          <TabsTrigger
            value="members"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            Team Members
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            Performance
          </TabsTrigger>
          <TabsTrigger
            value="workload"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            Workload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card className="bg-gray-800/50 border-gray-700/50">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-gray-700/50">
              <CardTitle className="text-white">Team Members</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="w-full sm:w-64 relative">
                  <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <FaSearch />
                  </div>
                  <input
                    type="text"
                    placeholder="Search team members..."
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
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left border-b border-gray-700/50">
                      <th className="px-4 py-3 font-medium text-gray-300">
                        Team Member
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-300">
                        Role
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-300">
                        Status
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-300">
                        Tickets
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-300">
                        Performance
                      </th>
                      <th className="px-4 py-3 font-medium text-gray-300">
                        Last Active
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeamMembers.length > 0 ? (
                      filteredTeamMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors duration-150"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium mr-3 text-white">
                                {member.avatar ? (
                                  <img
                                    src={member.avatar}
                                    alt={member.name}
                                    className="h-full w-full rounded-full object-cover"
                                  />
                                ) : (
                                  member.name.charAt(0) +
                                  member.name.split(" ")[1]?.charAt(0)
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-white">
                                  {member.name}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {member.role}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={getStatusBadgeColor(member.status)}
                            >
                              {member.status.charAt(0).toUpperCase() +
                                member.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <span className="font-medium text-white">
                                {member.resolvedTickets}
                              </span>
                              <span className="text-gray-400 mx-1">/</span>
                              <span className="text-gray-300">
                                {member.assignedTickets}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 ml-2"
                                onClick={() => handleViewTickets(member.id)}
                                title="View Tickets"
                              >
                                <FaTicketAlt className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <div className="w-24 mr-2">
                                <Progress
                                  value={member.performance}
                                  className="h-2"
                                  indicatorClassName={getPerformanceColor(
                                    member.performance
                                  )}
                                />
                              </div>
                              <span className="text-gray-300">
                                {member.performance}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {member.lastActive}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-100 hover:bg-gray-700/50"
                                onClick={() => handleSendEmail(member.id)}
                                title="Send Email"
                              >
                                <FaEnvelope className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-gray-100 hover:bg-gray-700/50"
                                  >
                                    <FaEllipsisH className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-gray-800 border-gray-700 text-gray-300"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleEditMember(member.id)}
                                    className="hover:bg-gray-700 focus:bg-gray-700"
                                  >
                                    <FaUserEdit className="h-4 w-4 mr-2 text-blue-400" />
                                    Edit Member
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleViewTickets(member.id)}
                                    className="hover:bg-gray-700 focus:bg-gray-700"
                                  >
                                    <FaTicketAlt className="h-4 w-4 mr-2 text-green-400" />
                                    View Tickets
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleReassignTickets(member.id)
                                    }
                                    className="hover:bg-gray-700 focus:bg-gray-700"
                                  >
                                    <FaExchangeAlt className="h-4 w-4 mr-2 text-purple-400" />
                                    Reassign Tickets
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSendEmail(member.id)}
                                    className="hover:bg-gray-700 focus:bg-gray-700"
                                  >
                                    <FaEnvelope className="h-4 w-4 mr-2 text-yellow-400" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDeleteMember(member.id)
                                    }
                                    className="text-red-400 hover:bg-gray-700 focus:bg-gray-700"
                                  >
                                    <FaTrash className="h-4 w-4 mr-2" />
                                    Remove Member
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
                            No team members found
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 mt-2">
                            {searchQuery || roleFilter
                              ? "Try adjusting your filters"
                              : "No team members available"}
                          </p>
                          {(searchQuery || roleFilter) && (
                            <Button
                              variant="link"
                              onClick={() => {
                                setSearchQuery("");
                                setRoleFilter(null);
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

        <TabsContent value="performance">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <FaChartBar className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium">Team Performance</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  View detailed performance metrics for your team
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workload">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <FaTicketAlt className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium">Team Workload</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  Manage and balance workload across team members
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </EnhancedAdminPageTemplate>
  );
};

export default TeamPage;
