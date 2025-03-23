import * as React from 'react';
import { Grid, Box, Typography } from '@mui/material';
import TokenServiceTester from '@/features/dashboard/components/TokenServiceTester';
import CrossTabTester from './CrossTabTester';

export const DashboardPage = () => {
  return (
    <div>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <CrossTabTester />
      <TokenServiceTester />
    </div>
  );
};