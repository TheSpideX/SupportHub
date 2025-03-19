import * as React from 'react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { getAuthServices } from '@/features/auth/services';

// Simple Button component
const Button = ({ 
  children, 
  variant = 'default', 
  size = 'md', 
  disabled = false, 
  onClick 
}: {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}) => {
  const baseClasses = "rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantClasses = {
    default: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    primary: "bg-blue-600 text-white hover:bg-blue-700"
  };
  const sizeClasses = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

// Simple Tooltip component
const Tooltip = ({ 
  children, 
  content 
}: {
  children: React.ReactNode;
  content: string;
}) => {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block">
      <div 
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </div>
      {show && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded shadow-lg whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export const DashboardPage = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleTokenRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Get the TokenService instance from auth services
      const { tokenService } = getAuthServices();
      
      // Use the TokenService's refreshToken method
      const success = await tokenService.refreshToken();
      
      if (success) {
        toast.success('Authentication tokens refreshed successfully');
      } else {
        toast.error('Token refresh failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh tokens');
      console.error('Token refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Tooltip content="Manually refresh authentication tokens">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleTokenRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Auth'}
          </Button>
        </Tooltip>
      </div>
      
      {/* Rest of your dashboard content */}
    </div>
  );
};
