import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { sessionService } from '../../services/session.service';
import { RootState } from '@/store';
import { setSessionAlert, logout } from '../../store/authSlice';
import { logger } from '@/utils/logger';

export const SessionAlert: React.FC = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const alert = useSelector((state: RootState) => state.auth.sessionAlert);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const dispatch = useDispatch();

  useEffect(() => {
    if (isAuthenticated) {
      const handleSessionEvent = (event: CustomEvent) => {
        if (event.detail?.alert) {
          dispatch(setSessionAlert(event.detail.alert));
        }
      };

      window.addEventListener('sessionEvent', handleSessionEvent as EventListener);
      return () => {
        window.removeEventListener('sessionEvent', handleSessionEvent as EventListener);
      };
    }
  }, [isAuthenticated, dispatch]);

  if (!alert) return null;

  const handleAction = async () => {
    setIsVerifying(true);
    try {
      switch (alert.action) {
        case 'verify':
          const verified = await sessionService.verifySession();
          if (verified) {
            dispatch(setSessionAlert(null));
          }
          break;
        case 'reauthenticate':
          const reauthed = await sessionService.reauthenticate();
          if (reauthed) {
            dispatch(setSessionAlert(null));
          }
          break;
        case 'logout':
          dispatch(logout());
          break;
      }
    } catch (error) {
      logger.error('Session alert action failed', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const alertClasses = {
    warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
    danger: 'bg-red-50 border-red-400 text-red-800',
    error: 'bg-red-50 border-red-400 text-red-800',
  };

  const alertIcons = {
    warning: (
      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    danger: (
      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
  };

  return (
    <div className={`fixed top-4 right-4 p-4 border rounded-lg shadow-lg ${alertClasses[alert.type]}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {alertIcons[alert.type]}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">{alert.message}</p>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={handleAction}
          disabled={isVerifying}
          className={`text-sm font-medium underline focus:outline-none ${
            isVerifying ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isVerifying ? 'Processing...' : getActionText(alert.action)}
        </button>
      </div>
    </div>
  );
};

function getActionText(action: string): string {
  switch (action) {
    case 'verify':
      return 'Verify Now';
    case 'reauthenticate':
      return 'Re-authenticate';
    case 'logout':
      return 'Log Out';
    default:
      return 'Take Action';
  }
}
