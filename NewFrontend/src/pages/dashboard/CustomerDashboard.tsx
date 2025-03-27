import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaTicketAlt, FaCheckCircle, FaPlus, FaUser, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../../features/auth/hooks/useAuth';

const CustomerDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [expandedActivity, setExpandedActivity] = useState(true);
  const [userName, setUserName] = useState<string>('User');
  
  // Update username when user data is available
  useEffect(() => {
    if (isLoading) return; // Skip if still loading
    
    console.log('CustomerDashboard user data:', user);
    
    if (user?.name) {
      setUserName(user.name);
    } else if (user?.role === 'admin') {
      setUserName('Admin');
    } else if (isAuthenticated) {
      // If authenticated but no name/role, use email or a default
      setUserName(user?.email || 'Authenticated User');
    }
  }, [user, isAuthenticated, isLoading]);
  
  // Mock data
  const stats = [
    { 
      title: 'Open Tickets', 
      value: '3', 
      change: '+1 from last week', 
      icon: FaTicketAlt,
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      title: 'Resolved Tickets', 
      value: '12', 
      change: '+4 from last month', 
      icon: FaCheckCircle,
      gradient: 'from-green-500 to-green-600'
    }
  ];
  
  const myTickets = [
    { id: 'T-1001', title: 'Login issue with mobile app', status: 'open', priority: 'High', updated: '2 hours ago' },
    { id: 'T-982', title: 'Dashboard data not loading', status: 'in_progress', priority: 'Medium', updated: '1 day ago' },
    { id: 'T-943', title: 'Password reset not working', status: 'waiting', priority: 'Low', updated: '3 days ago' }
  ];
  
  const recentActivity = [
    { id: 1, title: 'Support replied to your ticket #T-1001', time: '2 hours ago', type: 'reply' },
    { id: 2, title: 'Your ticket #T-982 status changed to In Progress', time: '1 day ago', type: 'status' },
    { id: 3, title: 'You created a new ticket #T-1001', time: '2 days ago', type: 'create' }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {userName}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Here's what's happening with your support tickets today.
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
          >
            <div className={`bg-gradient-to-r ${stat.gradient} px-6 py-4`}>
              <div className="flex items-center">
                <stat.icon className="h-8 w-8 text-white" />
                <h3 className="ml-3 text-lg font-medium text-white">{stat.title}</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.change}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* My Tickets */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">My Tickets</h3>
          <button className="flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300">
            <FaPlus className="h-3 w-3 mr-1" />
            New Ticket
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Updated</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {myTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600 dark:text-primary-400">{ticket.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{ticket.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                      ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {ticket.status === 'open' ? 'Open' : 
                       ticket.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ticket.priority === 'High' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                      ticket.priority === 'Medium' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ticket.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div 
          className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
          onClick={() => setExpandedActivity(!expandedActivity)}
        >
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h3>
          <span className="text-gray-500 dark:text-gray-400">
            {expandedActivity ? '−' : '+'}
          </span>
        </div>
        {expandedActivity && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="px-6 py-4 flex items-start">
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  activity.type === 'reply' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  activity.type === 'status' ? 'bg-green-100 dark:bg-green-900/30' :
                  'bg-purple-100 dark:bg-purple-900/30'
                }`}>
                  <FaUser className={`h-4 w-4 ${
                    activity.type === 'reply' ? 'text-blue-600 dark:text-blue-400' :
                    activity.type === 'status' ? 'text-green-600 dark:text-green-400' :
                    'text-purple-600 dark:text-purple-400'
                  }`} />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-900 dark:text-white">{activity.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboard;
