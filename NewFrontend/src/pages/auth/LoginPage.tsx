import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm';
import { SocialLogin } from '@/features/auth/components/SocialLogin/SocialLogin';
import { AuthBackground } from '@/features/auth/components/AuthBackground/AuthBackground';
import { FaShieldAlt, FaUsersCog, FaChartLine, FaRocket } from 'react-icons/fa';
import type { LoginFormData } from '@/features/auth/components/LoginForm/LoginForm.types';
import { Logger } from '@/utils/logger';
import toast from "react-hot-toast";
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { RootState } from '@/store'; // Changed from '@/store/store' to '@/store'
// Import the services from our centralized auth system
import { getSecurityService, getTokenService } from '@/features/auth/services';

const COMPONENT = 'LoginPage';
const logger = new Logger(COMPONENT);

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [activeFeature, setActiveFeature] = useState<string | number>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  
  // Get auth state directly from Redux store for comparison
  const authState = useSelector((state: RootState) => state.auth);
  
  // Define 'from' properly - get the redirect path or default to dashboard
  const from = location.state?.from?.pathname || '/dashboard';
  
  const { login, isAuthenticated } = useAuth();
  
  // Log initial state with actual values
  logger.info('LoginPage rendered with detailed auth state', {
    component: COMPONENT,
    hookIsAuthenticated: isAuthenticated, // from useAuth hook
    reduxIsAuthenticated: authState.isAuthenticated, // directly from Redux
    reduxIsInitialized: authState.isInitialized,
    reduxUser: authState.user ? 'exists' : 'null',
    from,
    locationState: JSON.stringify(location.state)
  });
  
  // Add effect to redirect if already authenticated
  useEffect(() => {
    logger.info('LoginPage authentication check effect with detailed state', {
      component: COMPONENT,
      hookIsAuthenticated: isAuthenticated, // from useAuth hook
      reduxIsAuthenticated: authState.isAuthenticated, // directly from Redux
      reduxIsInitialized: authState.isInitialized,
      from
    });
    
    if (isAuthenticated) {
      logger.info('User authenticated, redirecting from login page', {
        component: COMPONENT,
        redirectTo: from
      });
      navigate(from, { replace: true });
    } else if (authState.isAuthenticated) {
      // Check if there's a mismatch between hook and Redux state
      logger.warn('Auth state mismatch detected - Redux shows authenticated but hook does not', {
        component: COMPONENT
      });
      // Try forcing navigation based on Redux state
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authState.isAuthenticated, navigate, from]);
  
  // Get services from our centralized auth system instead of creating new instances
  const tokenService = getTokenService();
  const securityService = getSecurityService();
  
  // Get security info on component mount
  useEffect(() => {
    const getSecurityInfo = async () => {
      try {
        // Use the correct method from your SecurityService
        const info = await securityService.getDeviceFingerprint();
        setDeviceInfo(info);
      } catch (error) {
        logger.error('Failed to get security info', { 
          component: COMPONENT, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    };
    
    getSecurityInfo();
  }, [securityService]);
  
  // Handle form submission
  const handleSubmit = async (values: LoginFormData) => {
    logger.info('Login form submitted', { component: COMPONENT, email: values.email ? '***@***' : 'undefined' });
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Get device fingerprint if available
      logger.debug('Getting device fingerprint', { component: COMPONENT });
      let fingerprint = deviceInfo || 
        `${navigator.userAgent}|${navigator.language}|${new Date().getTimezoneOffset()}|${window.screen.width}x${window.screen.height}`;
      
      // Add security context to login request
      logger.debug('Preparing login request with security context', { component: COMPONENT });
      const loginRequest = {
        ...values,
        deviceInfo: {
          fingerprint,
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: {} // Add empty location object to match schema
        }
      };
      
      // Call login function with enhanced request
      logger.debug('Calling login function', { component: COMPONENT });
      const result = await login(loginRequest);
      
      // Check if login was successful
      if (result) {
        logger.info('Login successful, navigating to:', { component: COMPONENT, destination: from });
        // Force navigation with a slight delay to ensure state updates are processed
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 100);
      } else {
        // Handle case where login returns false but doesn't throw an error
        logger.warn('Login returned null without throwing error', { component: COMPONENT });
        setError('Login failed. Please check your credentials and try again.');
      }
    } catch (error) {
      // Handle login error
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      logger.error('Login failed', { 
        component: COMPONENT, 
        error: errorMessage
      });
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
      logger.debug('Login form submission completed', { component: COMPONENT });
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
                                   ${activeFeature === index.toString() ? 'bg-gray-800' : 'bg-gray-900/60'}
                                   hover:bg-gray-800 transition-all duration-300`}
                          onClick={() => setActiveFeature(index.toString())}
                          onMouseEnter={() => setActiveFeature(index.toString())}
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
                  <LoginForm onSubmit={handleSubmit} isLoading={isSubmitting} />
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
