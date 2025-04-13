import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FaBell,
  FaCalendarAlt,
  FaSearch,
  FaCog,
  FaFilter,
  FaDownload,
  FaSync,
} from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/buttons/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EnhancedDashboardHeaderProps {
  user: any;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  notifications: any[];
  onRefresh?: () => void;
}

const EnhancedDashboardHeader: React.FC<EnhancedDashboardHeaderProps> = ({
  user,
  selectedPeriod,
  setSelectedPeriod,
  notifications,
  onRefresh,
}) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Animation variants
  const itemVariants = {
    hidden: { y: -20, opacity: 0 },
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
      className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
      variants={itemVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:justify-between md:items-center">
        {/* Welcome message and date */}
        <div className="flex flex-col">
          <div className="flex items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
              Welcome back, {user?.name || "Admin"}
            </h1>
            <div className="ml-2 flex items-center">
              <Badge
                variant="outline"
                className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-2 py-1"
              >
                {user?.role || "Admin"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center mt-2">
            <FaCalendarAlt className="h-4 w-4 text-gray-400 mr-2" />
            <p className="text-gray-300 text-sm">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <p className="mt-2 text-gray-200 text-base md:text-lg">
            Here's your system overview for this {selectedPeriod}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col space-y-3 md:flex-row md:space-y-0 md:space-x-3 md:items-center">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search dashboard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-48 lg:w-64 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
          </div>

          {/* Time period selector */}
          <div className="inline-flex p-1 bg-gray-700/80 rounded-lg shadow-md">
            {["day", "week", "month"].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  selectedPeriod === period
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md"
                    : "text-gray-200 hover:bg-gray-600/50 hover:text-white"
                )}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {/* Date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-gray-700/50 border-gray-600/50 text-gray-200 hover:bg-gray-600/50 hover:text-white"
              >
                <FaCalendarAlt className="h-4 w-4 mr-2" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-gray-800 border border-gray-700">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                className="bg-gray-800 text-white"
              />
            </PopoverContent>
          </Popover>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-gray-700/50 border-gray-600/50 text-gray-200 hover:bg-gray-600/50 hover:text-white relative"
              >
                <FaBell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-gray-800 border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">
                  Notifications
                </h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 border-b border-gray-700 hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
                            notification.type === "critical"
                              ? "bg-red-500/20 text-red-500"
                              : notification.type === "warning"
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-blue-500/20 text-blue-500"
                          }`}
                        >
                          <FaBell className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white">
                            {notification.title}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-400">
                    No notifications
                  </div>
                )}
              </div>
              <div className="p-2 border-t border-gray-700 flex justify-center">
                <Button
                  variant="ghost"
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-sm w-full"
                >
                  View all notifications
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Settings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="bg-gray-700/50 border-gray-600/50 text-gray-200 hover:bg-gray-600/50 hover:text-white"
              >
                <FaCog className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border border-gray-700 text-white">
              <DropdownMenuLabel>Dashboard Settings</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                <FaFilter className="h-4 w-4 mr-2" />
                <span>Filter View</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                <FaDownload className="h-4 w-4 mr-2" />
                <span>Export Data</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer"
                onClick={onRefresh}
              >
                <FaSync className="h-4 w-4 mr-2" />
                <span>Refresh Data</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
};

export default EnhancedDashboardHeader;
