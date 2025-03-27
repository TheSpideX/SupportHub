import React from 'react';

type DashboardSkeletonProps = {
  role?: string;
};

const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ role = 'customer' }) => {
  // Determine number of stat cards based on role
  const getStatCount = () => {
    switch (role) {
      case 'admin':
      case 'technical':
      case 'team_lead':
        return 4;
      case 'support':
        return 4;
      case 'customer':
      default:
        return 2;
    }
  };

  return (
    <div className="space-y-6 animate-pulse">
      {/* Welcome section skeleton */}
      <div className="bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
        <div className="h-8 bg-gray-700 rounded-md w-2/3 mb-3"></div>
        <div className="h-4 bg-gray-700 rounded-md w-1/2"></div>
      </div>
      
      {/* Stats skeleton */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${getStatCount() > 2 ? 'lg:grid-cols-4' : ''} gap-6`}>
        {Array(getStatCount()).fill(0).map((_, index) => (
          <div key={index} className="bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg overflow-hidden border border-gray-700/50">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gray-700 p-3 rounded-lg h-10 w-10"></div>
                <div className="bg-gray-700 h-6 w-20 rounded-full"></div>
              </div>
              <div className="h-4 bg-gray-700 rounded-md w-1/3 mb-2"></div>
              <div className="h-8 bg-gray-700 rounded-md w-1/4"></div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg overflow-hidden border border-gray-700/50">
          <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
            <div className="h-6 bg-gray-700 rounded-md w-1/4"></div>
            <div className="h-6 bg-gray-700 rounded-md w-1/6"></div>
          </div>
          <div className="p-6">
            <div className="h-40 bg-gray-700 rounded-md w-full"></div>
          </div>
        </div>
        <div className="bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg overflow-hidden border border-gray-700/50">
          <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
            <div className="h-6 bg-gray-700 rounded-md w-1/3"></div>
            <div className="h-6 bg-gray-700 rounded-md w-8 rounded-full"></div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Array(3).fill(0).map((_, index) => (
                <div key={index} className="h-16 bg-gray-700 rounded-md w-full"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;