import React, { useState } from "react";
import {
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaDownload,
  FaSync,
  FaTicketAlt,
  FaUsers,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCalendarAlt,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/buttons/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AnalyticsPage: React.FC = () => {
  // State
  const [timeRange, setTimeRange] = useState("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
      },
    },
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Handle time range change
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
  };

  // Get time range label
  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case "24h":
        return "Last 24 Hours";
      case "7d":
        return "Last 7 Days";
      case "30d":
        return "Last 30 Days";
      case "90d":
        return "Last 90 Days";
      default:
        return "Last 7 Days";
    }
  };

  // Using auth hook for authentication
  useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <main className="flex-1 overflow-y-auto relative z-10">
          <motion.div
            className="p-4 md:p-8 space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header section */}
            <motion.div variants={itemVariants}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-white flex items-center">
                    <FaChartBar className="mr-3 text-blue-500" /> Analytics Dashboard
                  </h1>
                  <p className="text-gray-400 mt-1">Key metrics and performance indicators</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={timeRange}
                    onValueChange={handleTimeRangeChange}
                  >
                    <SelectTrigger className="w-[180px] bg-gray-900/50 border-gray-700 text-white">
                      <SelectValue placeholder="Select time range" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="90d">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <>
                        <FaSync className="mr-2 h-4 w-4 animate-spin" /> Refreshing...
                      </>
                    ) : (
                      <>
                        <FaSync className="mr-2 h-4 w-4" /> Refresh
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-700 hover:bg-gray-700/50 text-gray-300"
                  >
                    <FaDownload className="mr-2 h-4 w-4" /> Export
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Key metrics section */}
            <motion.div variants={itemVariants}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Ticket metrics */}
                <Card className="bg-gray-800/50 border-gray-700/50 hover:border-blue-500/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-400">Total Tickets</p>
                        <h3 className="text-2xl font-bold mt-1 text-white">1,248</h3>
                        <p className="text-xs text-green-400 mt-1 flex items-center">
                          <span className="flex items-center">
                            <FaChartLine className="mr-1 h-3 w-3" /> +12% from last period
                          </span>
                        </p>
                      </div>
                      <div className="p-3 bg-blue-500/20 rounded-lg">
                        <FaTicketAlt className="h-6 w-6 text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Resolution rate */}
                <Card className="bg-gray-800/50 border-gray-700/50 hover:border-blue-500/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-400">Resolution Rate</p>
                        <h3 className="text-2xl font-bold mt-1 text-white">94.2%</h3>
                        <p className="text-xs text-green-400 mt-1 flex items-center">
                          <span className="flex items-center">
                            <FaChartLine className="mr-1 h-3 w-3" /> +3.5% from last period
                          </span>
                        </p>
                      </div>
                      <div className="p-3 bg-green-500/20 rounded-lg">
                        <FaCheckCircle className="h-6 w-6 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Average response time */}
                <Card className="bg-gray-800/50 border-gray-700/50 hover:border-blue-500/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-400">Avg. Response Time</p>
                        <h3 className="text-2xl font-bold mt-1 text-white">2.4h</h3>
                        <p className="text-xs text-red-400 mt-1 flex items-center">
                          <span className="flex items-center">
                            <FaChartLine className="mr-1 h-3 w-3" /> +0.3h from last period
                          </span>
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-500/20 rounded-lg">
                        <FaClock className="h-6 w-6 text-yellow-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Active users */}
                <Card className="bg-gray-800/50 border-gray-700/50 hover:border-blue-500/30 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-400">Active Users</p>
                        <h3 className="text-2xl font-bold mt-1 text-white">342</h3>
                        <p className="text-xs text-green-400 mt-1 flex items-center">
                          <span className="flex items-center">
                            <FaChartLine className="mr-1 h-3 w-3" /> +8% from last period
                          </span>
                        </p>
                      </div>
                      <div className="p-3 bg-purple-500/20 rounded-lg">
                        <FaUsers className="h-6 w-6 text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>

            {/* Detailed analytics */}
            <motion.div variants={itemVariants}>
              <Tabs defaultValue="tickets" className="w-full">
                <TabsList className="mb-6 bg-gray-700/50 p-1">
                  <TabsTrigger value="tickets" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    Ticket Analytics
                  </TabsTrigger>
                  <TabsTrigger value="performance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    Team Performance
                  </TabsTrigger>
                  <TabsTrigger value="sla" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    SLA Metrics
                  </TabsTrigger>
                </TabsList>

                {/* Ticket analytics tab */}
                <TabsContent value="tickets">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Ticket status distribution */}
                    <Card className="bg-gray-800/50 border-gray-700/50">
                      <CardHeader className="border-gray-700/50">
                        <CardTitle className="text-white">Ticket Status Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-blue-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">Open</span>
                              </div>
                              <span className="text-gray-300">32% (398)</span>
                            </div>
                            <Progress value={32} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-yellow-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">In Progress</span>
                              </div>
                              <span className="text-gray-300">45% (562)</span>
                            </div>
                            <Progress value={45} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-green-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">Resolved</span>
                              </div>
                              <span className="text-gray-300">18% (225)</span>
                            </div>
                            <Progress value={18} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-red-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">Closed</span>
                              </div>
                              <span className="text-gray-300">5% (63)</span>
                            </div>
                            <Progress value={5} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Ticket priority distribution */}
                    <Card className="bg-gray-800/50 border-gray-700/50">
                      <CardHeader className="border-gray-700/50">
                        <CardTitle className="text-white">Ticket Priority Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-green-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">Low</span>
                              </div>
                              <span className="text-gray-300">25% (312)</span>
                            </div>
                            <Progress value={25} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-blue-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">Medium</span>
                              </div>
                              <span className="text-gray-300">42% (524)</span>
                            </div>
                            <Progress value={42} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-yellow-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">High</span>
                              </div>
                              <span className="text-gray-300">28% (349)</span>
                            </div>
                            <Progress value={28} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-red-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">Critical</span>
                              </div>
                              <span className="text-gray-300">5% (63)</span>
                            </div>
                            <Progress value={5} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Team performance tab */}
                <TabsContent value="performance">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Team performance metrics */}
                    <Card className="bg-gray-800/50 border-gray-700/50">
                      <CardHeader className="border-gray-700/50">
                        <CardTitle className="text-white">Team Performance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <span className="text-gray-300">Support Team</span>
                              </div>
                              <span className="text-gray-300">92%</span>
                            </div>
                            <Progress value={92} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <span className="text-gray-300">Technical Team</span>
                              </div>
                              <span className="text-gray-300">87%</span>
                            </div>
                            <Progress value={87} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <span className="text-gray-300">Development Team</span>
                              </div>
                              <span className="text-gray-300">78%</span>
                            </div>
                            <Progress value={78} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <span className="text-gray-300">QA Team</span>
                              </div>
                              <span className="text-gray-300">95%</span>
                            </div>
                            <Progress value={95} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top performers */}
                    <Card className="bg-gray-800/50 border-gray-700/50">
                      <CardHeader className="border-gray-700/50">
                        <CardTitle className="text-white">Top Performers</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mr-3">
                                JS
                              </div>
                              <div>
                                <p className="font-medium text-white">John Smith</p>
                                <p className="text-xs text-gray-400">Support Team</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">98%</p>
                              <p className="text-xs text-gray-400">42 tickets</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 mr-3">
                                AJ
                              </div>
                              <div>
                                <p className="font-medium text-white">Alice Johnson</p>
                                <p className="text-xs text-gray-400">Technical Team</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">96%</p>
                              <p className="text-xs text-gray-400">38 tickets</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mr-3">
                                RD
                              </div>
                              <div>
                                <p className="font-medium text-white">Robert Davis</p>
                                <p className="text-xs text-gray-400">Development Team</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">94%</p>
                              <p className="text-xs text-gray-400">31 tickets</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* SLA metrics tab */}
                <TabsContent value="sla">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* SLA compliance */}
                    <Card className="bg-gray-800/50 border-gray-700/50">
                      <CardHeader className="border-gray-700/50">
                        <CardTitle className="text-white">SLA Compliance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-green-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">Within SLA</span>
                              </div>
                              <span className="text-gray-300">89% (1,110)</span>
                            </div>
                            <Progress value={89} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-yellow-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">At Risk</span>
                              </div>
                              <span className="text-gray-300">7% (87)</span>
                            </div>
                            <Progress value={7} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <div className="flex items-center">
                                <Badge className="bg-red-500 mr-2 h-2 w-2 rounded-full p-0" />
                                <span className="text-gray-300">Breached</span>
                              </div>
                              <span className="text-gray-300">4% (51)</span>
                            </div>
                            <Progress value={4} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Response time by priority */}
                    <Card className="bg-gray-800/50 border-gray-700/50">
                      <CardHeader className="border-gray-700/50">
                        <CardTitle className="text-white">Response Time by Priority</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center">
                              <Badge className="bg-red-500 mr-2 h-2 w-2 rounded-full p-0" />
                              <p className="font-medium text-white">Critical</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">0.8h</p>
                              <p className="text-xs text-gray-400">Target: 1h</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center">
                              <Badge className="bg-yellow-500 mr-2 h-2 w-2 rounded-full p-0" />
                              <p className="font-medium text-white">High</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">2.3h</p>
                              <p className="text-xs text-gray-400">Target: 4h</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center">
                              <Badge className="bg-blue-500 mr-2 h-2 w-2 rounded-full p-0" />
                              <p className="font-medium text-white">Medium</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">5.2h</p>
                              <p className="text-xs text-gray-400">Target: 8h</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center">
                              <Badge className="bg-green-500 mr-2 h-2 w-2 rounded-full p-0" />
                              <p className="font-medium text-white">Low</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">10.5h</p>
                              <p className="text-xs text-gray-400">Target: 24h</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          </motion.div>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default AnalyticsPage;
