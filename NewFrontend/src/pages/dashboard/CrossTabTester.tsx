import React, { useState, useEffect } from "react";
import { Paper, Typography, Box, Button, Grid, Alert } from "@mui/material";
import {
  getCrossTabService,
  MessageType,
} from "@/features/auth/services/CrossTabService";
import { getAuthService } from "@/features/auth/services";

// This component tests cross-tab communication
const CrossTabTester: React.FC = () => {
  const [tabId, setTabId] = useState<string>("");
  const [isLeader, setIsLeader] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<string>("None");
  const [messageCount, setMessageCount] = useState<number>(0);

  useEffect(() => {
    const crossTabService = getCrossTabService();
    setTabId(crossTabService.getTabId());

    // Check if this tab is the leader
    const checkLeader = () => {
      setIsLeader(crossTabService.isLeader());
    };

    // Initial check
    checkLeader();

    // Subscribe to all messages for debugging
    const unsubscribes = Object.values(MessageType).map((type) => {
      return crossTabService.subscribe(type as MessageType, (payload) => {
        setLastMessage(`${type}: ${JSON.stringify(payload)}`);
        setMessageCount((prev) => prev + 1);
      });
    });

    // Set up periodic leader check
    const intervalId = setInterval(checkLeader, 2000);

    return () => {
      clearInterval(intervalId);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // Send a test message
  const sendTestMessage = () => {
    const crossTabService = getCrossTabService();
    crossTabService.broadcastMessage(MessageType.USER_ACTIVITY, {
      timestamp: Date.now(),
      details: "Manual test activity",
    });
  };

  // Test logout with redirect
  const testLogoutWithRedirect = () => {
    getAuthService().logout({
      redirectPath: "/login",
      reason: "test",
      silent: false,
    });
  };

  // Force leader election
  const forceLeaderElection = () => {
    const crossTabService = getCrossTabService();
    crossTabService.electLeader();
    setIsLeader(crossTabService.isLeader());
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        Cross-Tab Communication Tester
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body1">
          <strong>Tab ID:</strong> {tabId}
        </Typography>
        <Typography variant="body1">
          <strong>Leader Status:</strong>{" "}
          {isLeader ? "Leader Tab" : "Follower Tab"}
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Messages Received:</strong> {messageCount}
        </Typography>
        <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
          <strong>Last Message:</strong> {lastMessage}
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        <Grid item>
          <Button variant="contained" color="primary" onClick={sendTestMessage}>
            Send Test Message
          </Button>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="secondary"
            onClick={forceLeaderElection}
          >
            Force Leader Election
          </Button>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="error"
            onClick={testLogoutWithRedirect}
          >
            Test Logout with Redirect
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default CrossTabTester;
