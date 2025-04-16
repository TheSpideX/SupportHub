import React from 'react';
import { motion } from 'framer-motion';
import {
  FaLaptop,
  FaDesktop,
  FaMobile,
  FaTablet,
  FaSignOutAlt,
  FaExclamationTriangle,
  FaSync,
} from 'react-icons/fa';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/buttons/Button';
import { Session } from '../api/profileApi';

interface SessionsCardProps {
  sessions: Session[];
  isLoading: boolean;
  error: Error | null;
  onTerminateSession: (sessionId: string) => Promise<void>;
  onTerminateAllOtherSessions: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

const SessionsCard: React.FC<SessionsCardProps> = ({
  sessions,
  isLoading,
  error,
  onTerminateSession,
  onTerminateAllOtherSessions,
  onRefresh,
}) => {
  return (
    <Card className="bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl overflow-hidden transition-all duration-300 hover:border-white/20">
      <CardHeader className="bg-gradient-to-r from-amber-900/50 to-orange-900/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-amber-900/50 rounded-lg mr-2">
              <FaLaptop className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-white">
                Active Sessions
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Manage devices where you're currently logged in
              </CardDescription>
            </div>
          </div>
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
                  Error loading sessions
                </p>
                <p className="mt-1 text-xs text-red-300/80">
                  {error.message || 'Failed to load active sessions. Please try again.'}
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
        ) : isLoading && sessions.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex flex-col items-center">
              <FaSync className="h-8 w-8 text-amber-400 animate-spin mb-4" />
              <p className="text-gray-400">Loading sessions...</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <FaExclamationTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-200 font-medium">
                  No active sessions found
                </p>
                <p className="mt-1 text-xs text-amber-300/80">
                  You don't have any active sessions other than the current one.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:border-amber-500/30 transition-all duration-300"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-gray-800 rounded-lg">
                    {session.deviceType === "desktop" ? (
                      <FaDesktop className="h-4 w-4 text-blue-400" />
                    ) : session.deviceType === "mobile" ? (
                      <FaMobile className="h-4 w-4 text-green-400" />
                    ) : (
                      <FaTablet className="h-4 w-4 text-purple-400" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-white">
                      {session.deviceName}
                      {session.browser && session.os && ` (${session.browser} on ${session.os})`}
                    </p>
                    <div className="flex items-center mt-1">
                      <p className="text-xs text-gray-400">
                        {session.location} • {session.lastActive}
                      </p>
                      {session.current && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-900/50 text-green-400 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!session.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={() => onTerminateSession(session.id)}
                    disabled={isLoading}
                  >
                    <FaSignOutAlt className="h-3 w-3 mr-1" />
                    Logout
                  </Button>
                )}
              </motion.div>
            ))}

            {sessions.length > 1 && (
              <Button
                variant="outline"
                className="w-full mt-5 border-white/10 text-white hover:bg-white/10"
                onClick={onTerminateAllOtherSessions}
                disabled={isLoading}
              >
                <FaSignOutAlt className="mr-2 h-4 w-4 text-red-400" />
                Logout from all other devices
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionsCard;
