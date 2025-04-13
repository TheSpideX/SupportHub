import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTachometerAlt,
  FaUsers,
  FaTicketAlt,
  FaChartBar,
  FaFileAlt,
  FaServer,
  FaTools,
  FaUsersCog,
  FaCheckSquare,
  FaShieldAlt,
  FaCog,
  FaHistory,
  FaChevronDown,
  FaChevronRight,
  FaBars,
  FaTimes,
  FaSignOutAlt,
  FaUserCircle,
} from "react-icons/fa";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/buttons/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarItem {
  title: string;
  path: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeColor?: string;
  children?: SidebarItem[];
}

interface AdminSidebarProps {
  className?: string;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ className = "" }) => {
  const location = useLocation();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Get user from Redux store
  const user = useSelector((state: RootState) => state.auth.user);

  // Define sidebar navigation items
  const sidebarItems: SidebarItem[] = [
    {
      title: "Dashboard",
      path: "/admin-dashboard",
      icon: FaTachometerAlt,
    },
    {
      title: "Analytics",
      path: "/analytics",
      icon: FaChartBar,
      children: [
        {
          title: "Dashboard",
          path: "/analytics/dashboard",
          icon: FaTachometerAlt,
        },
        {
          title: "Reports",
          path: "/analytics/reports",
          icon: FaFileAlt,
        },
      ],
    },
    {
      title: "Tickets",
      path: "/tickets",
      icon: FaTicketAlt,
      badge: 12,
      badgeColor: "bg-blue-500",
      children: [
        {
          title: "All Tickets",
          path: "/tickets/all",
          icon: FaTicketAlt,
        },
        {
          title: "My Tickets",
          path: "/tickets/my-tickets",
          icon: FaTicketAlt,
        },
        {
          title: "Create Ticket",
          path: "/tickets/create",
          icon: FaTicketAlt,
        },
      ],
    },
    {
      title: "User Management",
      path: "/admin/users",
      icon: FaUsers,
      badge: 3,
      badgeColor: "bg-green-500",
    },
    {
      title: "System",
      path: "/admin/system",
      icon: FaServer,
      children: [
        {
          title: "Status",
          path: "/admin/system-status",
          icon: FaServer,
          badge: "!",
          badgeColor: "bg-red-500",
        },
        {
          title: "Diagnostics",
          path: "/admin/diagnostics",
          icon: FaTools,
        },
      ],
    },
    {
      title: "Team Management",
      path: "/admin/teams",
      icon: FaUsersCog,
    },
    {
      title: "Approvals",
      path: "/admin/approvals",
      icon: FaCheckSquare,
      badge: 5,
      badgeColor: "bg-yellow-500",
    },
    {
      title: "Security",
      path: "/admin/security",
      icon: FaShieldAlt,
    },
    {
      title: "Settings",
      path: "/admin/settings",
      icon: FaCog,
    },
    {
      title: "Audit Logs",
      path: "/admin/audit-logs",
      icon: FaHistory,
    },
  ];

  // Toggle sidebar collapse
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Toggle mobile sidebar
  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  // Toggle submenu expansion
  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  // Check if a path is active
  const isActive = (path: string) => {
    if (
      path === "/admin-dashboard" &&
      location.pathname === "/admin-dashboard"
    ) {
      return true;
    }

    if (path !== "/admin-dashboard" && location.pathname.startsWith(path)) {
      return true;
    }

    return false;
  };

  // Handle logout
  const handleLogout = () => {
    logout();
  };

  // Sidebar item variants for animation
  const itemVariants = {
    open: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    },
    closed: {
      opacity: 0,
      y: 20,
      transition: {
        duration: 0.2,
      },
    },
  };

  // Render sidebar item
  const renderSidebarItem = (item: SidebarItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isItemActive = isActive(item.path);
    const isExpanded = expandedItems.includes(item.title);

    // Determine if any child is active
    const isChildActive =
      hasChildren && item.children?.some((child) => isActive(child.path));

    // Expand parent if child is active
    React.useEffect(() => {
      if (isChildActive && !isExpanded) {
        setExpandedItems((prev) => [...prev, item.title]);
      }
    }, [isChildActive, isExpanded, item.title]);

    return (
      <div key={item.path} className={`${depth > 0 ? "ml-4" : ""}`}>
        <div
          className={`flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer transition-colors ${
            isItemActive || isChildActive
              ? "bg-primary-900/20 text-primary-500"
              : "hover:bg-gray-100 dark:hover:bg-gray-800/50"
          }`}
          onClick={() => (hasChildren ? toggleExpand(item.title) : null)}
        >
          <Link
            to={hasChildren ? "#" : item.path}
            className="flex items-center flex-1"
            onClick={(e) => {
              if (hasChildren) {
                e.preventDefault();
              }
            }}
          >
            <item.icon
              className={`h-5 w-5 ${isCollapsed ? "mx-auto" : "mr-3"}`}
            />
            {!isCollapsed && (
              <span className="text-sm font-medium">{item.title}</span>
            )}
          </Link>

          {!isCollapsed && (
            <>
              {item.badge && (
                <Badge
                  className={`${
                    item.badgeColor || "bg-gray-500"
                  } text-white ml-2`}
                >
                  {item.badge}
                </Badge>
              )}

              {hasChildren && (
                <div className="ml-2">
                  {isExpanded ? (
                    <FaChevronDown className="h-3 w-3" />
                  ) : (
                    <FaChevronRight className="h-3 w-3" />
                  )}
                </div>
              )}
            </>
          )}

          {isCollapsed && item.badge && (
            <Badge
              className={`${
                item.badgeColor || "bg-gray-500"
              } text-white absolute top-0 right-0 -mt-1 -mr-1 h-4 w-4 flex items-center justify-center p-0 text-xs`}
            >
              {item.badge}
            </Badge>
          )}
        </div>

        {/* Submenu */}
        {hasChildren && (
          <AnimatePresence>
            {isExpanded && !isCollapsed && (
              <motion.div
                initial="closed"
                animate="open"
                exit="closed"
                variants={{
                  open: {
                    opacity: 1,
                    height: "auto",
                    transition: {
                      staggerChildren: 0.05,
                      duration: 0.2,
                    },
                  },
                  closed: {
                    opacity: 0,
                    height: 0,
                    transition: {
                      duration: 0.2,
                    },
                  },
                }}
                className="overflow-hidden"
              >
                <div className="pt-2 pb-1">
                  {item.children?.map((child) => (
                    <motion.div key={child.path} variants={itemVariants}>
                      {renderSidebarItem(child, depth + 1)}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  // Collapsed sidebar with tooltips
  const renderCollapsedItem = (item: SidebarItem) => {
    const isItemActive = isActive(item.path);
    const hasChildren = item.children && item.children.length > 0;

    // If item has children, check if any child is active
    const isChildActive =
      hasChildren && item.children?.some((child) => isActive(child.path));

    return (
      <TooltipProvider key={item.path}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <Link
                to={hasChildren ? item.children?.[0].path || "#" : item.path}
                className={`flex items-center justify-center p-2 rounded-lg my-2 cursor-pointer transition-colors ${
                  isItemActive || isChildActive
                    ? "bg-primary-900/20 text-primary-500"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800/50"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.badge && (
                  <Badge
                    className={`${
                      item.badgeColor || "bg-gray-500"
                    } text-white absolute top-0 right-0 -mt-1 -mr-1 h-4 w-4 flex items-center justify-center p-0 text-xs`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{item.title}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      {/* Mobile sidebar toggle */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Button
          variant="outline"
          size="sm"
          className="bg-white dark:bg-gray-800 shadow-md"
          onClick={toggleMobileSidebar}
        >
          <FaBars className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-50 ${
          isCollapsed ? "w-16" : "w-64"
        } ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${className}`}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
          {!isCollapsed && (
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-md bg-primary-500 flex items-center justify-center text-white font-bold mr-2">
                SH
              </div>
              <h2 className="text-lg font-bold">Support Hub</h2>
            </div>
          )}

          {isCollapsed && (
            <div className="h-8 w-8 rounded-md bg-primary-500 flex items-center justify-center text-white font-bold mx-auto">
              SH
            </div>
          )}

          <div className="md:block hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="h-8 w-8 p-0"
            >
              {isCollapsed ? (
                <FaChevronRight className="h-4 w-4" />
              ) : (
                <FaChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileSidebar}
              className="h-8 w-8 p-0"
            >
              <FaTimes className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* User profile */}
        <div
          className={`px-4 py-4 border-b border-gray-200 dark:border-gray-800 ${
            isCollapsed ? "text-center" : ""
          }`}
        >
          <div
            className={`flex ${
              isCollapsed ? "flex-col items-center" : "items-center"
            }`}
          >
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300">
              <FaUserCircle className="h-8 w-8" />
            </div>
            {!isCollapsed && (
              <div className="ml-3">
                <p className="text-sm font-medium">
                  {user?.name || "Admin User"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.email || "admin@example.com"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="py-4 overflow-y-auto h-[calc(100vh-160px)]">
          <nav className="space-y-1 px-2">
            {isCollapsed
              ? sidebarItems.map((item) => renderCollapsedItem(item))
              : sidebarItems.map((item) => renderSidebarItem(item))}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 p-4">
          <Button
            variant="ghost"
            className={`w-full justify-${
              isCollapsed ? "center" : "start"
            } text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20`}
            onClick={handleLogout}
          >
            <FaSignOutAlt className={`h-5 w-5 ${isCollapsed ? "" : "mr-2"}`} />
            {!isCollapsed && <span>Logout</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
