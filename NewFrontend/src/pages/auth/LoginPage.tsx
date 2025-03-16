import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm';
import { SocialLogin } from '@/features/auth/components/SocialLogin/SocialLogin';
import { AuthBackground } from '@/features/auth/components/AuthBackground/AuthBackground';
import { FaShieldAlt, FaUsersCog, FaChartLine, FaRocket } from 'react-icons/fa';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { LoginFormData } from '@/features/auth/types';
import { Logger } from '@/utils/logger';
import { getErrorMessage } from "@/utils/error.utils";
import { handleAuthError } from '@/features/auth/utils/auth.utils';
import { createAuthError } from '@/features/auth/utils/auth-error';
import { authService } from '@/features/auth/services/auth.service';
import { securityService } from '@/features/auth/services/security.service';
import toast from "react-hot-toast";
import { useDispatch } from 'react-redux';
import { setCredentials } from '@/features/auth/store/authSlice';
import { AuthApi } from '@/features/auth/api/auth-api';

const COMPONENT = 'LoginPage';
const logger = new Logger(COMPONENT);

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      logger.debug('User already authenticated, redirecting', {
        component: COMPONENT,
        action: 'checkAuth'
      });
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Add useEffect to ensure CSRF token on page load with better error handling
  useEffect(() => {
    const setupCsrf = async () => {
      try {
        await AuthApi.ensureCsrfToken(true);
        logger.debug('CSRF token successfully retrieved', { component: COMPONENT });
      } catch (error) {
        logger.warn('Failed to get CSRF token, continuing with login page', {
          component: COMPONENT,
          error: getErrorMessage(error)
        });
      }
    };
    
    setupCsrf();
  }, []);

  useEffect(() => {
    const testCsrf = async () => {
      try {
        // Test the CSRF endpoint directly
        logger.debug('Testing CSRF endpoint', { component: COMPONENT });
        await AuthApi.testCsrfEndpoint();
        
        // Then try the regular CSRF token fetch
        const token = await AuthApi.ensureCsrfToken(true);
        logger.debug('CSRF token fetch result', { 
          component: COMPONENT,
          hasToken: !!token
        });
      } catch (error) {
        logger.error('CSRF testing failed', {
          component: COMPONENT,
          error: error.message
        });
      }
    };
    
    testCsrf();
  }, []);

  const onSubmit = async (formData: LoginFormData) => {
    setIsLoading(true);
    
    try {
      // Get device info for security tracking
      const deviceInfo = await securityService.getDeviceInfo();
      logger.debug('Device info obtained', { component: COMPONENT });
      
      // Prepare login request
      const credentials = {
        email: formData.email,
        password: formData.password,
        deviceInfo,
        rememberMe: formData.rememberMe
      };
      
      logger.debug('Attempting login', { 
        component: COMPONENT, 
        email: formData.email,
        hasDeviceInfo: !!deviceInfo
      });
      
      // Add this console.log to verify the call is being made
      console.log('About to call authService.login with:', {
        email: formData.email,
        hasPassword: !!formData.password,
        hasDeviceInfo: !!deviceInfo
      });
      
      // Attempt login
      const response = await authService.login(credentials);
      
      console.log('Login response received:', response);
      
      logger.debug('Login API response received', { 
        component: COMPONENT,
        success: response?.success,
        hasUser: !!response?.user,
        hasTokens: !!response?.tokens,
        requiresTwoFactor: !!response?.requiresTwoFactor,
        responseKeys: response ? Object.keys(response) : []
      });
      
      // Handle successful login
      if (response && response.success) {
        logger.debug('Login successful, processing response', { component: COMPONENT });
        
        // Store token expiration if available
        if (response.tokens && response.tokens.expiresIn) {
          logger.debug('Storing token expiration', { 
            component: COMPONENT,
            expiresIn: response.tokens.expiresIn
          });
          authService.storeTokenExpiration(response.tokens.expiresIn, formData.rememberMe);
        } else {
          logger.debug('No token expiration to store', { component: COMPONENT });
        }
        
        // Redirect to appropriate page
        if (response.requiresTwoFactor) {
          logger.debug('Two-factor authentication required', { component: COMPONENT });
          navigate('/auth/two-factor');
        } else {
          logger.debug('Setting authentication state', { component: COMPONENT });
          // Set authentication state
          try {
            // Create safe user and tokens objects
            const user = response.user || {};
            const tokens = response.tokens || {};
            
            // Dispatch credentials to Redux store
            dispatch(setCredentials({
              user,
              tokens
            }));
            
            logger.debug('Authentication state set', { component: COMPONENT });
            
            // Navigate to destination
            const redirectPath = location?.state?.from?.pathname || '/dashboard';
            logger.debug('Navigating to destination', { 
              component: COMPONENT,
              destination: redirectPath
            });
            navigate(redirectPath);
          } catch (dispatchError) {
            logger.error('Error during state update', {
              component: COMPONENT,
              error: dispatchError
            });
            throw dispatchError;
          }
        }
      } else {
        // Handle unexpected response format
        logger.error('Invalid login response format', {
          component: COMPONENT,
          hasSuccess: response ? !!response.success : false,
          response: JSON.stringify(response)
        });
        toast.error('Login failed: Invalid server response');
      }
    } catch (error) {
      // Handle specific error types
      logger.error('Login error caught', {
        component: COMPONENT,
        error
      });
      
      // Check if error is an object before accessing properties
      if (error && typeof error === 'object') {
        if (error.code === 'RATE_LIMITED') {
          handleRateLimitError(error);
        } else if (error.code === 'INVALID_CREDENTIALS') {
          toast.error('Invalid email or password');
        } else {
          // Generic error handling
          toast.error('Login failed: ' + (error.message || 'Unknown error'));
          
          // Log detailed error information
          logger.error('Login submission failed', {
            component: COMPONENT,
            error
          });
        }
      } else {
        // Handle case where error is not an object
        toast.error('Login failed: Unknown error');
        logger.error('Login submission failed with non-object error', {
          component: COMPONENT,
          action: 'onSubmit',
          errorType: typeof error,
          error: String(error)
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    toast.error(`${provider} login coming soon!`, {
      icon: '🚧',
      duration: 2000
    });
  };

  const features = [
    {
      icon: FaRocket,
      title: 'Get Started Quickly',
      description: 'Set up your workspace in minutes, not hours',
      gradient: 'from-blue-400 to-indigo-500',
    },
    {
      icon: FaShieldAlt,
      title: 'Enterprise Security',
      description: 'Bank-grade security for your business data',
      gradient: 'from-green-400 to-teal-500',
    },
    {
      icon: FaUsersCog,
      title: 'Team Collaboration',
      description: 'Work seamlessly with your team',
      gradient: 'from-orange-400 to-rose-500',
    },
    {
      icon: FaChartLine,
      title: 'Advanced Analytics',
      description: 'Make data-driven decisions',
      gradient: 'from-violet-400 to-purple-500',
    },
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <AuthBackground />

      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary-600/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-secondary-600/20 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-[1000px] relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gray-900/80 rounded-2xl border border-gray-700 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/30 to-secondary-900/30" />
          
          <div className="grid lg:grid-cols-2 relative">
            {/* Left Side - Features */}
            <div className="p-8 lg:p-10 bg-gray-950/50 flex items-center">
              <div className="w-full">
                <motion.div 
                  initial={false}
                  animate={{ opacity: 1 }}
                  className="space-y-8" // Added space between main sections
                >
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6" // Added space between logo and description
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                        <span className="text-xl font-bold text-white">SH</span>
                      </div>
                      <h1 className="text-3xl font-bold text-white">Support Hub</h1>
                    </div>
                    <p className="text-gray-200 text-base leading-relaxed">
                      Access your dashboard and manage your team efficiently
                    </p>
                  </motion.div>

                  <div className="space-y-4"> {/* Space between feature cards */}
                    <AnimatePresence mode="wait">
                      {features.map((feature, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ 
                            opacity: activeFeature === index ? 1 : 0.7,
                            x: 0,
                            scale: activeFeature === index ? 1 : 0.98
                          }}
                          transition={{ duration: 0.3 }}
                          className={`flex items-start space-x-4 p-5 rounded-xl 
                                   border border-gray-700 cursor-pointer
                                   ${activeFeature === index ? 'bg-gray-800' : 'bg-gray-900/60'}
                                   hover:bg-gray-800 transition-all duration-300
                                   group`} // Added group for hover effects
                          onClick={() => setActiveFeature(index)}
                        >
                          <div className={`p-2.5 bg-gradient-to-br ${feature.gradient} rounded-lg 
                                        shadow-lg transform-gpu transition-transform 
                                        group-hover:scale-110`}>
                            <feature.icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="space-y-1.5"> {/* Added space between title and description */}
                            <h3 className="text-white font-semibold">{feature.title}</h3>
                            <p className="text-gray-300 text-sm leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="lg:w-full p-8 lg:p-10 bg-gray-900/80 backdrop-blur-lg">
              <div className="w-full max-w-sm mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gray-800/50 p-6 rounded-xl border border-gray-700"
                >
                  <LoginForm onSubmit={onSubmit} isLoading={isLoading} />
                  <div className="mt-6">
                    <SocialLogin onSocialLogin={handleSocialLogin} />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
