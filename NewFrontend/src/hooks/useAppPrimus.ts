import { useEffect, useState } from "react";
import appPrimusClient from "@/services/primus/appPrimusClient";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

/**
 * Hook to manage the application Primus connection
 *
 * This hook will:
 * 1. Initialize the Primus connection when the component mounts
 * 2. Connect to the Primus server when the user is authenticated
 * 3. Disconnect from the Primus server when the component unmounts
 *
 * @returns {Object} Connection status and methods
 */
export const useAppPrimus = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  useEffect(() => {
    // Initialize the Primus client
    appPrimusClient.initialize();

    // Set up event listeners for connection status
    const handleOpen = () => {
      setIsConnected(true);
      setIsConnecting(false);
    };

    const handleClose = () => {
      setIsConnected(false);
      setIsConnecting(false);
    };

    const handleConnecting = () => {
      setIsConnecting(true);
    };

    // Add event listeners
    if (appPrimusClient.primus) {
      appPrimusClient.primus.on("open", handleOpen);
      appPrimusClient.primus.on("close", handleClose);
      appPrimusClient.primus.on("reconnect", handleConnecting);
    }

    // Connect if the user is authenticated
    if (isAuthenticated) {
      setIsConnecting(true);
      appPrimusClient.connect();
    }

    // Clean up event listeners when the component unmounts
    return () => {
      if (appPrimusClient.primus) {
        appPrimusClient.primus.removeListener("open", handleOpen);
        appPrimusClient.primus.removeListener("close", handleClose);
        appPrimusClient.primus.removeListener("reconnect", handleConnecting);
      }
    };
  }, [isAuthenticated]);

  // Connect to the Primus server
  const connect = () => {
    setIsConnecting(true);
    appPrimusClient.connect();
  };

  // Disconnect from the Primus server
  const disconnect = () => {
    appPrimusClient.disconnect();
  };

  // Send data to the Primus server
  const send = (action: string, data: any) => {
    appPrimusClient.send(action, data);
  };

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    send,
  };
};

export default useAppPrimus;
