export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
};

// Fix: Convert to a standalone function instead of a method
export const showErrorFeedback = (error: AppError): void => {
  try {
    // Use toast from react-hot-toast instead of ToastService
    import('react-hot-toast').then(toast => {
      toast.error(error.message || 'An unexpected error occurred');
    }).catch(() => {
      console.error('Failed to show error toast:', error.message);
    });
  } catch (e) {
    console.error('Error showing feedback:', e);
  }
}
