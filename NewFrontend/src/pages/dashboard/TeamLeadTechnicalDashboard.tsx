import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FaTicketAlt, FaUserClock, FaChartLine, FaUsers, FaExclamationTriangle, 
  FaUsersCog, FaServer, FaClipboardCheck, FaRegClock, FaExchangeAlt,
  FaCalendarAlt, FaClipboardList, FaHeadset, FaBell, FaUserShield,
  FaChartPie, FaUserCheck, FaAward, FaComments, FaTools, FaFileAlt,
  FaSync, FaCode, FaDatabase, FaNetworkWired, FaLaptopCode
} from 'react-icons/fa';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useRoleBasedFilter } from '../../hooks/useRoleBasedFilter';
import TopNavbar from '@/components/dashboard/TopNavbar';
import Sidebar from '@/components/dashboard/Sidebar';
import Footer from '@/components/dashboard/Footer';
import { useGetTicketsQuery } from '@/features/tickets/api/ticketApi';

const TeamLeadTechnicalDashboard: React.FC = () => {
  const { user } = useAuth();
  const { filterByRole } = useRoleBasedFilter();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Fetch tickets data
  const { data: ticketsData, refetch: refetchTickets } = useGetTicketsQuery({
    filters: { status: 'open' },
    page: 1,
    limit: 5
  });
  
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
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };
  
  // Stats data
  const stats = [
    { 
      title: 'Team Tickets', 
      value: ticketsData?.pagination?.total || '0', 
      change: '+8 this week', 
      icon: FaTicketAlt,
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      title: 'System Health', 
      value: '98%', 
      change: '+2% from last week', 
      icon: FaServer,
      color: 'bg-green-500',
      gradient: 'from-green-500 to-green-600'
    },
    { 
      title: 'Avg. Resolution Time', 
      value: '3.2h', 
      change: '-0.5h from last week', 
      icon: FaUserClock,
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-purple-600'
    },
    { 
      title: 'Team Members', 
      value: '6', 
      change: 'Active today', 
      icon: FaUsers,
      color: 'bg-orange-500',
      gradient: 'from-orange-500 to-orange-600'
    }
  ];

  // Add technical performance metrics
  const technicalMetrics = [
    { name: 'Code Quality', target: '90%', actual: '92%', efficiency: '102%' },
    { name: 'Deployment Success', target: '95%', actual: '98%', efficiency: '103%' },
    { name: 'Bug Resolution', target: '85%', actual: '88%', efficiency: '104%' },
    { name: 'System Uptime', target: '99.5%', actual: '99.8%', efficiency: '100%' }
  ];
  
  // Add team performance metrics
  const teamPerformance = [
    { name: 'Technical Team', ticketsResolved: 36, avgResolutionTime: '3.2h', codeQuality: '92%', deploymentSuccess: '98%' }
  ];
  
  // Add team members data
  const teamMembers = [
    { name: 'Alex Johnson', ticketsResolved: 14, avgResolutionTime: '2.8h', codeQuality: '94%', deploymentSuccess: '99%' },
    { name: 'Sarah Williams', ticketsResolved: 12, avgResolutionTime: '3.1h', codeQuality: '93%', deploymentSuccess: '97%' },
    { name: 'David Chen', ticketsResolved: 10, avgResolutionTime: '3.5h', codeQuality: '91%', deploymentSuccess: '98%' }
  ];
  
  // System components data
  const systemComponents = [
    { name: 'Database Server', status: 'Healthy', uptime: '99.9%', lastIssue: '15 days ago' },
    { name: 'API Gateway', status: 'Healthy', uptime: '99.8%', lastIssue: '7 days ago' },
    { name: 'Authentication Service', status: 'Healthy', uptime: '99.9%', lastIssue: '21 days ago' },
    { name: 'File Storage', status: 'Warning', uptime: '99.5%', lastIssue: '2 days ago' }
  ];
  
  // Recent tickets data
  const recentTickets = ticketsData?.data?.slice(0, 5) || [];

  // Handle refresh
  const handleRefresh = () => {
    refetchTickets();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Technical Team Lead Dashboard</h1>
                <p className="mt-1 text-gray-400">Manage your technical team, system health, and tickets</p>
              </div>
              
              <div className="mt-4 md:mt-0 flex items-center space-x-3">
                <button 
                  onClick={handleRefresh}
                  className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FaSync className="mr-2" /> Refresh
                </button>
                
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="day">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
            
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 gap-6"
            >
              {/* Stats Cards */}
              <motion.div 
                variants={itemVariants}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {stats.map((stat, index) => (
                  <motion.div 
                    key={index}
                    className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                    whileHover={{ y: -5, scale: 1.02, transition: { duration: 0.2 } }}
                  >
                    <div className={`px-6 py-4 border-b border-gray-700/70 flex items-center`}>
                      <div className={`p-2 rounded-lg ${stat.color}/20`}>
                        <stat.icon className={`h-5 w-5 text-${stat.color.replace('bg-', '')}`} />
                      </div>
                      <h3 className="ml-3 font-medium text-white">{stat.title}</h3>
                    </div>
                    <div className="px-6 py-4">
                      <div className="flex items-end">
                        <span className="text-3xl font-bold text-white">{stat.value}</span>
                        <span className="ml-2 text-xs text-gray-400">{stat.change}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Main content area - 2 columns on larger screens */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Team Performance - Enhanced with technical metrics */}
                <motion.div 
                  className="lg:col-span-2 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                  variants={itemVariants}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaUsersCog className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Technical Team Performance</h3>
                    </div>
                    <select
                      className="bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-white px-3 py-1"
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                    >
                      <option value="day">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                    </select>
                  </div>
                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700/50">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Team</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tickets Resolved</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Avg. Resolution</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Code Quality</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Deployment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {teamPerformance.map((team, index) => (
                            <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-white">{team.name}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{team.ticketsResolved}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{team.avgResolutionTime}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className={`text-sm ${
                                  parseInt(team.codeQuality) > 95 ? 'text-green-400' : 
                                  parseInt(team.codeQuality) > 90 ? 'text-blue-400' : 
                                  parseInt(team.codeQuality) > 85 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{team.codeQuality}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className={`text-sm ${
                                  parseInt(team.deploymentSuccess) > 95 ? 'text-green-400' : 
                                  parseInt(team.deploymentSuccess) > 90 ? 'text-blue-400' : 
                                  parseInt(team.deploymentSuccess) > 85 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{team.deploymentSuccess}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Team Members Performance</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700/50">
                          <thead>
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Member</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tickets</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Resolution</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Code Quality</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Deployment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/50">
                            {teamMembers.map((member, index) => (
                              <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-white">{member.name}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-300">{member.ticketsResolved}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-300">{member.avgResolutionTime}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className={`text-sm ${
                                    parseInt(member.codeQuality) > 95 ? 'text-green-400' : 
                                    parseInt(member.codeQuality) > 90 ? 'text-blue-400' : 
                                    parseInt(member.codeQuality) > 85 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>{member.codeQuality}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className={`text-sm ${
                                    parseInt(member.deploymentSuccess) > 95 ? 'text-green-400' : 
                                    parseInt(member.deploymentSuccess) > 90 ? 'text-blue-400' : 
                                    parseInt(member.deploymentSuccess) > 85 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>{member.deploymentSuccess}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Technical Metrics */}
                <motion.div
                  variants={itemVariants}
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaChartLine className="h-5 w-5 text-green-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Technical Metrics</h3>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      {technicalMetrics.map((metric, index) => (
                        <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-300">{metric.name}</span>
                            <span className={`text-sm font-medium ${
                              parseFloat(metric.efficiency) > 110 ? 'text-green-400' : 
                              parseFloat(metric.efficiency) > 100 ? 'text-blue-400' : 
                              parseFloat(metric.efficiency) > 90 ? 'text-yellow-400' : 'text-red-400'
                            }`}>{metric.efficiency}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>Target: {metric.target}</span>
                            <span>Actual: {metric.actual}</span>
                          </div>
                          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                parseFloat(metric.efficiency) > 110 ? 'bg-green-500' : 
                                parseFloat(metric.efficiency) > 100 ? 'bg-blue-500' : 
                                parseFloat(metric.efficiency) > 90 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(parseFloat(metric.efficiency), 150)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
              
              {/* System Components and Recent Tickets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Components */}
                <motion.div
                  variants={itemVariants}
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaServer className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">System Components</h3>
                    </div>
                    <a href="/system-status" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      View All
                    </a>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      {systemComponents.map((component, index) => (
                        <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-200">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center">
                              {component.status === 'Healthy' ? (
                                <FaCheckCircle className="h-4 w-4 text-green-400 mr-2" />
                              ) : component.status === 'Warning' ? (
                                <FaExclamationTriangle className="h-4 w-4 text-yellow-400 mr-2" />
                              ) : (
                                <FaTimesCircle className="h-4 w-4 text-red-400 mr-2" />
                              )}
                              <h4 className="text-white font-medium">{component.name}</h4>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                              component.status === 'Healthy' ? 'bg-green-500/20 text-green-400' :
                              component.status === 'Warning' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {component.status}
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                            <span>Uptime: {component.uptime}</span>
                            <span>Last issue: {component.lastIssue}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
                
                {/* Recent Tickets */}
                <motion.div
                  variants={itemVariants}
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaTicketAlt className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Recent Tickets</h3>
                    </div>
                    <a href="/tickets" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      View All
                    </a>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      {recentTickets.length > 0 ? (
                        recentTickets.map((ticket, index) => (
                          <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-white font-medium">{ticket.title}</h4>
                                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{ticket.description}</p>
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                ticket.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                ticket.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {ticket.priority}
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                              <span>Team: {ticket.assignedTeam?.name || 'Unassigned'}</span>
                              <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <FaTicketAlt className="mx-auto h-8 w-8 mb-2 opacity-50" />
                          <p>No recent tickets found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
              
              {/* System Alerts */}
              <motion.div
                variants={itemVariants}
                className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-md rounded-xl shadow-xl border border-blue-500/30 p-4 hover:border-blue-400/50 transition-all duration-300 hover:shadow-blue-500/10 hover:shadow-2xl"
              >
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-blue-500/20 mr-4">
                    <FaBell className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">System Alerts</h3>
                    <p className="text-blue-200/70 text-sm mt-1">3 new notifications</p>
                  </div>
                </div>
                <button className="w-full mt-4 py-2 bg-blue-500/30 hover:bg-blue-500/40 text-blue-100 rounded-lg transition-colors duration-200">
                  View Alerts
                </button>
              </motion.div>
            </motion.div>
          </div>
        </main>
      </div>
      
      {/* Add Footer component */}
      <Footer />
    </div>
  );
};

export default TeamLeadTechnicalDashboard;
