import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FaArrowUp,
  FaArrowDown,
  FaEllipsisH,
  FaInfoCircle,
} from "react-icons/fa";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

interface EnhancedStatCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  color?: string;
  gradient?: string;
  variant?: "default" | "gradient" | "outline";
  trend?: "up" | "down" | "neutral";
  trendData?: Array<{ value: number }>;
  info?: string;
  onClick?: () => void;
}

const EnhancedStatCard: React.FC<EnhancedStatCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color = "bg-blue-500",
  gradient = "from-blue-500 to-blue-600",
  variant = "gradient",
  trend = "neutral",
  trendData = Array(12)
    .fill(0)
    .map(() => ({ value: Math.floor(Math.random() * 100) })),
  info,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determine trend color
  const trendColor =
    trend === "up"
      ? "text-green-500"
      : trend === "down"
      ? "text-red-500"
      : "text-gray-400";

  // Determine trend icon
  const TrendIcon =
    trend === "up" ? FaArrowUp : trend === "down" ? FaArrowDown : null;

  return (
    <motion.div
      className={`rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${
        variant === "gradient"
          ? `bg-gradient-to-r ${gradient}`
          : variant === "outline"
          ? "bg-transparent border-2 border-gray-200 dark:border-gray-700"
          : "bg-white dark:bg-gray-800"
      }`}
      whileHover={{
        y: -5,
        boxShadow:
          "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        scale: 1.02,
      }}
      transition={{ duration: 0.2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className={`p-3 rounded-lg ${
                variant === "gradient" ? "bg-white/10" : color
              } shadow-sm`}
            >
              <Icon
                className={`h-6 w-6 ${
                  variant === "gradient" ? "text-white" : "text-white"
                }`}
              />
            </div>
            <div className="ml-4">
              <div className="flex items-center">
                <h3
                  className={`text-lg font-medium ${
                    variant === "gradient"
                      ? "text-white"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {title}
                </h3>
                {info && (
                  <span className="inline-block ml-2">
                    <FaInfoCircle
                      className={`h-4 w-4 ${
                        variant === "gradient"
                          ? "text-white/70"
                          : "text-gray-400"
                      }`}
                    />
                  </span>
                )}
              </div>
              <div className="flex items-center mt-1">
                <p
                  className={`text-2xl font-bold ${
                    variant === "gradient"
                      ? "text-white"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {value}
                </p>
                <div className="ml-2 flex items-center">
                  {TrendIcon && (
                    <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                  )}
                  <span className={`ml-1 text-xs ${trendColor}`}>{change}</span>
                </div>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`p-2 rounded-full ${
                  variant === "gradient"
                    ? "text-white/70 hover:text-white hover:bg-white/10"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                } transition-colors`}
              >
                <FaEllipsisH className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border border-gray-700 text-white">
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                Export Data
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                Set Alert
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mini chart that appears on hover */}
      <div
        className={`h-16 overflow-hidden transition-all duration-300 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <RechartsTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-gray-800 p-2 rounded shadow text-white text-xs">
                      Value: {payload[0].value}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={variant === "gradient" ? "#ffffff" : "#3b82f6"}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default EnhancedStatCard;
