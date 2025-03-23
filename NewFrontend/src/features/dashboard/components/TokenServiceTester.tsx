import React, { useState } from 'react';
import { Button, Stack, Typography, Alert, Paper, Box } from '@mui/material';
import { getAuthServices } from '@/features/auth/services';
import { logger } from '@/utils/logger';

const TokenServiceTester: React.FC = () => {
  const [testResult, setTestResult] = useState<{message: string, success: boolean} | null>(null);
  const { tokenService } = getAuthServices();

  const runTests = async (testType: string) => {
    try {
      setTestResult(null);
      
      switch(testType) {
        case 'refresh':
          logger.info('Manually triggering token refresh');
          const refreshResult = await tokenService.refreshToken();
          setTestResult({
            message: refreshResult 
              ? 'Token refresh successful' 
              : 'Token refresh failed or not needed',
            success: refreshResult
          });
          break;
          
        case 'inactivity':
          logger.info('Simulating inactivity logout');
          // Directly call the inactivity logout method
          tokenService.logoutDueToInactivity();
          setTestResult({
            message: 'Inactivity logout triggered',
            success: true
          });
          break;
          
        case 'status':
          logger.info('Checking token status');
          const statusResult = await tokenService.checkTokenStatus();
          setTestResult({
            message: `Token status check: ${JSON.stringify(statusResult)}`,
            success: true
          });
          break;
          
        case 'heartbeat':
          logger.info('Testing token heartbeat');
          // Restart heartbeat to ensure it's running
          tokenService.stopTokenHeartbeat();
          tokenService.startTokenHeartbeat();
          setTestResult({
            message: 'Token heartbeat restarted',
            success: true
          });
          break;
      }
    } catch (error) {
      logger.error('Token test failed:', error);
      setTestResult({
        message: `Test failed: ${error instanceof Error ? error.message : String(error)}`,
        success: false
      });
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Token Service Tester
      </Typography>
      
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={() => runTests('refresh')}
        >
          Test Refresh
        </Button>
        <Button 
          variant="outlined" 
          color="warning" 
          onClick={() => runTests('inactivity')}
        >
          Test Inactivity Logout
        </Button>
        <Button 
          variant="outlined" 
          color="info" 
          onClick={() => runTests('status')}
        >
          Check Token Status
        </Button>
        <Button 
          variant="outlined" 
          color="secondary" 
          onClick={() => runTests('heartbeat')}
        >
          Test Heartbeat
        </Button>
      </Stack>
      
      {testResult && (
        <Box mt={2}>
          <Alert severity={testResult.success ? "success" : "error"}>
            {testResult.message}
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default TokenServiceTester;