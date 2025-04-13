import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FaHistory,
  FaTicketAlt,
  FaUser,
  FaServer,
  FaShieldAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaEllipsisH,
  FaFilter,
  FaSearch,
  FaCalendarAlt,
} from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/buttons/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: "ticket" | "user" | "system" | "security";
  action: string;
  subject: string;
  timestamp: Date | string;
  user?: {
    name: string;
    avatar?: string;
    role?: string;
  };
  status?: "success" | "warning" | "error" | "info";
  details?: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  title?: string;
  maxItems?: number;
  className?: string;
  onViewAll?: () => void;
  onFilter?: (filter: string) => void;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  title = "Recent Activity",
  maxItems = 5,
  className = "",
  onViewAll,
  onFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState(maxItems);

  // Filter activities based on search query and active filter
  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      searchQuery === "" ||
      activity.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.user?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      activeFilter === null || activity.type === activeFilter;

    return matchesSearch && matchesFilter;
  });

  const displayedActivities = filteredActivities.slice(0, visibleItems);

  const handleFilterChange = (filter: string | null) => {
    setActiveFilter(filter);
    if (onFilter && filter) {
      onFilter(filter);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "ticket":
        return <FaTicketAlt className="h-4 w-4" />;
      case "user":
        return <FaUser className="h-4 w-4" />;
      case "system":
        return <FaServer className="h-4 w-4" />;
      case "security":
        return <FaShieldAlt className="h-4 w-4" />;
      default:
        return <FaHistory className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "success":
        return <FaCheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <FaExclamationTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <FaTimesCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "ticket":
        return "bg-blue-500/20 text-blue-500";
      case "user":
        return "bg-purple-500/20 text-purple-500";
      case "system":
        return "bg-green-500/20 text-green-500";
      case "security":
        return "bg-red-500/20 text-red-500";
      default:
        return "bg-gray-500/20 text-gray-500";
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
      },
    },
  };

  return (
    <motion.div
      className={`bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 ${className}`}
      variants={itemVariants}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
        <div className="flex items-center">
          <FaHistory className="h-5 w-5 text-blue-400 mr-2" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
              >
                <FaFilter className="h-3.5 w-3.5 mr-2" />
                <span className="hidden sm:inline">Filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border border-gray-700 text-white">
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  activeFilter === null ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => handleFilterChange(null)}
              >
                All Activities
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  activeFilter === "ticket"
                    ? "bg-blue-600/20 text-blue-400"
                    : ""
                }`}
                onClick={() => handleFilterChange("ticket")}
              >
                <FaTicketAlt className="h-4 w-4 mr-2" />
                Tickets
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  activeFilter === "user" ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => handleFilterChange("user")}
              >
                <FaUser className="h-4 w-4 mr-2" />
                Users
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  activeFilter === "system"
                    ? "bg-blue-600/20 text-blue-400"
                    : ""
                }`}
                onClick={() => handleFilterChange("system")}
              >
                <FaServer className="h-4 w-4 mr-2" />
                System
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  activeFilter === "security"
                    ? "bg-blue-600/20 text-blue-400"
                    : ""
                }`}
                onClick={() => handleFilterChange("security")}
              >
                <FaShieldAlt className="h-4 w-4 mr-2" />
                Security
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
          >
            <FaEllipsisH className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
        </div>

        {displayedActivities.length > 0 ? (
          <motion.div
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {displayedActivities.map((activity) => {
              const timestamp =
                typeof activity.timestamp === "string"
                  ? new Date(activity.timestamp)
                  : activity.timestamp;

              return (
                <motion.div
                  key={activity.id}
                  className="flex items-start space-x-4 p-3 rounded-lg hover:bg-gray-700/30 transition-colors"
                  variants={itemVariants}
                >
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${getActivityColor(
                      activity.type
                    )}`}
                  >
                    {getActivityIcon(activity.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {activity.action}
                          <span className="ml-1 text-gray-300">
                            {activity.subject}
                          </span>
                        </p>

                        {activity.user && (
                          <div className="flex items-center mt-1">
                            <Avatar className="h-5 w-5 mr-1">
                              <AvatarImage src={activity.user.avatar} />
                              <AvatarFallback className="text-xs bg-gray-700 text-gray-300">
                                {activity.user.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-gray-400">
                              {activity.user.name}
                              {activity.user.role && (
                                <span className="text-gray-500 ml-1">
                                  ({activity.user.role})
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {activity.details && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {activity.details}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end ml-2">
                        <div className="flex items-center">
                          {getStatusIcon(activity.status)}
                          {activity.status && (
                            <Badge
                              className={`ml-2 ${
                                activity.status === "success"
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : activity.status === "warning"
                                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                  : activity.status === "error"
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              }`}
                            >
                              {activity.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center mt-1">
                          <FaCalendarAlt className="h-3 w-3 text-gray-500 mr-1" />
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(timestamp, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700/50 mb-4">
              <FaSearch className="h-6 w-6 text-gray-500" />
            </div>
            <p className="text-gray-400">No activities found</p>
            {searchQuery && (
              <Button
                variant="link"
                className="text-blue-400 hover:text-blue-300 mt-2"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            )}
          </div>
        )}

        {filteredActivities.length > visibleItems && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
              onClick={() => setVisibleItems((prev) => prev + maxItems)}
            >
              Load More
            </Button>
          </div>
        )}

        {onViewAll && (
          <div className="mt-4 pt-4 border-t border-gray-700/50 text-center">
            <Button
              variant="link"
              className="text-blue-400 hover:text-blue-300"
              onClick={onViewAll}
            >
              View All Activities
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ActivityFeed;
