import React from 'react';
import { motion } from 'framer-motion';

type StatCardProps = {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  color?: string;
  gradient?: string;
  variant?: 'default' | 'gradient' | 'outline';
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color = 'bg-blue-500',
  gradient = 'from-blue-500 to-blue-600',
  variant = 'default'
}) => {
  // Different card styles based on variant
  if (variant === 'gradient') {
    return (
      <motion.div 
        className={`bg-gradient-to-r ${gradient} rounded-lg shadow-sm overflow-hidden`}
        whileHover={{ y: -2, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
        transition={{ duration: 0.2 }}
      >
        <div className="px-6 py-4">
          <div className="flex items-center">
            <Icon className="h-8 w-8 text-white" />
            <h3 className="ml-3 text-lg font-medium text-white">{title}</h3>
          </div>
        </div>
        <div className="px-6 py-4 bg-white/10 backdrop-blur-sm">
          <div className="text-3xl font-bold text-white">{value}</div>
          <p className="text-sm text-white/80">{change}</p>
        </div>
      </motion.div>
    );
  }
  
  if (variant === 'outline') {
    return (
      <motion.div 
        className="bg-transparent border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden"
        whileHover={{ y: -2, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
        transition={{ duration: 0.2 }}
      >
        <div className="px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
          <div className={`${color} p-2 rounded-lg`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{value}</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{change}</p>
        </div>
      </motion.div>
    );
  }
  
  // Default variant
  return (
    <motion.div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
      whileHover={{ y: -2, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
      transition={{ duration: 0.2 }}
    >
      <div className={`${color} px-4 py-3`}>
        <div className="flex items-center">
          <Icon className="h-6 w-6 text-white" />
          <h3 className="ml-2 text-sm font-medium text-white">{title}</h3>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{change}</p>
      </div>
    </motion.div>
  );
};

export default StatCard;