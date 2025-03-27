import React, { useState } from 'react';
import { FaTicketAlt, FaUserClock, FaServer, FaTools, FaExclamationTriangle, FaCode } from 'react-icons/fa';
import { useAuth } from '../../features/auth/hooks/useAuth';

const TechnicalDashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  
  // Mock data
  const stats = [
    { 
      title: 'Assigned Tickets', 
      value: '18', 
      change: '+3 today', 
      icon: FaTicketAlt,
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      title: 'System Status', 
      value: '97%', 
      change: 'All systems operational', 
      icon: FaServer,
      gradient: 'from-green-500 to-green-600'
    },
    { 
      title: 'Avg. Resolution Time', 
      value: '3.2h', 
      change: '-0.5h from last week', 
      icon: FaUserClock,
      gradient: 'from-purple-500 to-purple-600'
    },
    { 
      title: 'Critical Issues', 
      value: '2', 
      change: 'Needs attention', 
      icon: FaExclamationTriangle,
      gradient: 'from-red-500 to-red-600'
    }
  ];
  
  const activeTickets = [
    { id: 'T-1042', customer: 'Stark Industries', title: 'Security breach alert', priority: 'Critical', status: 'In Progress', sla: '2h remaining' },
    { id: 'T-1039', customer: 'Acme Corp', title: 'Database performance issue', priority: 'High', status: 'Investigating', sla: '4h remaining' },
    { id: 'T-1036', customer: 'Wayne Enterprises', title: 'API integration failure', priority: 'Medium', status: 'Pending Info', sla: '12h remaining' }
  ];
  
  const systemStatus = [
    { name: 'Authentication Service', status: 'Operational', uptime: '99.98%', lastIncident: '15d ago' },
    { name: 'Database Cluster', status: 'Operational', uptime: '99.95%', lastIncident: '3d ago' },
    { name: 'API Gateway', status: 'Degraded', uptime: '98.72%', lastIncident: 'Ongoing' },
    { name: 'Storage Service', status: 'Operational', uptime: '99.99%', lastIncident: '45d ago' }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name || 'Technician'}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Here's your technical support overview.
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
          >
            <div className={`bg-gradient-to-r ${stat.gradient} px-4 py-3`}>
              <div className="flex items-center">
                <stat.icon className="h-6 w-6 text-white" />
                <h3 className="ml-2 text-sm font-medium text-white">{stat.title}</h3>
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.change}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Active Tickets */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active Tickets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ticket ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Issue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SLA</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {activeTickets.map((ticket, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{ticket.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{ticket.customer}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{ticket.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      ticket.priority === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      ticket.priority === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{ticket.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{ticket.sla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">System Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uptime</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Incident</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {systemStatus.map((service, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{service.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      service.status === 'Operational' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      service.status === 'Degraded' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {service.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{service.uptime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{service.lastIncident}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Technical Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Diagnostics Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <FaTools className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Diagnostics Tools</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                <FaServer className="mr-2" /> Network Scan
              </button>
              <button className="flex items-center justify-center px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                <FaCode className="mr-2" /> Log Analyzer
              </button>
              <button className="flex items-center justify-center px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                <FaTools className="mr-2" /> System Check
              </button>
              <button className="flex items-center justify-center px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
                <FaExclamationTriangle className="mr-2" /> Security Scan
              </button>
            </div>
          </div>
        </div>
        
        {/* Knowledge Base */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Technical Resources</h3>
          </div>
          <div className="p-6">
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                  <FaCode className="mr-2" /> Common API Troubleshooting Guide
                </a>
              </li>
              <li>
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                  <FaServer className="mr-2" /> Database Performance Optimization
                </a>
              </li>
              <li>
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                  <FaExclamationTriangle className="mr-2" /> Security Incident Response Protocol
                </a>
              </li>
              <li>
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center">
                  <FaTools className="mr-2" /> System Integration Documentation
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalDashboard;