import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaExclamationTriangle, FaInfoCircle, FaWifi } from 'react-icons/fa';
import { Button } from '@/components/ui/buttons/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { RateLimitAlert } from '../RateLimitAlert/RateLimitAlert';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter/PasswordStrengthMeter';
import { useAuth } from '../../hooks/useAuth';
import { useSession } from '../../hooks/useSession';
import { securityService } from '../../services/security.service';
import { loginSchema } from '../../services/validation.service';
import { Logger } from '@/utils/logger';
import { getErrorMessage } from '@/utils/error.utils';
import { createAuthError, AuthError } from '../../errors/auth-error';
import type { LoginFormData } from '../../types';
import axios from 'axios';
import { serverStatusService, type ServerStatus } from '@/services/server-status.service';

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  isLoading: boolean;
}

const COMPONENT = 'LoginForm';

const isOffline = !navigator.onLine;

// Create logger instance
const logger = new Logger(COMPONENT);

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading }) => {
  // Form state management with React Hook Form
  const { register, handleSubmit, formState: { errors }, setError, clearErrors, getValues, setValue } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    }
  });

  // State management
  const [showPassword, setShowPassword] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'slow'>('online');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [securityInfo, setSecurityInfo] = useState<any>(null);
  const [lastLoginInfo, setLastLoginInfo] = useState<any>(null);
  const [rememberMeChecked, setRememberMeChecked] = useState(false);
  const submitAttemptRef = useRef(0);
  const navigate = useNavigate();
  const { getLastLoginInfo } = useSession();

  // Check server status on mount
  useEffect(() => {
    // Use the serverStatusService instead of direct checks
    const handleStatusChange = (status: ServerStatus) => {
      setServerOnline(status.isOnline);
      setConnectionStatus(status.status === 'degraded' ? 'slow' : status.status);
    };
    
    // Subscribe to status changes
    serverStatusService.events.on('statusChange', handleStatusChange);
    
    // Initial state
    handleStatusChange(serverStatusService.status);
    
    // Clean up
    return () => {
      serverStatusService.events.off('statusChange', handleStatusChange);
    };
  }, []);

  // Get last login info
  useEffect(() => {
    const fetchLastLoginInfo = async () => {
      try {
        // Check if there's any token or session data first
        const hasExistingSession = await tokenService.hasTokens();
        
        if (!hasExistingSession) {
          // First-time user or cleared storage - no need to fetch login info
          return;
        }
        
        const info = await getLastLoginInfo();
        if (info) {
          setLastLoginInfo(info);
        }
      } catch (error) {
        // Log with reduced severity since this is expected for new users
        logger.debug('No previous login information available', {
          component: COMPONENT
        });
      }
    };
    
    fetchLastLoginInfo();
  }, [getLastLoginInfo]);

  // Get device security info
  useEffect(() => {
    const getSecurityInfo = async () => {
      try {
        const info = await securityService.getDeviceInfo();
        setSecurityInfo(info);
      } catch (error) {
        logger.error('Failed to get device info', {
          component: COMPONENT,
          error: getErrorMessage(error)
        });
      }
    };
    
    getSecurityInfo();
  }, []);

  // Form submission handler
  const handleFormSubmit = async (data: LoginFormData) => {
    submitAttemptRef.current += 1;
    const currentAttempt = submitAttemptRef.current;
    
    try {
      // Clear previous errors
      clearErrors();
      
      // Log the attempt with more details
      logger.debug('Login form submission attempt', {
        component: COMPONENT,
        action: 'handleFormSubmit',
        hasEmail: !!data.email,
        hasPassword: !!data.password,
        securityInfo: !!securityInfo
      });
      
      // Check if security info is available
      if (!securityInfo) {
        // Try to get security info again if it's missing
        try {
          const info = await securityService.getDeviceInfo();
          setSecurityInfo(info);
          logger.debug('Retrieved security info on submit', {
            component: COMPONENT,
            hasInfo: !!info
          });
        } catch (secError) {
          logger.error('Failed to get device info on submit', {
            component: COMPONENT,
            error: getErrorMessage(secError)
          });
          // Continue with null security info
        }
      }
      
      // Add security context to login data
      const enhancedData = {
        ...data,
        securityContext: securityInfo || {} // Provide empty object if null
      };
      
      // Submit the form
      logger.debug('Calling onSubmit handler', {
        component: COMPONENT,
        hasSecurityContext: !!enhancedData.securityContext
      });
      
      // Ensure onSubmit is properly awaited
      if (typeof onSubmit === 'function') {
        await onSubmit(enhancedData);
      } else {
        throw new Error('onSubmit handler is not a function');
      }
      
      // Reset failed attempts on success
      setFailedAttempts(0);
    } catch (error) {
      // Only process if this is still the latest submission attempt
      if (currentAttempt !== submitAttemptRef.current) return;
      
      setFailedAttempts(prev => prev + 1);
      
      // Log detailed error information
      logger.error('Form submission error', {
        component: COMPONENT,
        action: 'handleFormSubmit',
        errorType: error?.constructor?.name || typeof error,
        errorMessage: getErrorMessage(error),
        isAxiosError: axios.isAxiosError(error),
        hasResponse: !!error?.response,
        stack: error?.stack
      });
      
      // Handle specific error types
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          // Network error
          toast.error('Network error. Please check your connection and try again.');
          setConnectionStatus('offline');
        } else {
          // Server error
          const status = error.response.status;
          const errorData = error.response.data;
          
          if (status === 429) {
            // Rate limiting
            handleRateLimitError(errorData);
          } else if (status === 401) {
            // Authentication error
            setError('password', { 
              type: 'manual', 
              message: 'Invalid email or password' 
            });
          } else {
            // Other server errors
            handleAuthError(error);
          }
        }
      } else {
        // Generic error handling
        toast.error(getErrorMessage(error));
        logger.error('Login submission failed', {
          component: COMPONENT,
          action: 'handleFormSubmit',
          error: getErrorMessage(error)
        });
      }
      
      // Auto-retry for network errors
      if (!serverOnline && failedAttempts < 2) {
        handleAutoRetry();
      }
    }
  };

  // Handle rate limit errors
  const handleRateLimitError = (errorData) => {
    let message = 'Too many login attempts. Please try again later.';
    
    // Extract remaining time if available
    if (errorData?.error?.details?.remainingTime) {
      const remainingSeconds = errorData.error.details.remainingTime;
      const minutes = Math.ceil(remainingSeconds / 60);
      message = `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    } else if (errorData?.message) {
      message = errorData.message;
    }
    
    toast.error(message, { duration: 5000 });
    logger.warn('Rate limit exceeded', {
      component: COMPONENT,
      action: 'handleFormSubmit',
      details: errorData
    });
  };

  // Auto-retry mechanism for network errors
  const handleAutoRetry = () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    toast.loading('Retrying connection...', { id: 'retry-toast' });
    
    setTimeout(() => {
      setIsRetrying(false);
      toast.dismiss('retry-toast');
      
      // Retry submission
      const values = getValues();
      if (values.email && values.password) {
        handleSubmit(handleFormSubmit)();
      }
    }, 3000);
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  // Password input focus handler
  const handlePasswordFocus = () => {
    // Clear password error when user focuses on the field
    if (errors.password) {
      clearErrors('password');
    }
  };

  // Render connection status indicator
  const renderConnectionStatus = () => {
    // Don't show duplicate status since it's already in the right corner
    return null;
  };

  // Render last login info
  const renderLastLoginInfo = () => {
    if (!lastLoginInfo) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs text-gray-400 flex items-center gap-2 mt-2"
      >
        <FaInfoCircle className="flex-shrink-0" />
        <span>
          Last login: {new Date(lastLoginInfo.timestamp).toLocaleString()} 
          {lastLoginInfo.location && ` from ${lastLoginInfo.location}`}
        </span>
      </motion.div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-md p-8 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/[0.08]"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3 mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-3">
          Welcome Back!
        </h1>
        <p className="text-gray-300 text-lg">
          Access your support dashboard
        </p>
      </motion.div>

      {isOffline && (
        <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded-md text-sm">
          <p className="flex items-center">
            <span className="mr-2">⚠️</span>
            You are currently offline. You can still login if you've previously logged in on this device.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <RateLimitAlert />
        {renderConnectionStatus()}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FaEnvelope className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                className={`w-full pl-12 pr-4 py-2 bg-white/[0.05] border ${
                  errors.email ? 'border-red-500' : 'border-white/10'
                } rounded-lg text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                placeholder="john@example.com"
              />
            </div>
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-sm text-red-500"
              >
                {errors.email.message}
              </motion.p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FaLock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                onFocus={handlePasswordFocus}
                className={`w-full pl-12 pr-12 py-2 bg-white/[0.05] border ${
                  errors.password ? 'border-red-500' : 'border-white/10'
                } rounded-lg text-white placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 
                         hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-sm text-red-500"
              >
                {errors.password.message}
              </motion.p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Checkbox
            id="rememberMe"
            checked={rememberMeChecked}
            label="Remember me"
            onChange={(e) => {
              // Update local state
              setRememberMeChecked(e.target.checked);
              
              // Update form value manually
              setValue('rememberMe', e.target.checked);
            }}
          />
          
          <Link
            to="/auth/forgot-password"
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {renderLastLoginInfo()}

        <Button
          type="submit"
          className="w-full px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 
                     hover:from-primary-600 hover:to-primary-700
                     text-white font-medium rounded-lg
                     transform transition-all duration-200
                     hover:scale-[1.02] active:scale-[0.98]
                     min-h-[42px]"
          disabled={isLoading}
        >
          <div className="flex items-center justify-center">
            {isLoading ? (
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="inline-block">Sign In</span>
            )}
          </div>
        </Button>

        <div className="mt-4 text-center">
          <p className="text-gray-400">
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-primary-400 hover:text-primary-300 transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </motion.div>
  );
};
