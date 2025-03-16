import React from 'react';
import { Alert, AlertTitle, LinearProgress } from '@mui/material';
import { useRateLimit } from '../../hooks/useRateLimit';

export const RateLimitAlert: React.FC = () => {
  const { isLimited, remainingTime, progress } = useRateLimit();

  if (!isLimited) return null;

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <AlertTitle>Too Many Attempts</AlertTitle>
      Please wait {Math.ceil(remainingTime / 1000)} seconds before trying again
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ mt: 1 }}
      />
    </Alert>
  );
};