import React, { useState, useEffect, useCallback } from 'react';
import { tokenService } from '../../services/token.service';
import { useAuth } from '../../hooks/useAuth';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../store/store';

export const TokenStatusMonitor: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [accessTokenExpiry, setAccessTokenExpiry] = useState<number | null>(null);
  const [refreshTokenExpiry, setRefreshTokenExpiry] = useState<number | null>(null);
  const [testMode, setTestMode] = useState(false);
  
  // Get session expiry from Redux store
  const sessionExpiry = useSelector((state: RootState) => state.auth.sessionExpiry);
  
  // Test function to set short-lived tokens for testing
  const setTestTokens = useCallback(async () => {
    try {
      // Set access token to expire in 30 seconds
      const accessExpiry = Date.now() + 30000;
      localStorage.setItem('access_token_expiry', accessExpiry.toString());
      
      // Set refresh token to expire in 60 seconds
      const refreshExpiry = Date.now() + 60000;
      localStorage.setItem('refresh_token_expiry', refreshExpiry.toString());
      
      console.log('Test tokens set with short expiry times');
      return { accessExpiry, refreshExpiry };
    } catch (error) {
      console.error('Error setting test tokens:', error);
      return null;
    }
  }, []);
  
  // Toggle test mode
  const toggleTestMode = useCallback(async () => {
    const newTestMode = !testMode;
    setTestMode(newTestMode);
    
    if (newTestMode) {
      const testTokenData = await setTestTokens();
      if (testTokenData) {
        setAccessTokenExpiry(testTokenData.accessExpiry);
        setRefreshTokenExpiry(testTokenData.refreshExpiry);
      }
    } else {
      // Revert to real token expiry times
      const accessExpiry = await tokenService.getTokenExpiry();
      setAccessTokenExpiry(accessExpiry);
      
      const refreshExpiry = await tokenService.getRefreshTokenExpiry();
      setRefreshTokenExpiry(refreshExpiry);
    }
  }, [testMode, setTestTokens]);
  
  // Add a manual refresh function
  const forceTokenRefresh = useCallback(async () => {
    try {
      const success = await tokenService.refreshTokens();
      if (success) {
        // Update the expiry times after refresh
        const accessExpiry = await tokenService.getTokenExpiry();
        setAccessTokenExpiry(accessExpiry);
        
        const refreshExpiry = await tokenService.getRefreshTokenExpiry();
        setRefreshTokenExpiry(refreshExpiry);
        
        console.log('Tokens refreshed manually');
      } else {
        console.error('Manual token refresh failed');
      }
    } catch (error) {
      console.error('Error during manual token refresh:', error);
    }
  }, []);
  
  // Fetch token expiry times
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let intervalId: NodeJS.Timeout;
    
    const fetchExpiryTimes = async () => {
      try {
        if (testMode) {
          // In test mode, read directly from localStorage to see real-time changes
          const accessExpiry = localStorage.getItem('access_token_expiry');
          const refreshExpiry = localStorage.getItem('refresh_token_expiry');
          
          setAccessTokenExpiry(accessExpiry ? parseInt(accessExpiry) : null);
          setRefreshTokenExpiry(refreshExpiry ? parseInt(refreshExpiry) : null);
        } else {
          // Get real token expiry times
          const accessExpiry = await tokenService.getTokenExpiry();
          setAccessTokenExpiry(accessExpiry);
          
          const refreshExpiry = await tokenService.getRefreshTokenExpiry();
          setRefreshTokenExpiry(refreshExpiry);
        }
      } catch (error) {
        console.error('Error fetching token expiry times:', error);
      }
    };
    
    // Initial fetch
    fetchExpiryTimes();
    
    // Set up interval for updates - use a shorter interval in test mode
    intervalId = setInterval(fetchExpiryTimes, testMode ? 1000 : 60000);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAuthenticated, testMode]);
  
  // Format date to readable string
  const formatExpiryTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Calculate time remaining
  const getTimeRemaining = (timestamp: number | null): string => {
    if (!timestamp) return 'Unknown';
    const now = Date.now();
    const remaining = timestamp - now;
    
    if (remaining <= 0) return 'Expired';
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };
  
  if (!isAuthenticated) return null;
  
  return (
    <div className="mt-6 p-4 border rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Authentication Status</h2>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="font-medium">Access Token Expires:</span>
          <span>{formatExpiryTime(accessTokenExpiry)} (in {getTimeRemaining(accessTokenExpiry)})</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Refresh Token Expires:</span>
          <span>{formatExpiryTime(refreshTokenExpiry)} (in {getTimeRemaining(refreshTokenExpiry)})</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Session Expires:</span>
          <span>{formatExpiryTime(sessionExpiry)} (in {getTimeRemaining(sessionExpiry)})</span>
        </div>
        
        <div className="mt-4 flex space-x-2">
          <button 
            onClick={toggleTestMode}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {testMode ? 'Disable Test Mode' : 'Enable Test Mode'}
          </button>
          
          <button 
            onClick={forceTokenRefresh}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Force Refresh Tokens
          </button>
        </div>
        
        {testMode && (
          <p className="mt-2 text-sm text-red-500">
            Test mode enabled: Using short-lived tokens (30s/60s)
          </p>
        )}
      </div>
    </div>
  );
};