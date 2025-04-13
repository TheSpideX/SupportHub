import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FaChartBar,
  FaChartPie,
  FaChartLine,
  FaChartArea,
  FaDownload,
  FaFilter,
  FaSync,
  FaEllipsisH,
} from "react-icons/fa";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/buttons/Button";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DataVisualizationProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  data: any[];
  type?: "line" | "bar" | "pie" | "area" | "multi";
  colors?: string[];
  className?: string;
  onRefresh?: () => void;
}

const DataVisualization: React.FC<DataVisualizationProps> = ({
  title,
  description,
  icon: Icon = FaChartBar,
  data,
  type = "line",
  colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"],
  className = "",
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<string>(
    type === "multi" ? "line" : type
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    if (onRefresh) {
      onRefresh();
    }
    setTimeout(() => setIsLoading(false), 1000);
  };

  // Animation variants
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
      },
    },
  };

  const renderChart = (chartType: string) => {
    switch (chartType) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  borderColor: "#374151",
                  color: "#f9fafb",
                }}
                itemStyle={{ color: "#f9fafb" }}
              />
              <Legend />
              {Object.keys(data[0] || {})
                .filter((key) => key !== "name")
                .map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    activeDot={{ r: 8 }}
                    strokeWidth={2}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  borderColor: "#374151",
                  color: "#f9fafb",
                }}
                itemStyle={{ color: "#f9fafb" }}
              />
              <Legend />
              {Object.keys(data[0] || {})
                .filter((key) => key !== "name")
                .map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={colors[index % colors.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "pie":
        // Transform data for pie chart if needed
        const pieData = data.map((item) => ({
          name: item.name,
          value:
            typeof item.value === "number"
              ? item.value
              : parseInt(item.value || "0"),
        }));

        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  borderColor: "#374151",
                  color: "#f9fafb",
                }}
                itemStyle={{ color: "#f9fafb" }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  borderColor: "#374151",
                  color: "#f9fafb",
                }}
                itemStyle={{ color: "#f9fafb" }}
              />
              <Legend />
              {Object.keys(data[0] || {})
                .filter((key) => key !== "name")
                .map((key, index) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    fill={colors[index % colors.length]}
                    stroke={colors[index % colors.length]}
                    fillOpacity={0.3}
                  />
                ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      className={`bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 ${className}`}
      variants={itemVariants}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <div className="px-6 py-4 border-b border-gray-700/70 flex justify-between items-center">
        <div className="flex items-center">
          <Icon className="h-5 w-5 text-blue-400 mr-2" />
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && (
              <p className="text-sm text-gray-400">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
            onClick={handleRefresh}
          >
            <FaSync
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
              >
                <FaEllipsisH className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border border-gray-700 text-white">
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                <FaFilter className="h-4 w-4 mr-2" />
                <span>Filter Data</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                <FaDownload className="h-4 w-4 mr-2" />
                <span>Export Chart</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-6">
        {type === "multi" ? (
          <Tabs
            defaultValue={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-4 bg-gray-700/50 p-1">
              <TabsTrigger
                value="line"
                className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
              >
                <FaChartLine className="h-4 w-4 mr-2" />
                Line
              </TabsTrigger>
              <TabsTrigger
                value="bar"
                className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
              >
                <FaChartBar className="h-4 w-4 mr-2" />
                Bar
              </TabsTrigger>
              <TabsTrigger
                value="area"
                className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
              >
                <FaChartArea className="h-4 w-4 mr-2" />
                Area
              </TabsTrigger>
              <TabsTrigger
                value="pie"
                className={`data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300`}
              >
                <FaChartPie className="h-4 w-4 mr-2" />
                Pie
              </TabsTrigger>
            </TabsList>
            <TabsContent value="line">{renderChart("line")}</TabsContent>
            <TabsContent value="bar">{renderChart("bar")}</TabsContent>
            <TabsContent value="area">{renderChart("area")}</TabsContent>
            <TabsContent value="pie">{renderChart("pie")}</TabsContent>
          </Tabs>
        ) : (
          renderChart(type)
        )}
      </div>
    </motion.div>
  );
};

export default DataVisualization;
