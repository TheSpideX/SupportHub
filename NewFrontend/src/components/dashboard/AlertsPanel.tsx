import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FaExclamationTriangle,
  FaExclamationCircle,
  FaInfoCircle,
  FaCheckCircle,
  FaBell,
  FaEllipsisH,
  FaFilter,
  FaEye,
  FaEyeSlash,
  FaTrash,
  FaSort,
} from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/buttons/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  title: string;
  message: string;
  type: "critical" | "warning" | "info" | "success";
  timestamp: Date | string;
  source?: string;
  isRead?: boolean;
  actionRequired?: boolean;
  actionLink?: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  title?: string;
  className?: string;
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onViewAll?: () => void;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  title = "System Alerts",
  className = "",
  onMarkAsRead,
  onDismiss,
  onViewAll,
}) => {
  const [filter, setFilter] = useState<string | null>(null);
  const [showRead, setShowRead] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "priority">("newest");

  // Filter and sort alerts
  const filteredAlerts = alerts
    .filter((alert) => {
      if (!showRead && alert.isRead) return false;
      if (filter && alert.type !== filter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
        return priorityOrder[a.type] - priorityOrder[b.type];
      } else {
        const timestampA = new Date(a.timestamp).getTime();
        const timestampB = new Date(b.timestamp).getTime();
        return timestampB - timestampA; // newest first
      }
    });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <FaExclamationCircle className="h-5 w-5" />;
      case "warning":
        return <FaExclamationTriangle className="h-5 w-5" />;
      case "info":
        return <FaInfoCircle className="h-5 w-5" />;
      case "success":
        return <FaCheckCircle className="h-5 w-5" />;
      default:
        return <FaBell className="h-5 w-5" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-500/20 text-red-500 border-red-500/30";
      case "warning":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "info":
        return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      case "success":
        return "bg-green-500/20 text-green-500 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/30";
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
          <FaBell className="h-5 w-5 text-blue-400 mr-2" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {filteredAlerts.length > 0 && (
            <Badge className="ml-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
              {filteredAlerts.length}
            </Badge>
          )}
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
                  filter === null ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => setFilter(null)}
              >
                All Alerts
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  filter === "critical" ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => setFilter("critical")}
              >
                <div className="h-3 w-3 rounded-full bg-red-500 mr-2" />
                Critical
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  filter === "warning" ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => setFilter("warning")}
              >
                <div className="h-3 w-3 rounded-full bg-yellow-500 mr-2" />
                Warning
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  filter === "info" ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => setFilter("info")}
              >
                <div className="h-3 w-3 rounded-full bg-blue-500 mr-2" />
                Info
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  filter === "success" ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => setFilter("success")}
              >
                <div className="h-3 w-3 rounded-full bg-green-500 mr-2" />
                Success
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer"
                onClick={() => setShowRead(!showRead)}
              >
                {showRead ? (
                  <>
                    <FaEyeSlash className="h-4 w-4 mr-2" /> Hide Read
                  </>
                ) : (
                  <>
                    <FaEye className="h-4 w-4 mr-2" /> Show Read
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
              >
                <FaSort className="h-3.5 w-3.5 mr-2" />
                <span className="hidden sm:inline">Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border border-gray-700 text-white">
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  sortBy === "newest" ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => setSortBy("newest")}
              >
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`hover:bg-gray-700 focus:bg-gray-700 cursor-pointer ${
                  sortBy === "priority" ? "bg-blue-600/20 text-blue-400" : ""
                }`}
                onClick={() => setSortBy("priority")}
              >
                By Priority
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
        {filteredAlerts.length > 0 ? (
          <motion.div
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredAlerts.map((alert) => {
              const timestamp =
                typeof alert.timestamp === "string"
                  ? new Date(alert.timestamp)
                  : alert.timestamp;

              return (
                <motion.div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${getAlertColor(
                    alert.type
                  )} ${alert.isRead ? "opacity-70" : ""}`}
                  variants={itemVariants}
                >
                  <div className="flex items-start">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${getAlertColor(
                        alert.type
                      )}`}
                    >
                      {getAlertIcon(alert.type)}
                    </div>

                    <div className="ml-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-white flex items-center">
                            {alert.title}
                            {alert.actionRequired && (
                              <Badge className="ml-2 bg-purple-500/20 text-purple-400 border-purple-500/30">
                                Action Required
                              </Badge>
                            )}
                            {alert.isRead && (
                              <Badge className="ml-2 bg-gray-500/20 text-gray-400 border-gray-500/30">
                                Read
                              </Badge>
                            )}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">
                            {alert.message}
                          </p>
                          {alert.source && (
                            <p className="text-xs text-gray-500 mt-1">
                              Source: {alert.source}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end ml-2">
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(timestamp, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3">
                        {alert.actionLink ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
                            onClick={() =>
                              window.open(alert.actionLink, "_blank")
                            }
                          >
                            View Details
                          </Button>
                        ) : (
                          <div></div>
                        )}

                        <div className="flex space-x-2">
                          {!alert.isRead && onMarkAsRead && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
                              onClick={() => onMarkAsRead(alert.id)}
                            >
                              <FaEye className="h-3.5 w-3.5 mr-1" />
                              <span className="text-xs">Mark as Read</span>
                            </Button>
                          )}

                          {onDismiss && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
                              onClick={() => onDismiss(alert.id)}
                            >
                              <FaTrash className="h-3.5 w-3.5 mr-1" />
                              <span className="text-xs">Dismiss</span>
                            </Button>
                          )}
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
              <FaBell className="h-6 w-6 text-gray-500" />
            </div>
            <p className="text-gray-400">No alerts found</p>
            {filter && (
              <Button
                variant="link"
                className="text-blue-400 hover:text-blue-300 mt-2"
                onClick={() => setFilter(null)}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}

        {onViewAll && alerts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700/50 text-center">
            <Button
              variant="link"
              className="text-blue-400 hover:text-blue-300"
              onClick={onViewAll}
            >
              View All Alerts
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AlertsPanel;
