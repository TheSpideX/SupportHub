import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { sessionService } from '../../services/session.service';
import { toast } from 'react-toastify';

interface Session {
  id: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    location?: string;
  };
  lastActivity: string;
  isCurrentSession: boolean;
}

export const SessionManager: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const { logout } = useAuth();

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 30000);

    // Listen for session events
    sessionService.events.on('sessionTerminated', handleSessionTerminated);
    sessionService.events.on('forceLogout', handleForceLogout);
    sessionService.events.on('globalLogout', handleGlobalLogout);

    return () => {
      clearInterval(interval);
      sessionService.events.removeListener('sessionTerminated', handleSessionTerminated);
      sessionService.events.removeListener('forceLogout', handleForceLogout);
      sessionService.events.removeListener('globalLogout', handleGlobalLogout);
    };
  }, []);

  const handleSessionTerminated = ({ sessionId, reason }: any) => {
    toast.info(`Session terminated: ${reason}`);
    loadSessions();
  };

  const handleForceLogout = ({ reason }: any) => {
    toast.warning('You have been logged out by an administrator');
    logout();
  };

  const handleGlobalLogout = () => {
    toast.warning('All sessions have been terminated');
    logout();
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const activeSessions = await sessionService.getAllActiveSessions();
      setSessions(activeSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const confirmed = window.confirm('Are you sure you want to end this session?');
    if (confirmed) {
      const success = await sessionService.revokeSession(sessionId);
      if (success) {
        loadSessions();
      }
    }
  };

  const handleRevokeSelected = async () => {
    if (!selectedSessions.length) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to end ${selectedSessions.length} selected session(s)?`
    );
    
    if (confirmed) {
      try {
        await Promise.all(
          selectedSessions.map(sessionId => 
            sessionService.forceLogout(sessionId, 'ADMIN_ACTION')
          )
        );
        setSelectedSessions([]);
        loadSessions();
        toast.success('Selected sessions terminated successfully');
      } catch (error) {
        toast.error('Failed to terminate some sessions');
      }
    }
  };

  const handleRevokeAllOther = async () => {
    const confirmed = window.confirm('Are you sure you want to end all other sessions?');
    if (confirmed) {
      try {
        await sessionService.logoutAllSessions(true);
        toast.success('All other sessions terminated successfully');
        loadSessions();
      } catch (error) {
        toast.error('Failed to terminate all sessions');
      }
    }
  };

  if (loading) {
    return <div>Loading sessions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Active Sessions</h2>
        <div className="space-x-2">
          {selectedSessions.length > 0 && (
            <button
              onClick={handleRevokeSelected}
              className="text-red-600 hover:text-red-800"
            >
              End Selected Sessions
            </button>
          )}
          <button
            onClick={handleRevokeAllOther}
            className="text-red-600 hover:text-red-800"
          >
            End All Other Sessions
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`p-4 border rounded-lg flex justify-between items-center ${
              selectedSessions.includes(session.id) ? 'bg-gray-50' : ''
            }`}
          >
            <div className="flex items-center space-x-4">
              {!session.isCurrentSession && (
                <input
                  type="checkbox"
                  checked={selectedSessions.includes(session.id)}
                  onChange={(e) => {
                    setSelectedSessions(prev =>
                      e.target.checked
                        ? [...prev, session.id]
                        : prev.filter(id => id !== session.id)
                    );
                  }}
                  className="h-4 w-4"
                />
              )}
              <div>
                <div className="font-medium">
                  {session.deviceInfo.platform}
                  {session.isCurrentSession && " (Current Session)"}
                </div>
                <div className="text-sm text-gray-600">
                  {session.deviceInfo.userAgent}
                </div>
                <div className="text-sm text-gray-500">
                  Last activity: {new Date(session.lastActivity).toLocaleString()}
                </div>
              </div>
            </div>
            
            {!session.isCurrentSession && (
              <button
                onClick={() => handleRevokeSession(session.id)}
                className="text-red-600 hover:text-red-800"
              >
                End Session
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};