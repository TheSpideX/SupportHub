import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Signal, SignalHigh, SignalLow } from 'lucide-react';
import { serverStatusService, ServerStatus } from '@/services/server-status.service';

export const ServerStatusIndicator = () => {
  // Initialize with current status from service
  const [status, setStatus] = useState<'online' | 'degraded' | 'offline'>(
    serverStatusService.status.status || 'offline'
  );
  const [latency, setLatency] = useState<number | null>(
    serverStatusService.status.latency
  );
  
  useEffect(() => {
    // Force an immediate status check when component mounts
    serverStatusService.checkServerStatus().then(newStatus => {
      setStatus(newStatus.status);
      setLatency(newStatus.latency);
    });
    
    // Subscribe to status changes
    const handleStatusChange = (newStatus: ServerStatus) => {
      console.log('Status change detected:', newStatus);
      setStatus(newStatus.status);
      setLatency(newStatus.latency);
    };
    
    // Subscribe to status changes
    serverStatusService.events.on('statusChange', handleStatusChange);
    
    // Clean up
    return () => {
      serverStatusService.events.off('statusChange', handleStatusChange);
    };
  }, []);
  
  if (process.env.NODE_ENV === 'production') return null;
  
  const getStatusIcon = () => {
    switch (status) {
      case 'online':
        return <SignalHigh size={14} className="text-emerald-400" />;
      case 'degraded':
        return <SignalLow size={14} className="text-amber-400" />;
      case 'offline':
        return <Signal size={14} className="text-red-400" />;
    }
  };
  
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30';
      case 'degraded':
        return 'from-amber-500/20 to-amber-600/20 border-amber-500/30';
      case 'offline':
        return 'from-red-500/20 to-red-600/20 border-red-500/30';
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed top-3 right-3 z-50 flex items-center gap-1.5 
                 text-xs px-2.5 py-1.5 rounded-full backdrop-blur-md
                 bg-gradient-to-r ${getStatusColor()}
                 border shadow-lg`}
    >
      {getStatusIcon()}
      <span className="font-medium text-gray-200">
        {status === 'online' && 'Connected'}
        {status === 'degraded' && 'Slow'}
        {status === 'offline' && 'Offline'}
      </span>
      {latency && (
        <span className="text-gray-400 text-[10px]">
          {latency}ms
        </span>
      )}
    </motion.div>
  );
};
// Remove the duplicate ServerStatusService class from this file
// Just export the service for backward compatibility
export { serverStatusService };
