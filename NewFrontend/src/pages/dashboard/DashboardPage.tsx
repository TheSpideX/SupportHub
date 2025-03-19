import React from 'react';
import { Grid, Box, Typography } from '@mui/material';
import { AuthStatusMonitor } from '@/features/dashboard/components/AuthStatusMonitor';

export const DashboardPage = () => {
  return (
    <div>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={4}>
          <AuthStatusMonitor />
        </Grid>
        {/* Other dashboard content can go here */}
      </Grid>
    </div>
  );
};
