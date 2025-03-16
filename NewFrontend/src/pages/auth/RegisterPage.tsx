import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUser, FaBuilding, FaUserTie, FaRocket, FaShieldAlt, FaUsersCog, FaChartLine } from 'react-icons/fa';
import { AuthBackground } from '@/features/auth/components/AuthBackground/AuthBackground';
import { RegistrationForm } from '@/features/auth/components/RegistrationForm/RegistrationForm';
import { Link } from 'react-router-dom';

type RegistrationType = 'customer' | 'company' | 'company_employee' | null;

export const RegisterPage = () => {
  const [registrationType, setRegistrationType] = useState<RegistrationType>(null);
  const [activeFeature, setActiveFeature] = useState(0);

  const baseFeatures = [
    {
      icon: FaRocket,
      title: 'Quick Setup',
      description: 'Get your account ready in minutes',
      gradient: 'from-blue-400 to-indigo-500',
    },
    {
      icon: FaShieldAlt,
      title: 'Secure Platform',
      description: 'Enterprise-grade security protocols',
      gradient: 'from-emerald-400 to-teal-500',
    },
    {
      icon: FaUsersCog,
      title: 'Team Management',
      description: 'Efficient team collaboration tools',
      gradient: 'from-orange-400 to-rose-500',
    },
    {
      icon: FaChartLine,
      title: 'Performance Insights',
      description: 'Comprehensive analytics dashboard',
      gradient: 'from-violet-400 to-purple-500',
    },
  ];

  const enterpriseFeature = {
    icon: FaBuilding,
    title: 'Enterprise Features',
    description: 'Advanced tools for company-wide support management and team collaboration',
    gradient: 'from-purple-400 to-pink-500',
  };

  // Conditionally add enterprise feature for company registrations
  const features = useMemo(() => {
    if (registrationType === 'company' || registrationType === 'company_employee') {
      return [...baseFeatures, enterpriseFeature];
    }
    return baseFeatures;
  }, [registrationType]);

  const registrationOptions = [
    {
      type: 'customer',
      icon: FaUser,
      title: 'Customer',
      description: 'Register as an individual customer',
      gradient: 'from-blue-400 to-indigo-500',
    },
    {
      type: 'company',
      icon: FaBuilding,
      title: 'Company',
      description: 'Register your company',
      gradient: 'from-emerald-400 to-teal-500',
    },
    {
      type: 'company_employee',
      icon: FaUserTie,
      title: 'Company Employee',
      description: 'Join your company with an invite code',
      gradient: 'from-orange-400 to-rose-500',
    },
  ];

  // Add animation variants for consistent animations
  const featureCardVariants = {
    initial: { 
      opacity: 0, 
      x: -20,
      height: 0,
      marginTop: 0
    },
    animate: { 
      opacity: 1, 
      x: 0,
      height: 'auto',
      marginTop: 16,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      x: -20,
      height: 0,
      marginTop: 0,
      transition: {
        duration: 0.2,
        ease: "easeIn"
      }
    }
  };

  return (
    <motion.div 
      layout
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"
    >
      <AuthBackground />

      {/* Background elements */}
      <motion.div 
        layout
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute inset-0 overflow-hidden pointer-events-none"
      >
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary-600/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-secondary-600/20 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
      </motion.div>

      <motion.div 
        className="w-full max-w-[1000px] relative z-10"
        layout
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          layout
          transition={{ 
            duration: 0.5, ease: "easeOut" 
          }}
          className="relative bg-gray-900/80 rounded-2xl border border-gray-700 
                     shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/30 to-secondary-900/30" />
          
          <motion.div 
            className="grid lg:grid-cols-2 relative min-h-[600px]"
            layout
            transition={{ 
              duration: 0.5, ease: "easeOut" 
            }}
          >
            {/* Left Side - Features */}
            <motion.div 
              layout
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="p-8 lg:p-10 bg-gray-950/50"
            >
              <motion.div 
                layout
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-sm"
              >
                {/* Header Section */}
                <motion.div
                  layout
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">SH</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white">Support Hub</h1>
                  </div>
                  <p className="text-gray-200 text-lg leading-relaxed">
                    Join our platform and start managing your support needs
                  </p>
                </motion.div>

                {/* Features Section */}
                <motion.div 
                  layout="position"
                  className="space-y-4 relative"
                >
                  <AnimatePresence initial={false} mode="sync">
                    {features.map((feature, index) => (
                      <motion.div
                        key={`${feature.title}-${index}`}
                        variants={featureCardVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        layout
                        className={`flex items-start space-x-4 p-4 rounded-xl 
                                  border border-gray-700 cursor-pointer
                                  ${activeFeature === index ? 'bg-gray-800' : 'bg-gray-900/60'}
                                  hover:bg-gray-800 transition-colors duration-300`}
                        onClick={() => setActiveFeature(index)}
                      >
                        <div 
                          className={`p-3 bg-gradient-to-br ${feature.gradient} rounded-lg 
                                    shadow-lg transition-transform duration-200
                                    group-hover:scale-110`}
                        >
                          <feature.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <h3 className="text-white text-base font-semibold">
                            {feature.title}
                          </h3>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Right Side - Registration Options/Form */}
            <motion.div 
              className="lg:w-full p-8 lg:p-10 bg-gray-900/80 backdrop-blur-lg flex items-center justify-center"
              layout
              transition={{ 
                duration: 0.5, ease: "easeOut" 
              }}
            >
              <motion.div 
                className="w-full max-w-sm"
                layout
                transition={{ 
                  duration: 0.5, ease: "easeOut" 
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={registrationType || 'options'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-800/50 p-6 rounded-xl border border-gray-700"
                  >
                    {!registrationType ? (
                      <div className="space-y-6">
                        <div className="text-center">
                          <h2 className="text-2xl font-bold text-white mb-4">
                            Choose Account Type
                          </h2>
                        </div>
                        <div className="space-y-3">
                          {registrationOptions.map((option) => (
                            <motion.button
                              key={option.type}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setRegistrationType(option.type as RegistrationType)}
                              className="w-full p-4 bg-gray-900/60 border border-gray-700 rounded-xl 
                                       hover:bg-gray-800 transition-all group"
                            >
                              <div className="flex items-center space-x-4">
                                <div className={`p-2.5 bg-gradient-to-br ${option.gradient} rounded-lg`}>
                                  <option.icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-white font-semibold mb-1">{option.title}</h3>
                                  <p className="text-gray-300 text-sm">{option.description}</p>
                                </div>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                        
                        {/* Sign In link */}
                        <div className="text-center pt-4 border-t border-gray-700">
                          <p className="text-gray-300">
                            Already have an account?{' '}
                            <Link
                              to="/auth/login"
                              className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
                            >
                              Sign In
                            </Link>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <RegistrationForm
                        type={registrationType}
                        onBack={() => setRegistrationType(null)}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
