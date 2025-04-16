import React, { useState, useEffect, useRef, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  FaTimes,
  FaTicketAlt,
  FaHome,
  FaUser,
  FaBook,
  FaChartBar,
  FaUsers,
  FaCog,
  FaServer,
  FaShieldAlt,
  FaClipboardList,
  FaUsersCog,
  FaTools,
  FaFileAlt,
  FaChevronDown,
  FaSignOutAlt,
  FaBell,
  FaMoon,
  FaSun,
  FaStar,
  FaSearch,
  FaHistory,
  FaFilter,
  FaEllipsisH,
  FaQuestion,
  FaPlus,
  FaList,
} from "react-icons/fa";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
// Fix the imports by using the correct paths
import { Badge } from "../ui/badge";
import { Tooltip } from "../ui/tooltip";
import { useTheme } from "@/hooks/useTheme";

interface SidebarProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  userRole?: string; // Add this property to fix the TypeScript error
}

interface NavItemProps {
  name: string;
  icon: React.ElementType;
  href: string;
  badge?: string | number;
  children?: NavItemType[];
}

type NavItemType = NavItemProps;

const Sidebar: React.FC<SidebarProps> = ({ open, setOpen }) => {
  const { user } = useAuth();
  const userRole = user?.role || "customer";
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  // Add a new state for active filter
  const [activeFilter, setActiveFilter] = useState<
    "all" | "favorites" | "recent"
  >("all");
  const { theme, setTheme } = useTheme();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Define getNavItems function as a memoized value to prevent recreating on each render
  const navItems = useMemo(() => {
    // Common items for all users
    const commonItems: NavItemType[] = [
      { name: "Dashboard", icon: FaHome, href: "/dashboard" },
      // Only show Enhanced Dashboard for support role
      ...(userRole === "support"
        ? [
            {
              name: "Enhanced Dashboard",
              icon: FaChartBar,
              href: "/support-dashboard",
              badge: "NEW",
            },
          ]
        : []),
      // Only show Tickets for non-customer roles
      ...(userRole !== "customer"
        ? [
            {
              name: "Tickets",
              icon: FaTicketAlt,
              href: "/tickets",
              badge: "12",
              children: [
                {
                  name: "All Tickets",
                  icon: FaTicketAlt,
                  href: "/tickets/all",
                },
                {
                  name: "My Tickets",
                  icon: FaTicketAlt,
                  href: "/tickets/my-tickets",
                },
                {
                  name: "Create Ticket",
                  icon: FaTicketAlt,
                  href: "/tickets/create",
                },
              ],
            },
          ]
        : []),
      {
        name: "Profile",
        icon: FaUser,
        href: "/profile", // Ensure this points to a dedicated profile page route
      },
      {
        name: "Knowledge Base",
        icon: FaBook,
        href: "/knowledge-base",
        children: [
          { name: "Articles", icon: FaBook, href: "/knowledge-base/articles" },
          { name: "FAQs", icon: FaBook, href: "/knowledge-base/faqs" },
        ],
      },
    ];

    // Role-specific items
    const roleItems: Record<string, NavItemType[]> = {
      customer: [
        {
          name: "Queries",
          icon: FaQuestion,
          href: "/queries",
          children: [
            { name: "My Queries", icon: FaQuestion, href: "/queries" },
            { name: "Create Query", icon: FaPlus, href: "/queries/create" },
          ],
        },
      ],
      support: [
        {
          name: "My Assigned Queries",
          icon: FaQuestion,
          href: "/queries",
          badge: "5",
        },
        {
          name: "My Created Tickets",
          icon: FaTicketAlt,
          href: "/tickets/my-tickets",
        },
      ],
      technical: [
        { name: "Reports", icon: FaChartBar, href: "/reports" },
        { name: "Customers", icon: FaUsers, href: "/customers" },
        { name: "System Status", icon: FaServer, href: "/system-status" },
        { name: "Diagnostics", icon: FaTools, href: "/diagnostics" },
      ],
      team_lead: [
        { name: "Reports", icon: FaChartBar, href: "/reports" },
        { name: "Customers", icon: FaUsers, href: "/customers" },
        { name: "System Status", icon: FaServer, href: "/system-status" },
        { name: "Diagnostics", icon: FaTools, href: "/diagnostics" },
        { name: "Team", icon: FaUsersCog, href: "/team" },
        {
          name: "Approvals",
          icon: FaClipboardList,
          href: "/approvals",
          badge: "3",
        },
        // Support team lead specific items
        ...(user?.teamType === "support"
          ? [
              {
                name: "Queries",
                icon: FaQuestion,
                href: "/queries",
                children: [
                  { name: "All Queries", icon: FaQuestion, href: "/queries" },
                  {
                    name: "Team Queries",
                    icon: FaUsers,
                    href: "/queries/team",
                  },
                  {
                    name: "Create Query",
                    icon: FaPlus,
                    href: "/queries/create",
                  },
                ],
                badge: "5",
              },
            ]
          : []),
        // Technical team lead specific items
        ...(user?.teamType === "technical"
          ? [
              {
                name: "Technical Tools",
                icon: FaTools,
                href: "/technical-tools",
              },
              {
                name: "System Diagnostics",
                icon: FaServer,
                href: "/system-diagnostics",
              },
            ]
          : []),
      ],
      admin: [
        {
          name: "Analytics",
          icon: FaChartBar,
          href: "/admin/analytics",
          children: [
            {
              name: "Dashboard",
              icon: FaChartBar,
              href: "/admin/analytics/dashboard",
            },
            {
              name: "Reports",
              icon: FaChartBar,
              href: "/admin/analytics/reports",
            },
            {
              name: "Metrics",
              icon: FaChartBar,
              href: "/admin/analytics/metrics",
            },
          ],
        },
        {
          name: "Customer Management",
          icon: FaUsers,
          href: "/admin/customer-management",
        },
        { name: "System Status", icon: FaServer, href: "/admin/system-status" },
        { name: "Diagnostics", icon: FaTools, href: "/admin/diagnostics" },
        {
          name: "Team Management",
          icon: FaUsersCog,
          href: "/admin/team-management",
        },
        {
          name: "Approvals",
          icon: FaClipboardList,
          href: "/admin/approvals",
          badge: "3",
        },
        {
          name: "User Management",
          icon: FaUsers,
          href: "/admin/user-management",
        },
        { name: "Security", icon: FaShieldAlt, href: "/admin/security" },
        { name: "Settings", icon: FaCog, href: "/admin/settings" },
        { name: "Audit Logs", icon: FaHistory, href: "/admin/audit-logs" },
      ],
    };

    // Return combined items based on role
    return [...commonItems, ...(roleItems[userRole] || [])].map((item) => {
      // Special case for profile to prevent it from being highlighted incorrectly
      if (item.name === "Profile") {
        return {
          ...item,
          // Add a special flag or modify how its active state is determined
          isProfileItem: true,
        };
      }
      return item;
    });
  }, [userRole]); // Only recalculate when userRole changes

  // Memoize filtered nav items to prevent unnecessary recalculations
  const filteredNavItems = useMemo(() => {
    // First apply search filter
    let filtered = navItems;
    if (searchTerm.trim()) {
      const searchTermLower = searchTerm.toLowerCase();
      filtered = navItems.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTermLower) ||
          item.children?.some((child) =>
            child.name.toLowerCase().includes(searchTermLower)
          )
      );
    }

    // Then apply category filter
    if (activeFilter === "favorites") {
      filtered = filtered.filter((item) => favorites.includes(item.name));
    } else if (activeFilter === "recent") {
      filtered = filtered.filter((item) => recentItems.includes(item.href));
    }

    return filtered;
  }, [searchTerm, navItems, activeFilter, favorites, recentItems]);

  // Close sidebar when clicking outside on mobile and desktop
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [setOpen, open]);

  // Track recently visited pages
  useEffect(() => {
    const path = location.pathname;
    setRecentItems((prev) => {
      const filtered = prev.filter((item) => item !== path);
      return [path, ...filtered].slice(0, 5);
    });
  }, [location.pathname]);

  // First, ensure favorites are persisted in localStorage
  useEffect(() => {
    // Load favorites from localStorage on component mount
    const savedFavorites = localStorage.getItem("sidebarFavorites");
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("sidebarFavorites", JSON.stringify(favorites));
  }, [favorites]);

  // Toggle favorite status for a navigation item
  const toggleFavorite = (name: string, e?: React.MouseEvent) => {
    // If event is provided, prevent it from bubbling up
    if (e) {
      e.stopPropagation();
    }

    setFavorites((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  const toggleExpand = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  // Animation variants
  const sidebarVariants = {
    open: {
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    closed: {
      x: "-100%",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
  };

  const childVariants = {
    open: {
      height: "auto",
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: [0.04, 0.62, 0.23, 0.98],
      },
    },
    closed: {
      height: 0,
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: [0.04, 0.62, 0.23, 0.98],
      },
    },
  };

  const renderNavItem = (item: NavItemType) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.name);
    const isFavorite = favorites.includes(item.name);
    const isRecent = recentItems.includes(item.href);

    // Simplified active state check - we'll handle exceptions in the className
    const isActive =
      location.pathname === item.href ||
      (hasChildren &&
        item.children?.some(
          (child) =>
            location.pathname === child.href ||
            location.pathname.startsWith(child.href + "/")
        ));

    // Common active class for consistent styling across all items
    const activeClass =
      "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-100 shadow-sm";
    const inactiveClass =
      "text-gray-700 hover:bg-gray-100/70 dark:text-gray-300 dark:hover:bg-gray-700/50";

    // Only apply active styling if not Dashboard or Profile
    const getActiveClass = (active: boolean) => {
      if (item.name === "Dashboard" || item.name === "Profile") {
        return inactiveClass;
      }
      return active ? activeClass : inactiveClass;
    };

    return (
      <div key={item.name} className="mb-1.5 group">
        {hasChildren ? (
          <>
            <button
              onClick={() => toggleExpand(item.name)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${
                  isActive || isExpanded
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-100 shadow-sm"
                    : "text-gray-700 hover:bg-gray-100/70 dark:text-gray-300 dark:hover:bg-gray-700/50"
                }`}
            >
              <div className="flex items-center">
                <item.icon className="mr-3 h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                <span>{item.name}</span>
                {isRecent && (
                  <Badge
                    variant="outline"
                    className="ml-2 px-1 py-0 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                  >
                    Recent
                  </Badge>
                )}
                {item.badge && (
                  <Badge className="ml-2 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-100">
                    {item.badge}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-1.5">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(item.name, e);
                  }}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isFavorite
                      ? "text-amber-500 hover:text-amber-600 hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
                      : "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <FaStar className="h-3.5 w-3.5" />
                </span>
                <FaChevronDown
                  className={`h-3 w-3 transition-transform duration-200 text-gray-500 dark:text-gray-400 ${
                    isExpanded ? "transform rotate-180" : ""
                  }`}
                />
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={childVariants}
                  className="overflow-hidden pl-4"
                >
                  <div className="pt-1 pl-4 border-l border-gray-200 dark:border-gray-700">
                    {item.children?.map((child) => (
                      <NavLink
                        key={child.name}
                        to={child.href}
                        className={({ isActive }) =>
                          `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                            isActive
                              ? "bg-primary-50 text-primary-900 dark:bg-primary-900/20 dark:text-primary-100"
                              : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50"
                          }`
                        }
                      >
                        <child.icon className="mr-3 h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span>{child.name}</span>
                      </NavLink>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="relative group">
            <NavLink
              to={item.href}
              end={item.href === "/profile"} // Add 'end' prop for exact matching
              className={({ isActive: routerIsActive }) =>
                `flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  routerIsActive &&
                  item.name !== "Dashboard" &&
                  item.name !== "Profile"
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-100 shadow-sm"
                    : "text-gray-700 hover:bg-gray-100/70 dark:text-gray-300 dark:hover:bg-gray-700/50"
                }`
              }
            >
              <div className="flex items-center">
                <item.icon className="mr-3 h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                <span>{item.name}</span>
                {isRecent && (
                  <Badge
                    variant="outline"
                    className="ml-2 px-1 py-0 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                  >
                    Recent
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-1.5">
                {item.badge && (
                  <Badge className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-100">
                    {item.badge}
                  </Badge>
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(item.name, e);
                  }}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isFavorite
                      ? "text-amber-500 hover:text-amber-600 hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
                      : "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <FaStar className="h-3.5 w-3.5" />
                </span>
              </div>
            </NavLink>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.div
        ref={sidebarRef}
        className="fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-gray-800/95 backdrop-blur-sm shadow-xl overflow-hidden border-r border-gray-200/70 dark:border-gray-700/50"
        variants={sidebarVariants}
        initial={open ? "open" : "closed"}
        animate={open ? "open" : "closed"}
      >
        <div className="h-full flex flex-col">
          {/* Header with logo and close button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200/80 dark:border-gray-700/80">
            <div className="flex items-center">
              <div className="h-9 w-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">SH</span>
              </div>
              <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
                Support Hub
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/70 transition-all duration-200"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <FaSun className="h-4 w-4" />
                ) : (
                  <FaMoon className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/70 transition-all duration-200"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search navigation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <FaTimes className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
                </button>
              )}
            </div>
          </div>

          {/* Quick filters */}
          <div className="px-4 pt-2 pb-2 flex space-x-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-full flex items-center space-x-1.5 transition-all duration-200 ${
                activeFilter === "all"
                  ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-100 shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700/70 dark:text-gray-300 dark:hover:bg-gray-600/70"
              }`}
            >
              <FaList className="h-3 w-3" />
              <span>All</span>
            </button>
            <button
              onClick={() => setActiveFilter("favorites")}
              className={`px-3 py-1.5 text-xs font-medium rounded-full flex items-center space-x-1.5 transition-all duration-200 ${
                activeFilter === "favorites"
                  ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-100 shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700/70 dark:text-gray-300 dark:hover:bg-gray-600/70"
              }`}
            >
              <FaStar className="h-3 w-3" />
              <span>Favorites</span>
            </button>
            <button
              onClick={() => setActiveFilter("recent")}
              className={`px-3 py-1.5 text-xs font-medium rounded-full flex items-center space-x-1.5 transition-all duration-200 ${
                activeFilter === "recent"
                  ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-100 shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700/70 dark:text-gray-300 dark:hover:bg-gray-600/70"
              }`}
            >
              <FaHistory className="h-3 w-3" />
              <span>Recent</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            {filteredNavItems.length > 0 ? (
              filteredNavItems.map(renderNavItem)
            ) : (
              <div className="text-center py-8 px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700/70 mb-4">
                  <FaSearch className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No navigation items found matching "{searchTerm}"
                </p>
                <button
                  onClick={() => setSearchTerm("")}
                  className="mt-2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}
          </nav>

          {/* User profile card with logout */}
          <div className="mt-auto p-4 border-t border-gray-200/80 dark:border-gray-700/80">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-sm border border-gray-200/80 dark:border-gray-600/50 p-3 transition-all duration-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-medium shadow-sm">
                    {user?.name?.charAt(0) || "U"}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user?.name || "User"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                      {userRole.replace("_", " ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      const { authService } = getAuthServices();
                      authService.logout();
                    }}
                    className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    aria-label="Logout"
                  >
                    <FaSignOutAlt className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Version info */}
          <div className="p-3 border-t border-gray-200/80 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-800/80">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Support Hub v1.0.0
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default Sidebar;
