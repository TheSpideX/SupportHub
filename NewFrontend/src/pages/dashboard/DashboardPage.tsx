import * as React from 'react';
import { Grid, Box, Typography } from '@mui/material';
import TokenServiceTester from '@/features/dashboard/components/TokenServiceTester';
import { useEffect } from 'react';
import { getSessionSocketManager, initializeSessionSocket } from '@/services/socket/socket';

export const DashboardPage = () => {
  useEffect(() => {
    // Ensure socket is initialized when dashboard loads
    try {
      const socketManager = getSessionSocketManager();
      
      console.log("Dashboard: Checking socket status", {
        hasSocket: socketManager.hasSocket(),
        isConnected: socketManager.isConnected()
      });
      
      if (!socketManager.hasSocket() || !socketManager.isConnected()) {
        console.log("Dashboard: Socket not connected, initializing");
        initializeSessionSocket();
      }
    } catch (error) {
      console.error("Dashboard: Error initializing socket", error);
    }
  }, []);

  return (
    <div>
      <TokenServiceTester />
    </div>
  );
};
