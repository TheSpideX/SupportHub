import React from 'react';
import { motion } from 'framer-motion';
import { FaUser, FaCheck, FaComment, FaExclamationCircle, FaClock, FaEdit } from 'react-icons/fa';

interface ActivityEvent {
  id: string;
  type: 'status_change' | 'comment' | 'assignment' | 'sla_update' | 'edit';
  timestamp: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  details: {
    title: string;
    description?: string;
    from?: string;
    to?: string;
  };
}

interface ActivityMapProps {
  events: ActivityEvent[];
}

const ActivityMap: React.FC<ActivityMapProps> = ({ events }) => {
  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'status_change': return <FaCheck className="text-green-500" />;
      case 'comment': return <FaComment className="text-blue-500" />;
      case 'assignment': return <FaUser className="text-purple-500" />;
      case 'sla_update': return <FaClock className="text-orange-500" />;
      case 'edit': return <FaEdit className="text-yellow-500" />;
      default: return <FaExclamationCircle className="text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="activity-map p-4">
      <div className="relative">
        {sortedEvents.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="mb-6"
          >
            <div className="flex">
              {/* Timeline connector */}
              <div className="relative flex flex-col items-center mr-4">
                <div className="h-full w-0.5 bg-gray-300 dark:bg-gray-700 absolute left-1/2 transform -translate-x-1/2"></div>
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center z-10">
                  {getEventIcon(event.type)}
                </div>
              </div>
              
              {/* Event content */}
              <div className="flex-1">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center overflow-hidden mr-3">
                      {event.user.avatar ? (
                        <img src={event.user.avatar} alt={event.user.name} className="w-full h-full object-cover" />
                      ) : (
                        <FaUser className="text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{event.details.title}</h4>
                      <p className="text-xs text-gray-500">
                        {event.user.name} • {formatDate(event.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  {event.details.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      {event.details.description}
                    </p>
                  )}
                  
                  {event.type === 'status_change' && event.details.from && event.details.to && (
                    <div className="flex items-center mt-2 text-sm">
                      <span className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {event.details.from}
                      </span>
                      <span className="mx-2">→</span>
                      <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        {event.details.to}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ActivityMap;