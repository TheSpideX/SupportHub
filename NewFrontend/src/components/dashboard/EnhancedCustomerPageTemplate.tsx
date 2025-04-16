import React, { useState } from "react";
import { motion } from "framer-motion";
import { IconType } from "react-icons";
import { FaChevronRight } from "react-icons/fa";
import { Button } from "@/components/ui/buttons/Button";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import Footer from "./Footer";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface EnhancedCustomerPageTemplateProps {
  title: string;
  description: string;
  icon: IconType;
  children: React.ReactNode;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "ghost";
    icon?: IconType;
  }[];
  breadcrumbs?: {
    label: string;
    href: string;
  }[];
}

const EnhancedCustomerPageTemplate: React.FC<
  EnhancedCustomerPageTemplateProps
> = ({
  title,
  description,
  icon: Icon,
  children,
  actions = [],
  breadcrumbs = [],
}) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Improved background elements with subtle animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <TopNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {/* Page Header */}
            <div className="mb-8">
              {/* Breadcrumbs */}
              {breadcrumbs.length > 0 && (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.href}>
                      {index > 0 && <FaChevronRight className="mx-2 h-3 w-3" />}
                      <a
                        href={crumb.href}
                        className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        {crumb.label}
                      </a>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Title and actions */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mr-4">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {title}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                      {description}
                    </p>
                  </div>
                </div>

                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action, index) => (
                      <Button
                        key={index}
                        variant={action.variant || "default"}
                        onClick={action.onClick}
                      >
                        {action.icon && (
                          <action.icon className="mr-2 h-4 w-4" />
                        )}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default EnhancedCustomerPageTemplate;
