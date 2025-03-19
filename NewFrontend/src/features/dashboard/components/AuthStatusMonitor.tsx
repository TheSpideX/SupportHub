import * as React from 'react';
import { useEffect, useState } from 'react';
import { useAuthMonitor } from '@/features/auth/hooks/useAuthMonitor';
import { 
  Card, CardContent, CardHeader, Chip, Divider, Typography, Box, Stack,
  List, ListItem, ListItemIcon, ListItemText, LinearProgress, Tooltip,
  Accordion, AccordionSummary, AccordionDetails, Badge
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DevicesIcon from '@mui/icons-material/Devices';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TimerIcon from '@mui/icons-material/Timer';
import { formatDistanceToNow, formatRelative } from 'date-fns';
import { useAuth } from '@/features/auth/hooks/useAuth';

export const AuthStatusMonitor = () => {
  const { healthStatus, isHealthy, errors } = useAuthMonitor();
  const { user, isAuthenticated } = useAuth();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [tokenDetailsExpanded, setTokenDetailsExpanded] = useState(false);
  const [sessionDetailsExpanded, setSessionDetailsExpanded] = useState(false);

  useEffect(() => {
    setLastUpdated(new Date());
    const interval = setInterval(() => setLastUpdated(new Date()), 10000);
    return () => clearInterval(interval);
  }, [healthStatus]);

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    return formatRelative(new Date(timestamp), new Date());
  };

  const getStatusChip = (isOk) => {
    return isOk ? (
      <Chip 
        icon={<CheckCircleIcon />} 
        label="Healthy" 
        color="success" 
        size="small" 
        sx={{ fontWeight: 'bold' }}
      />
    ) : (
      <Chip 
        icon={<ErrorIcon />} 
        label="Issues Detected" 
        color="error" 
        size="small" 
        sx={{ fontWeight: 'bold' }}
      />
    );
  };

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    
    const now = new Date();
    const expiry = new Date(expiryDate);
    const timeLeft = expiry.getTime() - now.getTime();
    
    // Less than 5 minutes
    if (timeLeft < 300000 && timeLeft > 0) {
      return (
        <Tooltip title="Expiring soon">
          <Chip icon={<WarningIcon />} label="Expiring soon" color="warning" size="small" />
        </Tooltip>
      );
    }
    // Already expired
    else if (timeLeft <= 0) {
      return (
        <Tooltip title="Expired">
          <Chip icon={<ErrorIcon />} label="Expired" color="error" size="small" />
        </Tooltip>
      );
    }
    // More than 5 minutes
    else {
      return (
        <Tooltip title="Valid">
          <Chip icon={<CheckCircleIcon />} label="Valid" color="success" size="small" />
        </Tooltip>
      );
    }
  };

  return (
    <Card elevation={3}>
      <CardHeader 
        title={
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <SecurityIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Authentication System Status</Typography>
            </Box>
            {getStatusChip(isHealthy)}
          </Box>
        }
      />
      <Divider />
      <CardContent>
        <Stack spacing={2}>
          {/* Main Services Status */}
          <List dense disablePadding>
            <ListItem>
              <ListItemIcon>
                <VpnKeyIcon color={healthStatus.tokenServiceHealthy ? "success" : "error"} />
              </ListItemIcon>
              <ListItemText 
                primary="Token Service" 
                secondary={healthStatus.tokenServiceHealthy ? "Operational" : "Issues Detected"}
              />
              {getStatusChip(healthStatus.tokenServiceHealthy)}
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <DevicesIcon color={healthStatus.sessionServiceHealthy ? "success" : "error"} />
              </ListItemIcon>
              <ListItemText 
                primary="Session Service" 
                secondary={healthStatus.sessionServiceHealthy ? "Operational" : "Issues Detected"}
              />
              {getStatusChip(healthStatus.sessionServiceHealthy)}
            </ListItem>
          </List>

          <Divider />

          {/* Token Details Section */}
          <Accordion 
            expanded={tokenDetailsExpanded} 
            onChange={() => setTokenDetailsExpanded(!tokenDetailsExpanded)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Token Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <TimerIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Access Token" 
                    secondary={
                      healthStatus.tokenDetails?.isAccessTokenValid 
                        ? `Valid until ${formatTime(healthStatus.tokenDetails?.accessTokenExpiry)}`
                        : "Invalid or expired"
                    }
                  />
                  {getExpiryStatus(healthStatus.tokenDetails?.accessTokenExpiry)}
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <TimerIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Refresh Token" 
                    secondary={
                      healthStatus.tokenDetails?.isRefreshTokenValid 
                        ? `Valid until ${formatTime(healthStatus.tokenDetails?.refreshTokenExpiry)}`
                        : "Invalid or expired"
                    }
                  />
                  {getExpiryStatus(healthStatus.tokenDetails?.refreshTokenExpiry)}
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          {/* Session Details Section */}
          <Accordion 
            expanded={sessionDetailsExpanded} 
            onChange={() => setSessionDetailsExpanded(!sessionDetailsExpanded)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Session Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense disablePadding>
                <ListItem>
                  <ListItemText 
                    primary="Current Device" 
                    secondary={healthStatus.sessionDetails?.currentDevice || "Unknown"}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Active Sessions" 
                    secondary={healthStatus.sessionDetails?.activeSessions || "0"}
                  />
                  <Chip 
                    label={healthStatus.sessionDetails?.activeSessions || "0"} 
                    color="primary" 
                    size="small" 
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Last Activity" 
                    secondary={formatTime(healthStatus.sessionDetails?.lastActivity)}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          {/* Live Session Details */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Current Session Status
            </Typography>
            <List dense disablePadding>
              <ListItem>
                <ListItemText 
                  primary="Authentication Status" 
                  secondary={isAuthenticated ? "Authenticated" : "Not Authenticated"}
                />
                <Chip 
                  label={isAuthenticated ? "Active" : "Inactive"} 
                  color={isAuthenticated ? "success" : "default"} 
                  size="small" 
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Last Token Refresh" 
                  secondary={formatTime(healthStatus.lastTokenRefresh)}
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Last Session Sync" 
                  secondary={formatTime(healthStatus.lastSessionSync)}
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Last Health Check" 
                  secondary={formatTime(healthStatus.lastCheck)}
                />
              </ListItem>
            </List>
          </Box>

          {/* Errors Section */}
          {errors && errors.length > 0 && (
            <>
              <Divider />
              <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Badge badgeContent={errors.length} color="error">
                    <Typography color="error">Errors Detected</Typography>
                  </Badge>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {errors.map((error, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <ErrorIcon color="error" />
                        </ListItemIcon>
                        <ListItemText primary={error} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </>
          )}

          {/* Last Updated */}
          <Box display="flex" justifyContent="flex-end" alignItems="center">
            <RefreshIcon fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
            <Typography variant="caption" color="text.secondary">
              Last updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
