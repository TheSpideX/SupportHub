import React from 'react';
import { motion } from 'framer-motion';
import { FaUser, FaCheck, FaComment, FaExclamationCircle, FaClock, FaEdit, FaArrowRight, FaUserPlus } from 'react-icons/fa';

export interface ActivityEvent {
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
  children?: ActivityEvent[];
}

interface ActivityMindMapProps {
  events: ActivityEvent[];
}

const ActivityMindMap: React.FC<ActivityMindMapProps> = ({ events }) => {
  // Organize events into a tree structure
  const organizeEvents = (eventList: ActivityEvent[]): ActivityEvent[] => {
    // Sort events by timestamp
    const sortedEvents = [...eventList].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Create a hierarchical structure based on event types
    const rootEvents: ActivityEvent[] = [];
    const statusEvents: {[key: string]: ActivityEvent} = {};
    
    sortedEvents.forEach(event => {
      if (event.type === 'status_change') {
        statusEvents[event.id] = {...event, children: []};
        rootEvents.push(statusEvents[event.id]);
      } else {
        // Find the most recent status change to attach this event to
        const recentStatusId = Object.keys(statusEvents).sort((a, b) => {
          const timeA = new Date(statusEvents[a].timestamp).getTime();
          const timeB = new Date(statusEvents[b].timestamp).getTime();
          return timeB - timeA;
        })[0];
        
        if (recentStatusId) {
          statusEvents[recentStatusId].children = statusEvents[recentStatusId].children || [];
          statusEvents[recentStatusId].children?.push(event);
        } else {
          // If no status change yet, add to root
          rootEvents.push(event);
        }
      }
    });
    
    return rootEvents;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'status_change': return <FaArrowRight className="text-blue-400" />;
      case 'comment': return <FaComment className="text-indigo-400" />;
      case 'assignment': return <FaUserPlus className="text-purple-400" />;
      case 'sla_update': return <FaClock className="text-amber-400" />;
      case 'edit': return <FaEdit className="text-emerald-400" />;
      default: return <FaExclamationCircle className="text-gray-400" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'status_change': return 'from-blue-600/20 to-blue-600/5 border-blue-500/30';
      case 'comment': return 'from-indigo-600/20 to-indigo-600/5 border-indigo-500/30';
      case 'assignment': return 'from-purple-600/20 to-purple-600/5 border-purple-500/30';
      case 'sla_update': return 'from-amber-600/20 to-amber-600/5 border-amber-500/30';
      case 'edit': return 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/30';
      default: return 'from-gray-600/20 to-gray-600/5 border-gray-500/30';
    }
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderEvent = (event: ActivityEvent, index: number, depth: number = 0) => {
    const hasChildren = event.children && event.children.length > 0;
    
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className="mb-6"
        style={{ marginLeft: `${depth * 40}px` }}
      >
        <div className="flex">
          <div className="relative flex flex-col items-center mr-4">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-b ${getEventColor(event.type)} border flex items-center justify-center z-10 shadow-lg`}>
              {getEventIcon(event.type)}
            </div>
            {hasChildren && (
              <div className="h-full w-0.5 bg-gradient-to-b from-gray-500 to-gray-700 absolute top-10 bottom-0 left-1/2 transform -translate-x-1/2"></div>
            )}
          </div>
          
          <div className="flex-1">
            <div className={`p-4 rounded-lg shadow-md border bg-gradient-to-br ${getEventColor(event.type)}`}>
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-800/60 flex items-center justify-center overflow-hidden mr-3 border border-gray-700">
                  {event.user.avatar ? (
                    <img src={event.user.avatar} alt={event.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <FaUser className="text-gray-300" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-white">{event.details.title}</h4>
                  <p className="text-xs text-gray-300">
                    {event.user.name} • {formatDate(event.timestamp)}
                  </p>
                </div>
              </div>
              
              {event.details.description && (
                <p className="text-sm text-gray-200 mt-2 bg-gray-800/30 p-2 rounded">
                  {event.details.description}
                </p>
              )}
              
              {event.type === 'status_change' && event.details.from && event.details.to && (
                <div className="flex items-center mt-3 text-sm">
                  <span className="px-2 py-1 rounded bg-gray-800/50 text-gray-300 border border-gray-700">
                    {event.details.from}
                  </span>
                  <span className="mx-2 text-gray-400">
                    <FaArrowRight />
                  </span>
                  <span className="px-2 py-1 rounded bg-blue-900/30 text-blue-300 border border-blue-800/50">
                    {event.details.to}
                  </span>
                </div>
              )}
            </div>
            
            {hasChildren && (
              <div className="mt-4 space-y-4">
                {event.children?.map((childEvent, childIndex) => 
                  renderEvent(childEvent, childIndex, depth + 1)
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const organizedEvents = organizeEvents(events);

  return (
    <div className="activity-mind-map p-4">
      <div className="relative">
        {organizedEvents.map((event, index) => renderEvent(event, index))}
      </div>
    </div>
  );
};

export default ActivityMindMap;
