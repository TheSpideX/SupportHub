import React, { useEffect } from 'react';
import { ToastContainer } from './ToastContainer';
import useToast from '../../hooks/useToast';

/**
 * ToastManager component
 * This component renders the ToastContainer and manages the toasts
 */
export const ToastManager: React.FC = () => {
  const toast = useToast();
  
  // Access the toasts from the toast function
  const toasts = toast.toasts || [];
  
  return (
    <ToastContainer 
      toasts={toasts} 
      onClose={(id) => toast.hideToast(id)} 
    />
  );
};

export default ToastManager;
