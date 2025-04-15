import React from "react";
import { useAppPrimus } from "@/providers/AppPrimusProvider";
import { FaPlug, FaPlugCircleCheck, FaPlugCircleXmark } from "react-icons/fa6";
import { cn } from "@/lib/utils";

interface AppPrimusStatusProps {
  className?: string;
  showLabel?: boolean;
}

const AppPrimusStatus: React.FC<AppPrimusStatusProps> = ({
  className,
  showLabel = true,
}) => {
  const { isConnected, isConnecting, connect } = useAppPrimus();

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      {isConnected ? (
        <>
          <FaPlugCircleCheck className="text-green-500 animate-pulse" />
          {showLabel && <span className="text-green-500">Connected</span>}
        </>
      ) : isConnecting ? (
        <>
          <FaPlug className="text-yellow-500 animate-pulse" />
          {showLabel && <span className="text-yellow-500">Connecting...</span>}
        </>
      ) : (
        <>
          <FaPlugCircleXmark
            className="text-red-500 cursor-pointer hover:text-red-400 transition-colors"
            onClick={connect}
            title="Click to reconnect"
          />
          {showLabel && (
            <span
              className="text-red-500 cursor-pointer hover:text-red-400 transition-colors"
              onClick={connect}
            >
              Disconnected (click to reconnect)
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default AppPrimusStatus;
