import { useState, useEffect, useRef } from "react";
import {
  FaSearch,
  FaBell,
  FaBars,
  FaMoon,
  FaSun,
  FaQuestion,
  FaCog,
  FaUserCircle,
  FaSignOutAlt,
  FaHistory,
} from "react-icons/fa";
import AppPrimusStatus from "@/components/ui/AppPrimusStatus";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TopNavbarProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopNavbar: React.FC<TopNavbarProps> = ({
  onMenuClick,
  sidebarOpen,
  setSidebarOpen,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "New ticket assigned", time: "2 min ago", read: false },
    {
      id: 2,
      title: "System maintenance scheduled",
      time: "1 hour ago",
      read: false,
    },
    { id: 3, title: "Your report is ready", time: "5 hours ago", read: true },
  ]);

  const userInitial = user?.name ? user.name.substring(0, 1) : "U";
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        !(e.target as Element).closest(".user-menu-container") &&
        !(e.target as Element).closest(".notifications-container")
      ) {
        setShowUserMenu(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + B for sidebar toggle
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      // Escape to close menus
      if (e.key === "Escape") {
        setShowUserMenu(false);
        setShowNotifications(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Tooltip
              content={
                sidebarOpen ? "Close sidebar (Ctrl+B)" : "Open sidebar (Ctrl+B)"
              }
            >
              <button
                className="p-2 rounded-md text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <FaBars className="h-5 w-5" />
              </button>
            </Tooltip>
            <div className="flex-shrink-0 ml-2">
              <div className="h-10 w-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-all cursor-pointer">
                <span className="text-xl font-bold text-white">SH</span>
              </div>
            </div>
            <div className="hidden md:block ml-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Support Hub
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="hidden md:block">
              <AppPrimusStatus showLabel={false} />
            </div>
            <div
              className={cn(
                "relative transition-all duration-200",
                searchFocused ? "w-64 md:w-80" : "w-40 md:w-48"
              )}
            >
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-4 w-4 text-gray-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                className="h-9 pl-10 pr-4 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 block w-full text-sm transition-all"
                placeholder={searchFocused ? "Search..." : "Search (Ctrl+K)"}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchFocused && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                  ESC
                </div>
              )}
            </div>

            <Tooltip content="Help & Resources">
              <button className="p-2 text-gray-500 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
                <FaQuestion className="h-5 w-5" />
              </button>
            </Tooltip>

            <Tooltip content={theme === "dark" ? "Light Mode" : "Dark Mode"}>
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-500 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                aria-label={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
              >
                {theme === "dark" ? (
                  <FaSun className="h-5 w-5" />
                ) : (
                  <FaMoon className="h-5 w-5" />
                )}
              </button>
            </Tooltip>

            <div className="relative notifications-container">
              <Tooltip content="Notifications">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowUserMenu(false);
                  }}
                  className="p-2 text-gray-500 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  aria-label="Notifications"
                >
                  <FaBell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center text-[10px] text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </Tooltip>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Notifications
                      </p>
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                              !notification.read
                                ? "bg-blue-50 dark:bg-blue-900/10"
                                : ""
                            }`}
                          >
                            <div className="flex justify-between">
                              <p
                                className={`text-sm ${
                                  !notification.read
                                    ? "font-medium text-gray-900 dark:text-white"
                                    : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <span className="h-2 w-2 bg-primary-500 rounded-full"></span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {notification.time}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No notifications
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-center">
                      <a
                        href="/notifications"
                        className="text-xs text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                      >
                        View all notifications
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative user-menu-container">
              <div
                className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-medium text-sm cursor-pointer shadow-sm hover:shadow-md transition-all ring-2 ring-transparent hover:ring-primary-300 dark:hover:ring-primary-700"
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifications(false);
                }}
                aria-label="User menu"
              >
                {userInitial}
              </div>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user?.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {user?.email}
                      </p>
                      <Badge className="mt-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                        {user?.role?.replace("_", " ") || "User"}
                      </Badge>
                    </div>
                    <div className="py-1">
                      <a
                        href="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FaUserCircle className="mr-2 h-4 w-4 text-gray-500" />
                        Your Profile
                      </a>
                      <a
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FaCog className="mr-2 h-4 w-4 text-gray-500" />
                        Settings
                      </a>
                      <a
                        href="/activity"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FaHistory className="mr-2 h-4 w-4 text-gray-500" />
                        Activity Log
                      </a>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                      <button
                        onClick={logout}
                        className="flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <FaSignOutAlt className="mr-2 h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNavbar;
