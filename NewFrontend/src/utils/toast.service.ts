import { toast, Toast, ToastOptions } from 'react-hot-toast';

// Standardized toast service to replace both react-hot-toast and react-toastify direct usage
export class ToastService {
  private static instance: ToastService;
  
  private constructor() {}
  
  public static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService();
    }
    return ToastService.instance;
  }
  
  success(message: string, options?: ToastOptions): Toast {
    return toast.success(message, options);
  }
  
  error(message: string, options?: ToastOptions): Toast {
    return toast.error(message, options);
  }
  
  info(message: string, options?: ToastOptions): Toast {
    return toast(message, {
      icon: 'ℹ️',
      ...options
    });
  }
  
  warning(message: string, options?: ToastOptions): Toast {
    return toast(message, {
      icon: '⚠️',
      ...options
    });
  }
  
  loading(message: string, options?: ToastOptions): Toast {
    return toast.loading(message, options);
  }
  
  dismiss(toastId?: string): void {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }
  
  custom(message: string, options?: ToastOptions): Toast {
    return toast(message, options);
  }
}

export const toastService = ToastService.getInstance();