import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";

interface DataSourceIndicatorProps {
  isReal?: boolean;
  isPartiallyReal?: boolean;
  isMock?: boolean;
  source?: string;
}

const DataSourceIndicator: React.FC<DataSourceIndicatorProps> = ({
  isReal,
  isPartiallyReal,
  isMock,
  source,
}) => {
  // Determine the type of data
  const dataType = isReal
    ? "real"
    : isPartiallyReal
    ? "partial"
    : isMock
    ? "mock"
    : "unknown";

  // Set icon and colors based on data type
  let Icon = FaInfoCircle;
  let iconColor = "text-gray-400";
  let tooltipTitle = "Unknown Data Source";
  let tooltipDescription =
    source || "No information available about this data source.";

  switch (dataType) {
    case "real":
      Icon = FaCheckCircle;
      iconColor = "text-green-500";
      tooltipTitle = "Real Data";
      tooltipDescription =
        source || "This metric is based on real system data.";
      break;
    case "partial":
      Icon = FaInfoCircle;
      iconColor = "text-blue-500";
      tooltipTitle = "Partially Real Data";
      tooltipDescription =
        source || "This metric is based on a mix of real data and estimates.";
      break;
    case "mock":
      Icon = FaExclamationTriangle;
      iconColor = "text-amber-500";
      tooltipTitle = "Simulated Data";
      tooltipDescription =
        source || "This metric is simulated for demonstration purposes.";
      break;
  }

  return (
    <span className="inline-block ml-1">
      <TooltipPrimitive.Provider>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <button
              type="button"
              className="border-0 bg-transparent p-0 cursor-help"
            >
              <Icon className={`h-3 w-3 ${iconColor}`} />
            </button>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Content
            className="z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-w-xs"
            sideOffset={4}
          >
            <div className="space-y-1">
              <p className="font-medium">{tooltipTitle}</p>
              <p className="text-xs text-gray-500">{tooltipDescription}</p>
            </div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    </span>
  );
};

export default DataSourceIndicator;
