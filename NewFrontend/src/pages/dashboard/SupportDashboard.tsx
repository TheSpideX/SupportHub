import React, { useState } from 'react';
import { FaTicketAlt, FaUserClock, FaChartLine, FaUsers, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../../features/auth/hooks/useAuth';

const SupportDashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  
  // Mock data
  const stats = [
    { 
      title: 'Open Tickets', 
      value: '24', 
      change: '+3 from yesterday', 
      icon: FaTicketAlt,
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      title: 'Avg. Response Time', 
      value: '1.2h', 
      change: '-0.3h from last week', 
      icon: FaUserClock,
      gradient: 'from-green-500 to-green-600'
    },
    { 
      title: 'Tickets Resolved', 
      value: '18', 
      change: '+5 from yesterday', 
      icon: FaChartLine,
      gradient: 'from-purple-500 to-purple-600'
    },
    { 
      title: 'Active Customers', 
      value: '156', 
      change: '+12 from last week', 
      icon: FaUsers,
      gradient: 'from-orange-500 to-orange-600'
    }
  ];
  
  const urgentTickets = [
    { id: 'T-1053', customer: 'Acme Corp', title: 'Critical system outage', priority: 'Critical', waiting: '45m' },
    { id: 'T-1047', customer: 'Globex Inc', title: 'Payment processing failure', priority: 'High', waiting: '1h 20m' },
    { id: 'T-1042', customer: 'Stark Industries', title: 'Security breach alert', priority: 'Critical', waiting: '2h 5m' }
  ];
  
  const myAssignedTickets = [
    { id: 'T-1001', customer: 'Wayne Enterprises', title: 'Login issue with mobile app', status: 'open', updated: '2 hours ago' },
    { id: 'T-982', customer: 'Umbrella Corp', title: 'Dashboard data not loading', status: 'in_progress', updated: '1 day ago' },
    { id: 'T-943', customer: 'Cyberdyne Systems', title: 'Password reset not working', status: 'waiting', updated: '3 days ago' }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name || 'Support Agent'}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          You have {urgentTickets.length} urgent tickets requiring attention.
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
      
      {/* Urgent Tickets */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center">
            <FaExclamationTriangle className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Urgent Tickets</h3>
          </div>
          <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {urgentTickets.length} Tickets
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Issue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Waiting</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {urgentTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600 dark:text-primary-400">{ticket.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{ticket.customer}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{ticket.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ticket.priority === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ticket.waiting}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
                      Claim
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* My Assigned Tickets */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">My Assigned Tickets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Issue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Updated</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {myAssignedTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600 dark:text-primary-400">{ticket.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{ticket.customer}</td>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ticket.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupportDashboard;
