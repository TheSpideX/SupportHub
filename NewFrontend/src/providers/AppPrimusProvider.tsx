import React, { createContext, useContext, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import appPrimusClient from "@/services/primus/appPrimusClient";
import { RootState } from "@/store";

// Define the context type
interface AppPrimusContextType {
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (action: string, data: any) => void;
}

// Create the context with default values
const AppPrimusContext = createContext<AppPrimusContextType>({
  isConnected: false,
  isConnecting: false,
  connect: () => {},
  disconnect: () => {},
  send: () => {},
});

// Hook to use the AppPrimus context
export const useAppPrimus = () => useContext(AppPrimusContext);

interface AppPrimusProviderProps {
  children: React.ReactNode;
}

export const AppPrimusProvider: React.FC<AppPrimusProviderProps> = ({
  children,
}) => {
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

      // Disconnect when the component unmounts
      appPrimusClient.disconnect();
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

  // Provide the context value
  const contextValue: AppPrimusContextType = {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    send,
  };

  return (
    <AppPrimusContext.Provider value={contextValue}>
      {children}
    </AppPrimusContext.Provider>
  );
};

export default AppPrimusProvider;
