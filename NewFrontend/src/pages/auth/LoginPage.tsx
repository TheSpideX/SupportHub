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
import { useDispatch } from 'react-redux';
import { useAuth } from '@/features/auth/hooks/useAuth';
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
  const { login } = useAuth();
  
  // Get services from our centralized auth system instead of creating new instances
  const tokenService = getTokenService();
  const securityService = getSecurityService();
  
  // Get redirect path from location state or default to dashboard
  const from = location.state?.from?.pathname || "/dashboard";

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
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Get device fingerprint if available
      let fingerprint = deviceInfo || 
        `${navigator.userAgent}|${navigator.language}|${new Date().getTimezoneOffset()}|${window.screen.width}x${window.screen.height}`;
      
      // Add security context to login request
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
      await login(loginRequest);
      
      // If login successful, redirect to dashboard or requested page
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo);
      
      logger.info('Login successful', { component: COMPONENT });
    } catch (error) {
      // Handle login error
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      logger.error('Login failed', { 
        component: COMPONENT, 
        error: errorMessage
      });
    } finally {
      setIsSubmitting(false);
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
                  <LoginForm onSubmit={handleSubmit} isLoading={isLoading} />
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
