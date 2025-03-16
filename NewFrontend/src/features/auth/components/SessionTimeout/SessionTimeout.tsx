import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AUTH_CONSTANTS } from '../../constants/auth.constants';
import { toast } from 'react-hot-toast';

export const SessionTimeout: React.FC = () => {
  const { sessionExpiry, refreshSession } = useAuth();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!sessionExpiry) return;

    const timeUntilExpiry = sessionExpiry - Date.now();
    const warningTime = AUTH_CONSTANTS.SESSION.EXPIRY_THRESHOLD;

    if (timeUntilExpiry <= warningTime) {
      setShowWarning(true);
      toast.warning('Your session will expire soon. Would you like to extend it?', {
        duration: 10000,
        action: {
          label: 'Extend Session',
          onClick: () => refreshSession()
        }
      });
    }

    // Set up timer to check session status
    const timer = setInterval(() => {
      const currentTimeUntilExpiry = sessionExpiry - Date.now();
      if (currentTimeUntilExpiry <= 0) {
        // Handle session expiry through auth context
        refreshSession();
      }
    }, AUTH_CONSTANTS.SESSION.CHECK_INTERVAL);

    return () => clearInterval(timer);
  }, [sessionExpiry, refreshSession]);

  return null;
};