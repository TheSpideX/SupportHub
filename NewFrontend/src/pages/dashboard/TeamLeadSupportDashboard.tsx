import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FaTicketAlt, FaUserClock, FaChartLine, FaUsers, FaExclamationTriangle, 
  FaUsersCog, FaServer, FaClipboardCheck, FaRegClock, FaExchangeAlt,
  FaCalendarAlt, FaClipboardList, FaHeadset, FaBell, FaUserShield,
  FaChartPie, FaUserCheck, FaAward, FaComments, FaTools, FaFileAlt,
  FaQuestion, FaSync
} from 'react-icons/fa';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useRoleBasedFilter } from '../../hooks/useRoleBasedFilter';
import TopNavbar from '@/components/dashboard/TopNavbar';
import Sidebar from '@/components/dashboard/Sidebar';
import Footer from '@/components/dashboard/Footer';
import { useGetQueriesQuery } from '@/features/tickets/api/queryApi';
import { useGetTicketsQuery } from '@/features/tickets/api/ticketApi';

const TeamLeadSupportDashboard: React.FC = () => {
  const { user } = useAuth();
  const { filterByRole } = useRoleBasedFilter();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Fetch queries and tickets data
  const { data: queriesData, refetch: refetchQueries } = useGetQueriesQuery({
    filters: { status: 'open' },
    page: 1,
    limit: 5
  });
  
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
      title: 'Team Queries', 
      value: queriesData?.pagination?.total || '0', 
      change: '+5 today', 
      icon: FaQuestion,
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-purple-600'
    },
    { 
      title: 'Avg. Response Time', 
      value: '1.4h', 
      change: '-0.2h from last week', 
      icon: FaUserClock,
      color: 'bg-green-500',
      gradient: 'from-green-500 to-green-600'
    },
    { 
      title: 'Team Members', 
      value: '8', 
      change: 'Active today', 
      icon: FaUsers,
      color: 'bg-orange-500',
      gradient: 'from-orange-500 to-orange-600'
    }
  ];

  // Add workflow efficiency metrics
  const workflowMetrics = [
    { name: 'First Response', target: '15m', actual: '12m', efficiency: '120%' },
    { name: 'Query Resolution', target: '4h', actual: '3.5h', efficiency: '114%' },
    { name: 'Ticket Conversion', target: '30%', actual: '35%', efficiency: '117%' },
    { name: 'Customer Satisfaction', target: '90%', actual: '92%', efficiency: '102%' }
  ];
  
  // Add team performance metrics
  const teamPerformance = [
    { name: 'Support Team', queriesResolved: 28, ticketsCreated: 12, avgResponseTime: '1.4h', satisfaction: '92%' }
  ];
  
  // Add team members data
  const teamMembers = [
    { name: 'John Doe', queriesResolved: 12, ticketsCreated: 5, avgResponseTime: '1.2h', satisfaction: '94%' },
    { name: 'Jane Smith', queriesResolved: 10, ticketsCreated: 4, avgResponseTime: '1.5h', satisfaction: '91%' },
    { name: 'Mike Johnson', queriesResolved: 6, ticketsCreated: 3, avgResponseTime: '1.8h', satisfaction: '89%' }
  ];
  
  // Recent queries data
  const recentQueries = queriesData?.data?.slice(0, 5) || [];
  
  // Recent tickets data
  const recentTickets = ticketsData?.data?.slice(0, 5) || [];

  // Handle refresh
  const handleRefresh = () => {
    refetchQueries();
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
                <h1 className="text-2xl font-bold text-white">Support Team Lead Dashboard</h1>
                <p className="mt-1 text-gray-400">Manage your support team, queries, and tickets</p>
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
                {/* Team Performance - Enhanced with query metrics */}
                <motion.div 
                  className="lg:col-span-2 bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                  variants={itemVariants}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaUsersCog className="h-5 w-5 text-blue-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Support Team Performance</h3>
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
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Queries Resolved</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tickets Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Avg. Response</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Satisfaction</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {teamPerformance.map((team, index) => (
                            <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-white">{team.name}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{team.queriesResolved}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{team.ticketsCreated}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{team.avgResponseTime}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className={`text-sm ${
                                  parseInt(team.satisfaction) > 95 ? 'text-green-400' : 
                                  parseInt(team.satisfaction) > 90 ? 'text-blue-400' : 
                                  parseInt(team.satisfaction) > 85 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{team.satisfaction}</div>
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
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Queries</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tickets</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Response</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Satisfaction</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/50">
                            {teamMembers.map((member, index) => (
                              <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-white">{member.name}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-300">{member.queriesResolved}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-300">{member.ticketsCreated}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-300">{member.avgResponseTime}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className={`text-sm ${
                                    parseInt(member.satisfaction) > 95 ? 'text-green-400' : 
                                    parseInt(member.satisfaction) > 90 ? 'text-blue-400' : 
                                    parseInt(member.satisfaction) > 85 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>{member.satisfaction}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Workflow Efficiency */}
                <motion.div
                  variants={itemVariants}
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaChartLine className="h-5 w-5 text-green-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Workflow Efficiency</h3>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      {workflowMetrics.map((metric, index) => (
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
              
              {/* Recent Queries and Tickets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Queries */}
                <motion.div
                  variants={itemVariants}
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaQuestion className="h-5 w-5 text-purple-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Recent Queries</h3>
                    </div>
                    <a href="/queries" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      View All
                    </a>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      {recentQueries.length > 0 ? (
                        recentQueries.map((query, index) => (
                          <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-500/30 transition-all duration-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-white font-medium">{query.title}</h4>
                                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{query.description}</p>
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                query.status === 'open' ? 'bg-green-500/20 text-green-400' :
                                query.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                query.status === 'resolved' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {query.status?.replace('_', ' ')}
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                              <span>From: {query.customer?.userId?.email || 'Unknown'}</span>
                              <span>Created: {new Date(query.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <FaQuestion className="mx-auto h-8 w-8 mb-2 opacity-50" />
                          <p>No recent queries found</p>
                        </div>
                      )}
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
              
              {/* Team Alerts */}
              <motion.div
                variants={itemVariants}
                className="bg-gradient-to-br from-amber-600/20 to-amber-700/20 backdrop-blur-md rounded-xl shadow-xl border border-amber-500/30 p-4 hover:border-amber-400/50 transition-all duration-300 hover:shadow-amber-500/10 hover:shadow-2xl"
              >
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-amber-500/20 mr-4">
                    <FaBell className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Team Alerts</h3>
                    <p className="text-amber-200/70 text-sm mt-1">5 new notifications</p>
                  </div>
                </div>
                <button className="w-full mt-4 py-2 bg-amber-500/30 hover:bg-amber-500/40 text-amber-100 rounded-lg transition-colors duration-200">
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

export default TeamLeadSupportDashboard;
