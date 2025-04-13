import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaSearch, 
  FaBell, 
  FaUserCircle, 
  FaCog, 
  FaChartLine, 
  FaCalendarAlt,
  FaFilter,
  FaEllipsisH,
  FaRegSun,
  FaRegMoon
} from 'react-icons/fa';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ModernDashboardHeaderProps {
  user: any;
  notifications: any[];
  onSearch?: (query: string) => void;
  onThemeToggle?: () => void;
  isDarkMode?: boolean;
  className?: string;
}

const ModernDashboardHeader: React.FC<ModernDashboardHeaderProps> = ({
  user,
  notifications = [],
  onSearch,
  onThemeToggle,
  isDarkMode = true,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };
  
  // Format date
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(currentTime);
  
  // Format time
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(currentTime);
  
  return (
    <motion.div 
      className={`bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-4 md:p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 ${className}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:justify-between md:items-center">
        {/* Left side - Welcome and date */}
        <div className="flex flex-col">
          <div className="flex items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
              Welcome back, {user?.name || 'Admin'}
            </h1>
            <div className="ml-2 flex items-center">
              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-2 py-1">
                {user?.role || 'Admin'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center mt-2">
            <FaCalendarAlt className="h-4 w-4 text-gray-400 mr-2" />
            <p className="text-gray-300 text-sm">
              {formattedDate} <span className="text-blue-400 ml-2">{formattedTime}</span>
            </p>
          </div>
        </div>
        
        {/* Right side - Search and actions */}
        <div className="flex flex-col space-y-3 md:flex-row md:space-y-0 md:space-x-3 md:items-center">
          {/* Search */}
          <div className="relative">
            <form onSubmit={handleSearch}>
              <div className={`relative transition-all duration-300 ${
                isSearchFocused ? 'w-full md:w-72' : 'w-full md:w-64'
              }`}>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaSearch className={`h-4 w-4 ${
                    isSearchFocused ? 'text-blue-400' : 'text-gray-400'
                  }`} />
                </div>
                <input
                  type="text"
                  placeholder="Search dashboard..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className={`pl-10 pr-4 py-2 w-full bg-gray-700/50 border rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 transition-all duration-300 ${
                    isSearchFocused 
                      ? 'border-blue-500/50 focus:ring-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                      : 'border-gray-600/50 focus:ring-gray-500/50'
                  }`}
                />
              </div>
            </form>
          </div>
          
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white relative">
                <FaBell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-0 bg-gray-800 border border-gray-700 text-white">
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Notifications</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div key={notification.id} className="p-4 border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
                          notification.type === 'critical' ? 'bg-red-500/20 text-red-500' :
                          notification.type === 'warning' ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-blue-500/20 text-blue-500'
                        }`}>
                          <FaBell className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white">{notification.title}</h4>
                          <p className="text-xs text-gray-400 mt-1">{notification.message}</p>
                          <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
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
                <Button variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-sm w-full">
                  View all notifications
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Theme toggle */}
          <Button 
            variant="outline" 
            className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
            onClick={onThemeToggle}
          >
            {isDarkMode ? (
              <FaRegSun className="h-4 w-4" />
            ) : (
              <FaRegMoon className="h-4 w-4" />
            )}
          </Button>
          
          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white">
                <FaUserCircle className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">{user?.name || 'Admin'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border border-gray-700 text-white">
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Quick stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/10 rounded-lg p-3 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Active Users</p>
              <p className="text-xl font-semibold text-white">1,254</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <FaUserCircle className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <div className="mt-2 text-xs text-blue-300">
            <span className="text-green-400">↑ 12%</span> from last week
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/10 rounded-lg p-3 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Open Tickets</p>
              <p className="text-xl font-semibold text-white">64</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <FaChartLine className="h-5 w-5 text-purple-400" />
            </div>
          </div>
          <div className="mt-2 text-xs text-purple-300">
            <span className="text-red-400">↑ 8%</span> from yesterday
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-500/20 to-green-600/10 rounded-lg p-3 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Resolution Rate</p>
              <p className="text-xl font-semibold text-white">94%</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <FaCog className="h-5 w-5 text-green-400" />
            </div>
          </div>
          <div className="mt-2 text-xs text-green-300">
            <span className="text-green-400">↑ 3%</span> from last week
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 rounded-lg p-3 border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Avg. Response</p>
              <p className="text-xl font-semibold text-white">42m</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <FaFilter className="h-5 w-5 text-yellow-400" />
            </div>
          </div>
          <div className="mt-2 text-xs text-yellow-300">
            <span className="text-red-400">↑ 5%</span> from last week
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ModernDashboardHeader;
