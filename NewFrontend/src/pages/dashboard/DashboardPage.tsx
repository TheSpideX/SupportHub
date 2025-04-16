import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { Navigate } from "react-router-dom";
import CustomerDashboard from "@/pages/dashboard/CustomerDashboard";
import EnhancedCustomerDashboard from "@/pages/dashboard/EnhancedCustomerDashboard";
import SupportDashboard from "@/pages/dashboard/SupportDashboard";
import EnhancedSupportDashboard from "@/pages/dashboard/EnhancedSupportDashboard";
import TechnicalDashboard from "@/pages/dashboard/TechnicalDashboard";
import TeamLeadDashboard from "@/pages/dashboard/TeamLeadDashboard";
import AdminDashboard from "@/pages/dashboard/AdminDashboard";
import LoadingScreen from "@/components/shared/LoadingScreen";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";

const DashboardPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log(
      "Dashboard user data:",
      user,
      "isAuthenticated:",
      isAuthenticated,
      "isLoading:",
      authLoading
    );

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

  // If not authenticated or no user, redirect to login page
  if (!isAuthenticated || !user) {
    console.log(
      "User not authenticated or undefined, redirecting to login page"
    );
    // Use the Navigate component from react-router-dom to redirect
    // This will be handled by the AuthGuard component
    return null;
  }

  // Render the appropriate dashboard based on user role
  const renderDashboard = () => {
    console.log("Rendering dashboard for role:", user.role);

    if (authLoading) {
      return <DashboardSkeleton role={user.role} />;
    }

    switch (user.role) {
      case "admin":
        return <AdminDashboard />;
      case "team_lead":
        // Redirect based on team type
        if (user.teamType === "support") {
          return <Navigate to="/team-lead-support-dashboard" replace />;
        } else if (user.teamType === "technical") {
          return <Navigate to="/team-lead-technical-dashboard" replace />;
        }
        // Fallback to generic team lead dashboard if team type is not specified
        return <TeamLeadDashboard />;
      case "technical":
        return <TechnicalDashboard />;
      case "support":
        return <Navigate to="/support-dashboard" replace />;
      case "customer":
      default:
        return <EnhancedCustomerDashboard />;
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
