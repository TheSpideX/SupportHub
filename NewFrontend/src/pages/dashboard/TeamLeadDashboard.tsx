import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FaTicketAlt, FaUserClock, FaChartLine, FaUsers, FaExclamationTriangle, 
  FaUsersCog, FaServer, FaClipboardCheck, FaRegClock, FaExchangeAlt,
  FaCalendarAlt, FaClipboardList, FaHeadset, FaBell, FaUserShield,
  FaChartPie, FaUserCheck, FaAward, FaComments, FaTools, FaFileAlt
} from 'react-icons/fa';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useRoleBasedFilter } from '../../hooks/useRoleBasedFilter';
import TopNavbar from '@/components/dashboard/TopNavbar';
import Sidebar from '@/components/dashboard/Sidebar';
import Footer from '@/components/dashboard/Footer';

const TeamLeadDashboard: React.FC = () => {
  const { user } = useAuth();
  const { filterByRole } = useRoleBasedFilter();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
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
  
  // Mock data
  const stats = [
    { 
      title: 'Team Tickets', 
      value: '42', 
      change: '+8 this week', 
      icon: FaTicketAlt,
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      title: 'Team Performance', 
      value: '92%', 
      change: '+3% from last week', 
      icon: FaUsersCog,
      color: 'bg-green-500',
      gradient: 'from-green-500 to-green-600'
    },
    { 
      title: 'Avg. Response Time', 
      value: '1.4h', 
      change: '-0.2h from last week', 
      icon: FaUserClock,
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-purple-600'
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
  
  const teamMembers = [
    { name: 'John Smith', ticketsResolved: 12, avgResponseTime: '1.2h', satisfaction: '94%', status: 'online' },
    { name: 'Jane Doe', ticketsResolved: 15, avgResponseTime: '1.0h', satisfaction: '96%', status: 'online' },
    { name: 'Mike Johnson', ticketsResolved: 8, avgResponseTime: '1.8h', satisfaction: '88%', status: 'offline' },
    { name: 'Sarah Williams', ticketsResolved: 14, avgResponseTime: '1.5h', satisfaction: '92%', status: 'online' }
  ];
  
  const unassignedTickets = [
    { id: 'T-1053', customer: 'Acme Corp', title: 'Critical system outage', priority: 'Critical', waiting: '45m' },
    { id: 'T-1047', customer: 'Globex Inc', title: 'Payment processing failure', priority: 'High', waiting: '1h 20m' },
    { id: 'T-1042', customer: 'Stark Industries', title: 'Security breach alert', priority: 'Critical', waiting: '2h 5m' }
  ];

  // Team workload data
  const teamWorkload = [
    { team: 'Support', assigned: 24, inProgress: 18, backlog: 6, capacity: 30 },
    { team: 'Technical', assigned: 18, inProgress: 12, backlog: 6, capacity: 20 }
  ];

  // Add workflow efficiency metrics
  const workflowMetrics = [
    { name: 'First Response', target: '15m', actual: '12m', efficiency: '120%' },
    { name: 'Triage Time', target: '30m', actual: '28m', efficiency: '107%' },
    { name: 'Reassignment Rate', target: '<10%', actual: '8.5%', efficiency: '115%' },
    { name: 'Resolution Rate', target: '85%', actual: '87%', efficiency: '102%' }
  ];
  
  // Add team performance metrics
  const teamPerformance = [
    { name: 'Support Team', ticketsResolved: 42, avgResponseTime: '1.4h', satisfaction: '92%', slaCompliance: '96%' },
    { name: 'Technical Team', ticketsResolved: 36, avgResponseTime: '2.1h', satisfaction: '89%', slaCompliance: '91%' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} userRole={user?.role} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Team Lead Dashboard</h1>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setSelectedPeriod('week')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedPeriod === 'week' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  Week
                </button>
                <button 
                  onClick={() => setSelectedPeriod('month')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedPeriod === 'month' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  Month
                </button>
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
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                          <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
                        </div>
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center bg-gradient-to-r ${stat.gradient} opacity-80`}>
                          <stat.icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Quick Actions */}
              <motion.div 
                variants={itemVariants}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-blue-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaUsersCog className="mr-2 text-blue-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">Manage Team</span>
                </button>
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-green-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaTicketAlt className="mr-2 text-green-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">Assign Tickets</span>
                </button>
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaChartLine className="mr-2 text-purple-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">View Reports</span>
                </button>
                <button className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-700/30 to-gray-700/10 text-gray-300 rounded-lg border border-gray-700/50 hover:border-orange-500/50 hover:bg-gray-700/50 transition-all duration-200 group shadow-md hover:shadow-lg">
                  <FaRegClock className="mr-2 text-orange-400 group-hover:scale-110 transition-transform" /> 
                  <span className="font-medium">Schedule</span>
                </button>
              </motion.div>

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
                    <div className="flex space-x-2">
                      <button className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md hover:bg-blue-500/30 transition-colors">
                        Export
                      </button>
                      <button className="text-xs px-2 py-1 bg-gray-700/50 text-gray-300 rounded-md hover:bg-gray-700/70 transition-colors">
                        Filter
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    {/* Add performance summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-lg p-4 border border-green-500/20">
                        <h4 className="text-sm font-medium text-green-400">SLA Compliance</h4>
                        <p className="text-2xl font-bold text-white mt-1">96%</p>
                        <p className="text-xs text-green-300/70 mt-1">+2% from last week</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-lg p-4 border border-blue-500/20">
                        <h4 className="text-sm font-medium text-blue-400">Avg Response</h4>
                        <p className="text-2xl font-bold text-white mt-1">1.4h</p>
                        <p className="text-xs text-blue-300/70 mt-1">-0.2h from last week</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-lg p-4 border border-purple-500/20">
                        <h4 className="text-sm font-medium text-purple-400">CSAT Score</h4>
                        <p className="text-2xl font-bold text-white mt-1">92%</p>
                        <p className="text-xs text-purple-300/70 mt-1">+1% from last week</p>
                      </div>
                    </div>
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
                                <div className={`text-sm ${
                                  parseInt(team.satisfaction) > 95 ? 'text-green-400' : 
                                  parseInt(team.satisfaction) > 90 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{team.satisfaction}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>

                {/* Team Members Table - Enhanced */}
                <motion.div
                  variants={itemVariants}
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-green-500/30 transition-all duration-300"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaUsersCog className="h-5 w-5 text-green-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Team Members</h3>
                    </div>
                    <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      Manage Team
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tickets Resolved</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Avg Response</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Satisfaction</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {teamMembers.map((member, index) => (
                            <tr key={index} className="hover:bg-gray-700/50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-white">{member.name}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{member.ticketsResolved}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{member.avgResponseTime}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className={`text-sm ${
                                  parseInt(member.satisfaction) > 95 ? 'text-green-400' : 
                                  parseInt(member.satisfaction) > 90 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{member.satisfaction}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className={`h-2.5 w-2.5 rounded-full mr-2 ${
                                    member.status === 'online' ? 'bg-green-400' : 'bg-gray-400'
                                  }`}></div>
                                  <span className="text-sm text-gray-300 capitalize">{member.status}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button className="text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium py-2 px-4 rounded-lg border border-blue-500/30 transition-colors">
                        View All Team Members
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Unassigned Tickets */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-red-500/30 transition-all duration-300"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaExclamationTriangle className="h-5 w-5 text-red-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Unassigned Tickets</h3>
                    </div>
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {unassignedTickets.length} Unassigned
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Customer</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Title</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Priority</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Waiting</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {unassignedTickets.map((ticket) => (
                            <tr key={ticket.id} className="hover:bg-gray-700/50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-blue-400">{ticket.id}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{ticket.customer}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{ticket.title}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  ticket.priority === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                  ticket.priority === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                  'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}>
                                  {ticket.priority}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-300">{ticket.waiting}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button className="text-blue-400 hover:text-blue-300 font-medium text-sm">
                                  Assign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button className="text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium py-2 px-4 rounded-lg border border-blue-500/30 transition-colors">
                        View All Tickets
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Team Workload */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 hover:border-purple-500/30 transition-all duration-300"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaUsers className="h-5 w-5 text-purple-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Team Workload</h3>
                    </div>
                    <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      Manage Workload
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
                                  <div className={`text-sm ${utilizationColor}`}>{utilization.toFixed(0)}%</div>
                                  <div className="w-24 h-2 bg-gray-700 rounded-full mt-1">
                                    <div 
                                      className={`h-2 rounded-full ${
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

                {/* New Component: Workflow Efficiency */}
                <motion.div 
                  className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-teal-500/30 transition-all duration-300"
                  variants={itemVariants}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                    <div className="flex items-center">
                      <FaClipboardCheck className="h-5 w-5 text-teal-400 mr-2" />
                      <h3 className="text-lg font-semibold text-white">Workflow Efficiency</h3>
                    </div>
                    <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                      Optimize
                    </button>
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
                          <div className="mt-2 h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
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
            </motion.div>
          </div>
          
          {/* Team Performance Metrics */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 px-4 sm:px-6 lg:px-8"
          >
            <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-indigo-500/30 transition-all duration-300">
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaChartPie className="h-5 w-5 text-indigo-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Team Performance Metrics</h3>
                </div>
                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  View Full Report
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Average Response Time</span>
                    <span className="text-sm font-medium text-green-400">1.8h</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                    <span className="ml-2 text-xs text-gray-400">75%</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">Target: 2.5h | -0.7h from last week</p>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">First Contact Resolution</span>
                    <span className="text-sm font-medium text-yellow-400">68%</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '68%' }}></div>
                    </div>
                    <span className="ml-2 text-xs text-gray-400">68%</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">Target: 75% | +2% from last week</p>
                </div>
                
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Customer Satisfaction</span>
                    <span className="text-sm font-medium text-blue-400">92%</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                    <span className="ml-2 text-xs text-gray-400">92%</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">Target: 90% | +1% from last week</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Team Member Performance */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-6 px-4 sm:px-6 lg:px-8"
          >
            <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-green-500/30 transition-all duration-300">
              <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                <div className="flex items-center">
                  <FaUserCheck className="h-5 w-5 text-green-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Team Member Performance</h3>
                </div>
                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  View All Members
                </button>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team Member</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tickets Resolved</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Avg Response</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">CSAT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {[
                        { name: 'Alex Johnson', resolved: 42, response: '1.2h', csat: '95%', status: 'Available' },
                        { name: 'Sarah Miller', resolved: 38, response: '1.5h', csat: '92%', status: 'On Call' },
                        { name: 'David Chen', resolved: 35, response: '1.8h', csat: '90%', status: 'Available' },
                        { name: 'Maria Garcia', resolved: 45, response: '1.3h', csat: '94%', status: 'Break' }
                      ].map((member, index) => (
                        <tr key={index} className="hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-white">{member.name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-300">{member.resolved}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-300">{member.response}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className={`text-sm ${
                              parseInt(member.csat) > 90 ? 'text-green-400' : 
                              parseInt(member.csat) > 80 ? 'text-yellow-400' : 'text-red-400'
                            }`}>{member.csat}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              member.status === 'Available' ? 'bg-green-100 text-green-800' : 
                              member.status === 'On Call' ? 'bg-blue-100 text-blue-800' : 
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {member.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Escalation Management */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-6 px-4 sm:px-6 lg:px-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-red-500/30 transition-all duration-300">
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaUserShield className="h-5 w-5 text-red-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">Escalation Management</h3>
                  </div>
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    View All
                  </button>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {[
                      { id: 'ESC-1023', title: 'Payment Gateway Error', priority: 'High', age: '4h 23m' },
                      { id: 'ESC-1022', title: 'Account Access Issue', priority: 'Medium', age: '6h 12m' },
                      { id: 'ESC-1021', title: 'Data Sync Failure', priority: 'High', age: '2h 45m' }
                    ].map((escalation, index) => (
                      <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-all duration-200">
                        <div className="flex justify-between">
                          <div>
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-white">{escalation.title}</span>
                              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                escalation.priority === 'High' ? 'bg-red-900/50 text-red-300' : 
                                'bg-yellow-900/50 text-yellow-300'
                              }`}>
                                {escalation.priority}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-400">ID: {escalation.id} | Age: {escalation.age}</div>
                          </div>
                          <button className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg font-medium transition-colors">
                            Assign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300">
                <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaFileAlt className="h-5 w-5 text-blue-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">Knowledge Base Updates</h3>
                  </div>
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    Create New
                  </button>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {[
                      { title: 'Updated Password Reset Guide', author: 'Sarah Miller', date: '2 days ago', status: 'Needs Review' },
                      { title: 'New API Integration Tutorial', author: 'David Chen', date: '1 week ago', status: 'Published' },
                      { title: 'Troubleshooting Network Issues', author: 'Alex Johnson', date: '3 days ago', status: 'Draft' }
                    ].map((article, index) => (
                      <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-all duration-200">
                        <div className="flex justify-between">
                          <div>
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-white">{article.title}</span>
                              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                article.status === 'Published' ? 'bg-green-900/50 text-green-300' : 
                                article.status === 'Draft' ? 'bg-gray-700 text-gray-300' :
                                'bg-yellow-900/50 text-yellow-300'
                              }`}>
                                {article.status}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-400">By: {article.author} | {article.date}</div>
                          </div>
                          <button className="text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-3 py-1.5 rounded-lg font-medium transition-colors">
                            Review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Team Lead Actions Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 px-4 sm:px-6 lg:px-8 mb-8"
          >
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-md rounded-xl shadow-xl border border-blue-500/30 p-4 hover:border-blue-400/50 transition-all duration-300 hover:shadow-blue-500/10 hover:shadow-2xl">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-500/20 mr-4">
                  <FaClipboardList className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">Ticket Approvals</h3>
                  <p className="text-blue-200/70 text-sm mt-1">3 pending approvals</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 bg-blue-500/30 hover:bg-blue-500/40 text-blue-100 rounded-lg transition-colors duration-200">
                Review Tickets
              </button>
            </div>
            
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur-md rounded-xl shadow-xl border border-purple-500/30 p-4 hover:border-purple-400/50 transition-all duration-300 hover:shadow-purple-500/10 hover:shadow-2xl">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-500/20 mr-4">
                  <FaCalendarAlt className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">Team Schedule</h3>
                  <p className="text-purple-200/70 text-sm mt-1">Manage shifts & availability</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 bg-purple-500/30 hover:bg-purple-500/40 text-purple-100 rounded-lg transition-colors duration-200">
                View Schedule
              </button>
            </div>
            
            <div className="bg-gradient-to-br from-teal-600/20 to-teal-700/20 backdrop-blur-md rounded-xl shadow-xl border border-teal-500/30 p-4 hover:border-teal-400/50 transition-all duration-300 hover:shadow-teal-500/10 hover:shadow-2xl">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-teal-500/20 mr-4">
                  <FaHeadset className="h-6 w-6 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">SLA Monitoring</h3>
                  <p className="text-teal-200/70 text-sm mt-1">2 tickets at risk</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 bg-teal-500/30 hover:bg-teal-500/40 text-teal-100 rounded-lg transition-colors duration-200">
                View SLA Status
              </button>
            </div>
            
            <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/20 backdrop-blur-md rounded-xl shadow-xl border border-amber-500/30 p-4 hover:border-amber-400/50 transition-all duration-300 hover:shadow-amber-500/10 hover:shadow-2xl">
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
            </div>
          </motion.div>
        </main>
      </div>
      
      {/* Add Footer component */}
      <Footer />
    </div>
  );
};

export default TeamLeadDashboard;
