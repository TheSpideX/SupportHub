import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from "../../features/auth/hooks/useAuth";
import CustomerDashboard from '@/pages/dashboard/CustomerDashboard';
import SupportDashboard from '@/pages/dashboard/SupportDashboard';
import TechnicalDashboard from '@/pages/dashboard/TechnicalDashboard';
import TeamLeadDashboard from '@/pages/dashboard/TeamLeadDashboard';
import AdminDashboard from '@/pages/dashboard/AdminDashboard';
import LoadingScreen from '@/components/shared/LoadingScreen';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';

const DashboardPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    console.log('Dashboard user data:', user, 'isAuthenticated:', isAuthenticated, 'isLoading:', authLoading);
    
    // Set ready state when auth is fully loaded, regardless of user data
    if (!authLoading) {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, isAuthenticated, authLoading]);
  
  useEffect(() => {
    // Simulate loading dashboard data
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);

  // Show loading state until auth is fully initialized and we have user data
  if (authLoading || !isReady) {
    return <LoadingScreen message="Loading dashboard..." />;
  }
  
  // If not authenticated or no user, show customer dashboard as fallback
  if (!isAuthenticated || !user) {
    console.log('User not authenticated or undefined, showing customer dashboard');
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="space-y-6"
      >
        <CustomerDashboard />
      </motion.div>
    );
  }
  
  // Render the appropriate dashboard based on user role
  const renderDashboard = () => {
    console.log('Rendering dashboard for role:', user.role);
    
    if (authLoading) {
      return <DashboardSkeleton role={user.role} />;
    }
    
    switch (user.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'team_lead':
        return <TeamLeadDashboard />;
      case 'technical':
        return <TechnicalDashboard />;
      case 'support':
        return <SupportDashboard />;
      case 'customer':
      default:
        return <CustomerDashboard />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {renderDashboard()}
    </motion.div>
  );
};

export default DashboardPage;
