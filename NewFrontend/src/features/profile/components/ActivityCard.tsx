import React from 'react';
import { motion } from 'framer-motion';
import {
  FaHistory,
  FaExclamationTriangle,
  FaSync,
  FaKey,
  FaSignInAlt,
  FaSignOutAlt,
  FaUserEdit,
  FaShieldAlt,
  FaExclamationCircle,
} from 'react-icons/fa';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { ActivityEvent } from '../api/profileApi';

interface ActivityCardProps {
  activities: ActivityEvent[];
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => Promise<void>;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activities,
  isLoading,
  error,
  onRefresh,
}) => {
  // Function to get the appropriate icon for an activity
  const getActivityIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return <FaSignInAlt className="h-5 w-5 text-green-400" />;
      case 'logout':
        return <FaSignOutAlt className="h-5 w-5 text-amber-400" />;
      case 'password changed':
        return <FaKey className="h-5 w-5 text-blue-400" />;
      case 'profile updated':
        return <FaUserEdit className="h-5 w-5 text-purple-400" />;
      case 'security setting changed':
        return <FaShieldAlt className="h-5 w-5 text-indigo-400" />;
      case 'suspicious activity':
        return <FaExclamationCircle className="h-5 w-5 text-red-400" />;
      default:
        return <FaHistory className="h-5 w-5 text-blue-400" />;
    }
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-blue-900/50 rounded-lg mr-2">
              <FaHistory className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-white">
                Recent Activity
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Your account activity over the last 30 days
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600/50 text-white hover:bg-blue-600/70">
              Last 30 days
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-300 hover:text-white"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <FaSync className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {error ? (
          <div className="bg-red-900/20 p-4 rounded-lg border border-red-800/50 mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <FaExclamationTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-200 font-medium">
                  Error loading activity
                </p>
                <p className="mt-1 text-xs text-red-300/80">
                  {error.message || 'Failed to load recent activity. Please try again.'}
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-red-600/70 hover:bg-red-600 text-white text-xs"
                  onClick={onRefresh}
                >
                  <FaSync className="mr-1.5 h-3 w-3" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        ) : isLoading && activities.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex flex-col items-center">
              <FaSync className="h-8 w-8 text-blue-400 animate-spin mb-4" />
              <p className="text-gray-400">Loading activity...</p>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <FaExclamationTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-200 font-medium">
                  No recent activity found
                </p>
                <p className="mt-1 text-xs text-amber-300/80">
                  There is no recorded activity for your account in the last 30 days.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start border-b border-white/10 pb-4 hover:bg-white/5 p-2 rounded-lg transition-all duration-300"
              >
                <div className="p-2 bg-blue-900/30 rounded-lg mt-1">
                  {getActivityIcon(activity.action)}
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex justify-between">
                    <p className="text-white font-medium">
                      {activity.action}
                    </p>
                    <span className="text-sm text-gray-400">
                      {activity.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {activity.device} • {activity.location}
                    {activity.ip && ` • ${activity.ip}`}
                  </p>
                  {activity.metadata && (
                    <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-300">
                      {Object.entries(activity.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium">{key}:</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activities.length > 0 && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
            >
              <FaHistory className="mr-2 h-4 w-4" />
              View Full Activity History
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityCard;
