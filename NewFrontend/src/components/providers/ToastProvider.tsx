import React, { createContext, useContext, useState, useEffect } from 'react';
import { ToastContainer } from '../ui/ToastContainer';

interface ToastProps {
  title: string;
  description?: string;
  status: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  isClosable?: boolean;
}

interface ToastState extends ToastProps {
  id: string;
  visible: boolean;
}

interface ToastContextType {
  showToast: (props: ToastProps) => string;
  hideToast: (id: string) => void;
  toast: (props: ToastProps) => string;
}

// Create context with default values
const ToastContext = createContext<ToastContextType>({
  showToast: () => '',
  hideToast: () => {},
  toast: () => '',
});

// Custom hook to use the toast context
export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = (props: ToastProps) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastState = {
      ...props,
      id,
      visible: true,
      duration: props.duration || 5000,
      isClosable: props.isClosable !== false,
    };

    setToasts((prevToasts) => [...prevToasts, toast]);

    // Auto-hide toast after duration
    setTimeout(() => {
      hideToast(id);
    }, toast.duration);

    return id;
  };

  const hideToast = (id: string) => {
    setToasts((prevToasts) =>
      prevToasts.map((toast) =>
        toast.id === id ? { ...toast, visible: false } : toast
      )
    );

    // Remove toast from state after animation
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
    }, 300);
  };
  
  // Function overload to support direct props passing
  const toast = (props: ToastProps) => {
    return showToast(props);
  };
  
  // Add helper methods for common toast types
  toast.success = (message: string, options?: Partial<Omit<ToastProps, 'title' | 'status'>>) => {
    return showToast({
      title: 'Success',
      description: message,
      status: 'success',
      ...options
    });
  };
  
  toast.error = (message: string, options?: Partial<Omit<ToastProps, 'title' | 'status'>>) => {
    return showToast({
      title: 'Error',
      description: message,
      status: 'error',
      ...options
    });
  };
  
  toast.warning = (message: string, options?: Partial<Omit<ToastProps, 'title' | 'status'>>) => {
    return showToast({
      title: 'Warning',
      description: message,
      status: 'warning',
      ...options
    });
  };
  
  toast.info = (message: string, options?: Partial<Omit<ToastProps, 'title' | 'status'>>) => {
    return showToast({
      title: 'Info',
      description: message,
      status: 'info',
      ...options
    });
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast, toast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
