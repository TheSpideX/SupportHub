import React, { useState } from 'react';
import { FaTicketAlt, FaUserClock, FaChartLine, FaUsers, FaExclamationTriangle, 
  FaServer, FaUsersCog, FaCalendarAlt, FaFilter, FaArrowRight, FaShieldAlt,
  FaBell, FaClipboardCheck, FaClipboardList, FaClock , FaExclamationCircle} from 'react-icons/fa';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import StatCard from '@/components/shared/StatCard';
import TopNavbar from '@/components/dashboard/TopNavbar';
import Footer from '@/components/dashboard/Footer';
import Sidebar from '@/components/dashboard/Sidebar';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Enhanced stats with more relevant metrics
  const stats = [
    { 
      title: 'Total Tickets', 
      value: '243', 
      change: '+18 this week', 
      icon: FaTicketAlt,
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      title: 'SLA Compliance', 
      value: '94%', 
      change: '+2% from last week', 
      icon: FaClock,
      color: 'bg-green-500',
      gradient: 'from-green-500 to-green-600'
    },
    { 
      title: 'System Uptime', 
      value: '99.9%', 
      change: 'Last 30 days', 
      icon: FaServer,
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-purple-600'
    },
    { 
      title: 'Active Users', 
      value: '1,256', 
      change: '+85 from last month', 
      icon: FaUsers,
      color: 'bg-orange-500',
      gradient: 'from-orange-500 to-orange-600'
    },
    { 
      title: 'Avg Resolution Time', 
      value: '4.2h', 
      change: '-0.5h from last week', 
      icon: FaUserClock,
      color: 'bg-teal-500',
      gradient: 'from-teal-500 to-teal-600'
    },
    { 
      title: 'SLA Breaches', 
      value: '12', 
      change: '-3 from last week', 
      icon: FaExclamationTriangle,
      color: 'bg-red-500',
      gradient: 'from-red-500 to-red-600'
    }
  ];
  
  // Enhanced team performance with SLA metrics
  const teamPerformance = [
    { name: 'Support Team', ticketsResolved: 87, avgResponseTime: '1.4h', satisfaction: '92%', slaCompliance: '96%' },
    { name: 'Technical Team', ticketsResolved: 64, avgResponseTime: '2.1h', satisfaction: '89%', slaCompliance: '91%' },
    { name: 'Billing Team', ticketsResolved: 42, avgResponseTime: '0.8h', satisfaction: '95%', slaCompliance: '98%' }
  ];
  
  // SLA breach alerts
  const slaAlerts = [
    { id: 'SLA-105', ticket: 'TKT-2389', team: 'Technical', timeRemaining: '-2h', priority: 'high' },
    { id: 'SLA-104', ticket: 'TKT-2376', team: 'Support', timeRemaining: '1h', priority: 'medium' },
    { id: 'SLA-103', ticket: 'TKT-2350', team: 'Technical', timeRemaining: '30m', priority: 'critical' }
  ];
  
  // Ticket status distribution
  const ticketStatus = [
    { status: 'Open', count: 42, color: 'bg-blue-500' },
    { status: 'In Progress', count: 78, color: 'bg-yellow-500' },
    { status: 'Resolved', count: 124, color: 'bg-green-500' },
    { status: 'Closed', count: 256, color: 'bg-gray-500' }
  ];

  const pendingApprovals = [
    { id: 'A-105', type: 'Access Request', requester: 'John Smith', department: 'Technical', requested: '1 day ago' },
    { id: 'A-104', type: 'Software Purchase', requester: 'Jane Doe', department: 'Support', requested: '2 days ago' },
    { id: 'A-103', type: 'System Change', requester: 'Mike Johnson', department: 'Development', requested: '3 days ago' }
  ];

  const recentIncidents = [
    { id: 'INC-2023', title: 'API Gateway Latency', status: 'resolved', severity: 'medium', duration: '45 minutes', date: '2 days ago' },
    { id: 'INC-2022', title: 'Database Connection Issues', status: 'resolved', severity: 'critical', duration: '2 hours', date: '5 days ago' },
    { id: 'INC-2021', title: 'Authentication Service Outage', status: 'resolved', severity: 'high', duration: '30 minutes', date: '1 week ago' },
  ];

  const securityAlerts = [
    { id: 'SEC-506', type: 'Unusual Login Activity', source: 'Auth Service', level: 'medium', timestamp: '3 hours ago' },
    { id: 'SEC-505', type: 'Failed Login Attempts', source: 'Admin Portal', level: 'high', timestamp: '1 day ago' },
    { id: 'SEC-504', type: 'New Admin User Created', source: 'User Management', level: 'info', timestamp: '2 days ago' },
  ];

  const resourceUtilization = [
    { resource: 'CPU', current: 42, max: 100, unit: '%' },
    { resource: 'Memory', current: 6.8, max: 16, unit: 'GB' },
    { resource: 'Storage', current: 1.2, max: 2, unit: 'TB' },
    { resource: 'Bandwidth', current: 800, max: 1000, unit: 'Mbps' },
  ];

  // Add new section for SLA performance by priority
  const slaPriorityPerformance = [
    { priority: 'Critical', target: '1h', current: '0.8h', compliance: '96%', color: 'bg-red-500' },
    { priority: 'High', target: '4h', current: '3.5h', compliance: '94%', color: 'bg-orange-500' },
    { priority: 'Medium', target: '8h', current: '6.2h', compliance: '98%', color: 'bg-yellow-500' },
    { priority: 'Low', target: '24h', current: '18.5h', compliance: '99%', color: 'bg-green-500' }
  ];

  // Add new section for workflow efficiency
  const workflowMetrics = [
    { name: 'First Response', target: '15m', actual: '12m', efficiency: '120%' },
    { name: 'Triage Time', target: '30m', actual: '28m', efficiency: '107%' },
    { name: 'Reassignment Rate', target: '<10%', actual: '8.5%', efficiency: '115%' },
    { name: 'Resolution Rate', target: '85%', actual: '87%', efficiency: '102%' }
  ];

  // Add team workload data
  const teamWorkload = [
    { team: 'Support', assigned: 42, inProgress: 28, backlog: 14, capacity: 50 },
    { team: 'Technical', assigned: 36, inProgress: 22, backlog: 14, capacity: 40 },
    { team: 'Billing', assigned: 18, inProgress: 12, backlog: 6, capacity: 25 },
    { team: 'Product', assigned: 24, inProgress: 18, backlog: 6, capacity: 30 }
  ];

  // Add ticket backlog analysis
  const backlogAnalysis = {
    totalBacklog: 40,
    criticalCount: 5,
    highCount: 12,
    mediumCount: 18,
    lowCount: 5,
    oldestTicket: '8d 4h',
    avgAge: '3d 6h'
  };

  // Add system health monitoring data
  const systemHealth = {
    apiResponseTime: '42ms',
    databaseLatency: '18ms',
    errorRate: '0.03%',
    memoryUsage: '68%',
    cpuUsage: '42%',
    lastDeployment: '2d 4h ago',
    activeConnections: 128
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} userRole={user?.role} />
        
        <main className="flex-1 overflow-y-auto relative z-10">
          <motion.div 
            className="p-4 md:p-8 space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Welcome section */}
            <motion.div 
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                    Welcome back, {user?.name || 'Admin'}
                  </h1>
                  <p className="mt-2 text-gray-200 text-base md:text-lg">
                    Here's your system overview for this {selectedPeriod}
                  </p>
                </div>
                <div className="inline-flex p-1 bg-gray-700/80 rounded-lg self-start shadow-md">
                  {['day', 'week', 'month'].map((period) => (
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
              </div>
            </motion.div>
            
            {/* Stats - Updated to show 6 cards in a 3x2 grid on larger screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {stats.map((stat, index) => (
                <motion.div 
                  key={index} 
                  variants={itemVariants}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                  <StatCard 
                    title={stat.title}
                    value={stat.value}
                    change={stat.change}
                    icon={stat.icon}
                    color={stat.color}
                    gradient={stat.gradient}
                    variant="gradient"
                    className="shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-700/50 hover:border-blue-500/30"
                  />
                </motion.div>
              ))}
            </div>
            
            {/* Main content area - 2 columns on larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Team Performance - Enhanced with SLA metrics */}
              <motion.div 
                className="lg:col-span-2 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaUsersCog className="h-5 w-5 text-blue-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">Team Performance</h3>
                  </div>
                  <div className="flex items-center">
                    <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tickets Resolved</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Avg Response</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">SLA Compliance</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Satisfaction</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {teamPerformance.map((team, index) => (
                          <tr key={index} className="hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-white">{team.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-300">{team.ticketsResolved}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-300">{team.avgResponseTime}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className={`text-sm ${
                                parseInt(team.slaCompliance) > 95 ? 'text-green-400' : 
                                parseInt(team.slaCompliance) > 90 ? 'text-yellow-400' : 'text-red-400'
                              }`}>{team.slaCompliance}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-300">{team.satisfaction}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>

              {/* SLA Alerts - New section */}
              <motion.div 
                className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-amber-500/30 transition-all duration-300"
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaBell className="h-5 w-5 text-amber-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">SLA Alerts</h3>
                  </div>
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    View All
                  </button>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {slaAlerts.map((alert) => (
                      <div key={alert.id} className="p-3 bg-gradient-to-r from-gray-700/50 to-gray-700/30 rounded-lg border border-gray-600/50 hover:border-amber-500/50 transition-all duration-200 cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center">
                              <span className="text-xs font-medium text-gray-400">#{alert.ticket}</span>
                              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                alert.priority === 'critical' ? 'bg-red-500/20 text-red-400' : 
                                alert.priority === 'high' ? 'bg-amber-500/20 text-amber-400' : 
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {alert.priority.charAt(0).toUpperCase() + alert.priority.slice(1)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-white">{alert.team} Team</p>
                            <p className="text-xs text-gray-400">SLA ID: {alert.id}</p>
                          </div>
                          <div className={`px-2 py-1 text-xs rounded-md ${
                            alert.timeRemaining.startsWith('-') ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                            parseInt(alert.timeRemaining) <= 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {alert.timeRemaining.startsWith('-') ? 'Breached' : 'Due in'} {alert.timeRemaining.replace('-', '')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Ticket Status Distribution - New section */}
              <motion.div 
                className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaClipboardList className="h-5 w-5 text-blue-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">Ticket Status</h3>
                  </div>
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    View All Tickets
                  </button>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    {ticketStatus.map((status) => (
                      <div key={status.status} className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-white">{status.status}</h4>
                          <span className={`h-3 w-3 rounded-full ${status.color}`}></span>
                        </div>
                        <div className="text-2xl font-bold text-white">{status.count}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                    <h4 className="font-medium text-white mb-2">Ticket Distribution</h4>
                    <div className="flex h-4 rounded-full overflow-hidden">
                      {ticketStatus.map((status) => (
                        <div 
                          key={status.status} 
                          className={`${status.color}`} 
                          style={{ width: `${(status.count / ticketStatus.reduce((acc, curr) => acc + curr.count, 0)) * 100}%` }}
                        ></div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                      <span>Total: {ticketStatus.reduce((acc, curr) => acc + curr.count, 0)} tickets</span>
                      <span>Updated 5 min ago</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Security Alerts - Keep existing section */}
              <motion.div 
                className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-red-500/30 transition-all duration-300"
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaShieldAlt className="h-5 w-5 text-red-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">Security Alerts</h3>
                  </div>
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    View All
                  </button>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {securityAlerts.map((alert) => (
                      <div key={alert.id} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50 hover:border-gray-500/70 transition-all duration-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center">
                              <span className={`h-2.5 w-2.5 rounded-full mr-2 ${
                                alert.level === 'high' ? 'bg-red-500' : 
                                alert.level === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
                              }`}></span>
                              <h4 className="font-medium text-white">{alert.type}</h4>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">Source: {alert.source}</p>
                          </div>
                          <span className={`px-2.5 py-1 text-xs rounded-full ${
                            alert.level === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                            alert.level === 'medium' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 
                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {alert.level}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                          <span>{alert.timestamp}</span>
                          <button className="text-blue-400 hover:text-blue-300 transition-colors">Investigate</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Resource Utilization - Keep existing section */}
            <motion.div 
              className="mt-6 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaServer className="h-5 w-5 text-blue-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Resource Utilization</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md transition-colors">
                    Refresh
                  </button>
                  <select className="text-sm bg-gray-700 border border-gray-600 rounded-lg py-1 px-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200">
                    <option>All Servers</option>
                    <option>Production</option>
                    <option>Staging</option>
                  </select>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {resourceUtilization.map((resource) => {
                  const percentage = (resource.current / resource.max) * 100;
                  const getColor = () => {
                    if (percentage > 80) return 'from-red-500 to-red-600';
                    if (percentage > 60) return 'from-orange-500 to-orange-600';
                    return 'from-green-500 to-green-600';
                  };
                  
                  return (
                    <div key={resource.resource} className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-white">{resource.resource}</h4>
                        <span className="text-sm text-gray-300">
                          {resource.current} / {resource.max} {resource.unit}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2.5 mb-1">
                        <div 
                          className={`h-2.5 rounded-full bg-gradient-to-r ${getColor()}`} 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-right text-xs text-gray-400">
                        {percentage.toFixed(0)}% utilized
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Quick Actions - New section */}
            <motion.div 
              className="mt-6 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-green-500/30 transition-all duration-300"
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="px-6 py-4 border-b border-gray-700/70">
                <div className="flex items-center">
                  <FaClipboardCheck className="h-5 w-5 text-green-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Admin Quick Actions</h3>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-blue-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaUsersCog className="mr-2 text-blue-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">Manage Teams</span>
                </button>
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-green-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaServer className="mr-2 text-green-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">System Status</span>
                </button>
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaChartLine className="mr-2 text-purple-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">View Reports</span>
                </button>
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-green-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaShieldAlt className="mr-2 text-green-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">System Settings</span>
                </button>
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-amber-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaUserClock className="mr-2 text-amber-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">SLA Configuration</span>
                </button>
              </div>
            </motion.div>

            {/* Active Users */}
            <motion.div 
              className="mt-6 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300"
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaUsers className="h-5 w-5 text-purple-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Active Users</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-green-400 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/30">
                    <span className="inline-block h-2 w-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                    256 online now
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-center p-4">
                  <div className="w-full max-w-md">
                    <div className="relative pt-5">
                      <div className="flex justify-between mb-2">
                        <div className="text-xs text-gray-400">Last 24 hours</div>
                        <div className="text-xs text-gray-400">1,256 total users</div>
                      </div>
                      <div className="h-16 bg-gray-700/30 rounded-lg overflow-hidden">
                        {/* This would be a real chart in production */}
                        <div className="h-full w-full bg-gradient-to-r from-purple-900/20 to-purple-600/20 relative">
                          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <path 
                              d="M0,50 Q10,30 20,45 T40,35 T60,40 T80,15 T100,30" 
                              fill="none" 
                              stroke="rgba(168, 85, 247, 0.8)" 
                              strokeWidth="2"
                            />
                            <path 
                              d="M0,50 Q10,30 20,45 T40,35 T60,40 T80,15 T100,30" 
                              fill="none" 
                              stroke="rgba(168, 85, 247, 0.4)" 
                              strokeWidth="6"
                              strokeLinecap="round"
                              strokeDasharray="0.5 2"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="flex justify-between mt-2">
                        <div className="text-xs text-gray-400">00:00</div>
                        <div className="text-xs text-gray-400">06:00</div>
                        <div className="text-xs text-gray-400">12:00</div>
                        <div className="text-xs text-gray-400">18:00</div>
                        <div className="text-xs text-gray-400">24:00</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="bg-gray-700/30 rounded-lg p-2 text-center">
                        <div className="text-sm text-gray-300">Support</div>
                        <div className="text-lg font-semibold text-white">42</div>
                      </div>
                      <div className="bg-gray-700/30 rounded-lg p-2 text-center">
                        <div className="text-sm text-gray-300">Technical</div>
                        <div className="text-lg font-semibold text-white">28</div>
                      </div>
                      <div className="bg-gray-700/30 rounded-lg p-2 text-center">
                        <div className="text-sm text-gray-300">Customers</div>
                        <div className="text-lg font-semibold text-white">186</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Add SLA Performance by Priority section */}
            <motion.div 
              className="mt-6 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaClock className="h-5 w-5 text-blue-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">SLA Performance by Priority</h3>
                </div>
                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  View Details
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                {slaPriorityPerformance.map((item) => (
                  <div key={item.priority} className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className={`h-3 w-3 rounded-full ${item.color} mr-2`}></span>
                        <h4 className="font-medium text-white">{item.priority}</h4>
                      </div>
                      <span className={`text-sm ${
                        parseFloat(item.compliance) >= 95 ? 'text-green-400' : 
                        parseFloat(item.compliance) >= 90 ? 'text-yellow-400' : 'text-red-400'
                      }`}>{item.compliance}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-300 mt-2">
                      <span>Target: {item.target}</span>
                      <span>Current: {item.current}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full ${item.color}`} 
                        style={{ width: `${parseFloat(item.compliance)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Add Workflow Efficiency Metrics */}
            <motion.div 
              className="mt-6 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-green-500/30 transition-all duration-300"
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaChartLine className="h-5 w-5 text-green-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Workflow Efficiency</h3>
                </div>
                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  Configure Workflows
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                {workflowMetrics.map((metric) => {
                  const efficiencyValue = parseFloat(metric.efficiency);
                  const getColor = () => {
                    if (efficiencyValue >= 110) return 'text-green-400';
                    if (efficiencyValue >= 100) return 'text-blue-400';
                    if (efficiencyValue >= 90) return 'text-yellow-400';
                    return 'text-red-400';
                  };
                  
                  return (
                    <div key={metric.name} className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                      <h4 className="font-medium text-white mb-2">{metric.name}</h4>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-300">
                          <div>Target: {metric.target}</div>
                          <div>Actual: {metric.actual}</div>
                        </div>
                        <div className={`text-xl font-bold ${getColor()}`}>
                          {metric.efficiency}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Add Team Workload Distribution */}
            <motion.div 
              className="mt-6 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300"
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaUsersCog className="h-5 w-5 text-purple-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Team Workload Distribution</h3>
                </div>
                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  Manage Teams
                </button>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Assigned</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">In Progress</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Backlog</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Capacity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Utilization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {teamWorkload.map((team) => {
                        const utilization = (team.assigned / team.capacity) * 100;
                        const utilizationColor = 
                          utilization > 90 ? 'text-red-400' :
                          utilization > 75 ? 'text-yellow-400' :
                          'text-green-400';
                        
                        return (
                          <tr key={team.team} className="hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-white">{team.team}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-300">{team.assigned}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-300">{team.inProgress}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-300">{team.backlog}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-300">{team.capacity}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className={`text-sm font-medium ${utilizationColor}`}>{utilization.toFixed(0)}%</div>
                              <div className="w-24 bg-gray-700 rounded-full h-1.5 mt-1">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    utilization > 90 ? 'bg-red-500' :
                                    utilization > 75 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`} 
                                  style={{ width: `${utilization}%` }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Add Ticket Backlog Analysis */}
            <motion.div 
              className="mt-6 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-amber-500/30 transition-all duration-300"
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaExclamationTriangle className="h-5 w-5 text-amber-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Ticket Backlog Analysis</h3>
                </div>
                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  View All Tickets
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50 col-span-1">
                  <h4 className="font-medium text-white mb-3">Backlog by Priority</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="h-3 w-3 rounded-full bg-red-500 mr-2"></span>
                          <span className="text-sm text-gray-300">Critical</span>
                        </div>
                        <span className="text-sm text-white">{backlogAnalysis.criticalCount}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-red-500" 
                          style={{ width: `${(backlogAnalysis.criticalCount / backlogAnalysis.totalBacklog) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="h-3 w-3 rounded-full bg-orange-500 mr-2"></span>
                          <span className="text-sm text-gray-300">High</span>
                        </div>
                        <span className="text-sm text-white">{backlogAnalysis.highCount}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-orange-500" 
                          style={{ width: `${(backlogAnalysis.highCount / backlogAnalysis.totalBacklog) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="h-3 w-3 rounded-full bg-yellow-500 mr-2"></span>
                          <span className="text-sm text-gray-300">Medium</span>
                        </div>
                        <span className="text-sm text-white">{backlogAnalysis.mediumCount}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-yellow-500" 
                          style={{ width: `${(backlogAnalysis.mediumCount / backlogAnalysis.totalBacklog) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="h-3 w-3 rounded-full bg-green-500 mr-2"></span>
                          <span className="text-sm text-gray-300">Low</span>
                        </div>
                        <span className="text-sm text-white">{backlogAnalysis.lowCount}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-green-500" 
                          style={{ width: `${(backlogAnalysis.lowCount / backlogAnalysis.totalBacklog) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50 col-span-1">
                  <h4 className="font-medium text-white mb-3">Backlog Age</h4>
                  <div className="flex flex-col h-full justify-center items-center">
                    <div className="text-4xl font-bold text-amber-400 mb-2">{backlogAnalysis.totalBacklog}</div>
                    <div className="text-sm text-gray-300 mb-4">Total Backlog Tickets</div>
                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div className="bg-gray-800/50 rounded p-3 text-center">
                        <div className="text-sm text-gray-400">Oldest Ticket</div>
                        <div className="text-xl font-semibold text-red-400">{backlogAnalysis.oldestTicket}</div>
                      </div>
                      <div className="bg-gray-800/50 rounded p-3 text-center">
                        <div className="text-sm text-gray-400">Avg Age</div>
                        <div className="text-xl font-semibold text-yellow-400">{backlogAnalysis.avgAge}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50 col-span-1">
                  <h4 className="font-medium text-white mb-3">SLA Risk Analysis</h4>
                  <div className="space-y-4">
                    <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                      <div className="flex items-center">
                        <FaExclamationCircle className="text-red-400 mr-2" />
                        <span className="text-sm font-medium text-white">At Risk (Next 4h)</span>
                      </div>
                      <div className="text-2xl font-bold text-red-400 mt-1">7 Tickets</div>
                    </div>
                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
                      <div className="flex items-center">
                        <FaExclamationTriangle className="text-yellow-400 mr-2" />
                        <span className="text-sm font-medium text-white">Warning (Next 24h)</span>
                      </div>
                      <div className="text-2xl font-bold text-yellow-400 mt-1">12 Tickets</div>
                    </div>
                    <div className="mt-3 text-center">
                      <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors">
                        View SLA Dashboard
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Add System Health Monitoring */}
            <motion.div 
              className="mt-6 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaServer className="h-5 w-5 text-blue-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">System Health</h3>
                </div>
                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  View Logs
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <h4 className="text-sm text-gray-400 mb-1">API Response Time</h4>
                  <div className="flex items-end">
                    <div className="text-2xl font-bold text-white">{systemHealth.apiResponseTime}</div>
                    <div className="text-xs text-green-400 ml-2 mb-1">Good</div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                    <div className="h-1.5 rounded-full bg-green-500" style={{ width: '30%' }}></div>
                  </div>
                </div>
                
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <h4 className="text-sm text-gray-400 mb-1">Database Latency</h4>
                  <div className="flex items-end">
                    <div className="text-2xl font-bold text-white">{systemHealth.databaseLatency}</div>
                    <div className="text-xs text-green-400 ml-2 mb-1">Good</div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                    <div className="h-1.5 rounded-full bg-green-500" style={{ width: '25%' }}></div>
                  </div>
                </div>
                
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <h4 className="text-sm text-gray-400 mb-1">Error Rate</h4>
                  <div className="flex items-end">
                    <div className="text-2xl font-bold text-white">{systemHealth.errorRate}</div>
                    <div className="text-xs text-green-400 ml-2 mb-1">Low</div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                    <div className="h-1.5 rounded-full bg-green-500" style={{ width: '3%' }}></div>
                  </div>
                </div>
                
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <h4 className="text-sm text-gray-400 mb-1">Active Connections</h4>
                  <div className="flex items-end">
                    <div className="text-2xl font-bold text-white">{systemHealth.activeConnections}</div>
                    <div className="text-xs text-blue-400 ml-2 mb-1">Normal</div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: '45%' }}></div>
                  </div>
                </div>
                
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <h4 className="text-sm text-gray-400 mb-1">Memory Usage</h4>
                  <div className="flex items-end">
                    <div className="text-2xl font-bold text-white">{systemHealth.memoryUsage}</div>
                    <div className="text-xs text-yellow-400 ml-2 mb-1">Moderate</div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                    <div className="h-1.5 rounded-full bg-yellow-500" style={{ width: '68%' }}></div>
                  </div>
                </div>
                
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <h4 className="text-sm text-gray-400 mb-1">CPU Usage</h4>
                  <div className="flex items-end">
                    <div className="text-2xl font-bold text-white">{systemHealth.cpuUsage}</div>
                    <div className="text-xs text-blue-400 ml-2 mb-1">Normal</div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: '42%' }}></div>
                  </div>
                </div>
                
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <h4 className="text-sm text-gray-400 mb-1">Last Deployment</h4>
                  <div className="flex items-end">
                    <div className="text-2xl font-bold text-white">{systemHealth.lastDeployment}</div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">Version: v1.4.2</div>
                </div>
                
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                  <h4 className="text-sm text-gray-400 mb-1">System Status</h4>
                  <div className="flex items-center mt-2">
                    <div className="h-3 w-3 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                    <div className="text-sm font-medium text-white">All Systems Operational</div>
                  </div>
                  <button className="mt-3 w-full px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-xs font-medium transition-colors">
                    View System Status Page
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default AdminDashboard;
