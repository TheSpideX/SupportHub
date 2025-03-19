import { useState, useEffect } from 'react';
import { authMonitor } from '../services/AuthMonitor';

export const useAuthMonitor = () => {
  const [healthStatus, setHealthStatus] = useState(authMonitor.getHealthStatus());
  const [isHealthy, setIsHealthy] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    // Start monitoring if not already started
    authMonitor.startMonitoring();
    
    // Set up polling to get the latest health status
    const intervalId = setInterval(() => {
      const status = authMonitor.getHealthStatus();
      setHealthStatus(status);
      setIsHealthy(status.tokenServiceHealthy && status.sessionServiceHealthy);
      setErrors(status.errors || []);
    }, 5000); // Update every 5 seconds
    
    // Initial check
    const status = authMonitor.getHealthStatus();
    setHealthStatus(status);
    setIsHealthy(status.tokenServiceHealthy && status.sessionServiceHealthy);
    setErrors(status.errors || []);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return { healthStatus, isHealthy, errors };
}
