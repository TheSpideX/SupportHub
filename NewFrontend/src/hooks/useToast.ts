import { useState } from 'react';

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

export const useToast = () => {
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

  return {
    toasts,
    showToast,
    hideToast,
  };
};

export default useToast;
