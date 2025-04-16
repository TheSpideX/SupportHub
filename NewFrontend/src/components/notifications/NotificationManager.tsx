import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { ticketSocket } from '@/features/tickets/api/ticketSocket';

// Notification types
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error' | 'critical';
export type NotificationDisplayType = 'corner' | 'modal';

export interface NotificationAction {
  label: string;
  url?: string;
  onClick?: () => void;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  displayType: NotificationDisplayType;
  actions?: NotificationAction[];
  createdAt: Date;
  autoClose?: boolean;
  duration?: number;
}

// Corner notification component
const CornerNotification: React.FC<{
  notification: Notification;
  onDismiss: () => void;
}> = ({ notification, onDismiss }) => {
  const { title, message, severity, actions } = notification;
  
  // Auto-close notification after duration
  useEffect(() => {
    if (notification.autoClose !== false) {
      const timer = setTimeout(() => {
        onDismiss();
      }, notification.duration || 5000);
      
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);
  
  // Get icon based on severity
  const getIcon = () => {
    switch (severity) {
      case 'success':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />;
      case 'error':
      case 'critical':
        return <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />;
      case 'info':
      default:
        return <InformationCircleIcon className="h-6 w-6 text-blue-500" />;
    }
  };
  
  // Get background color based on severity
  const getBgColor = () => {
    switch (severity) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };
  
  return (
    <motion.div
      className={`rounded-lg shadow-lg border p-4 max-w-md w-full ${getBgColor()}`}
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="mt-1 text-sm text-gray-500">{message}</p>
          
          {actions && actions.length > 0 && (
            <div className="mt-3 flex space-x-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={() => {
                    if (action.onClick) {
                      action.onClick();
                    } else if (action.url) {
                      window.location.href = action.url;
                    }
                    onDismiss();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
            onClick={onDismiss}
          >
            <span className="sr-only">Close</span>
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Modal notification component
const ModalNotification: React.FC<{
  notification: Notification;
  onDismiss: () => void;
}> = ({ notification, onDismiss }) => {
  const { title, message, severity, actions } = notification;
  
  // Get icon based on severity
  const getIcon = () => {
    switch (severity) {
      case 'success':
        return <CheckCircleIcon className="h-12 w-12 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500" />;
      case 'error':
      case 'critical':
        return <ExclamationTriangleIcon className="h-12 w-12 text-red-500" />;
      case 'info':
      default:
        return <InformationCircleIcon className="h-12 w-12 text-blue-500" />;
    }
  };
  
  return (
    <Dialog open={true} onClose={() => {}} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4">
              {getIcon()}
            </div>
            
            <Dialog.Title className="text-lg font-medium text-gray-900">
              {title}
            </Dialog.Title>
            
            <Dialog.Description className="mt-2 text-sm text-gray-500">
              {message}
            </Dialog.Description>
            
            <div className="mt-6 flex space-x-3">
              {actions && actions.length > 0 ? (
                actions.map((action, index) => (
                  <button
                    key={index}
                    type="button"
                    className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={() => {
                      if (action.onClick) {
                        action.onClick();
                      } else if (action.url) {
                        window.location.href = action.url;
                      }
                      onDismiss();
                    }}
                  >
                    {action.label}
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={onDismiss}
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// Notification manager component
const NotificationManager: React.FC = () => {
  const [cornerNotifications, setCornerNotifications] = useState<Notification[]>([]);
  const [modalNotification, setModalNotification] = useState<Notification | null>(null);
  
  // Handle new notification
  const handleNewNotification = (notification: Notification) => {
    if (notification.displayType === 'modal') {
      setModalNotification(notification);
    } else {
      setCornerNotifications(prev => [...prev, notification]);
    }
  };
  
  // Dismiss corner notification
  const dismissCornerNotification = (id: string) => {
    setCornerNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  // Dismiss modal notification
  const dismissModalNotification = () => {
    setModalNotification(null);
  };
  
  // Listen for notifications from WebSocket
  useEffect(() => {
    const cleanup = ticketSocket.onNotification((data) => {
      const notification: Notification = {
        id: data._id || `notification-${Date.now()}`,
        title: data.title,
        message: data.message,
        severity: data.severity || 'info',
        displayType: data.displayType || 'corner',
        actions: data.actions,
        createdAt: new Date(data.createdAt || Date.now()),
        autoClose: data.displayType !== 'modal',
      };
      
      handleNewNotification(notification);
    });
    
    return cleanup;
  }, []);
  
  return (
    <>
      {/* Corner notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-4 max-w-md">
        <AnimatePresence>
          {cornerNotifications.map(notification => (
            <CornerNotification
              key={notification.id}
              notification={notification}
              onDismiss={() => dismissCornerNotification(notification.id)}
            />
          ))}
        </AnimatePresence>
      </div>
      
      {/* Modal notification */}
      {modalNotification && (
        <ModalNotification
          notification={modalNotification}
          onDismiss={dismissModalNotification}
        />
      )}
    </>
  );
};

export default NotificationManager;
