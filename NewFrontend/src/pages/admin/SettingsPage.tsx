import React, { useState } from "react";
import { FaCog, FaSave, FaUndo } from "react-icons/fa";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TopNavbar from "@/components/dashboard/TopNavbar";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/dashboard/Footer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/buttons/Button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useTheme } from "next-themes";

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();

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
        duration: 0.5,
      },
    },
  };

  // State for general settings
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "Support Hub",
    siteDescription: "Customer support and ticket management system",
    supportEmail: "support@example.com",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
  });

  // State for notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    inAppNotifications: true,
    soundAlerts: false,
    ticketCreated: true,
    ticketUpdated: true,
    ticketAssigned: true,
    ticketResolved: true,
    dailyDigest: false,
    weeklyReport: true,
  });

  // State for appearance settings
  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: theme || "system",
    primaryColor: "#0284c7",
    accentColor: "#f59e0b",
    sidebarCollapsed: false,
    denseMode: false,
    animationsEnabled: true,
  });

  // State for system settings
  const [systemSettings, setSystemSettings] = useState({
    maxFileUploadSize: 10, // MB
    allowedFileTypes: ".jpg,.png,.pdf,.doc,.docx,.xls,.xlsx",
    autoLogout: 30, // minutes
    maxTicketsPerPage: 20,
    enableMaintenanceMode: false,
    enableDebugMode: false,
  });

  // Handle general settings changes
  const handleGeneralSettingsChange = (
    key: keyof typeof generalSettings,
    value: any
  ) => {
    setGeneralSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle notification settings changes
  const handleNotificationSettingsChange = (
    key: keyof typeof notificationSettings,
    value: any
  ) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle appearance settings changes
  const handleAppearanceSettingsChange = (
    key: keyof typeof appearanceSettings,
    value: any
  ) => {
    setAppearanceSettings((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Update theme if that's what changed
    if (key === "theme") {
      setTheme(value);
    }
  };

  // Handle system settings changes
  const handleSystemSettingsChange = (
    key: keyof typeof systemSettings,
    value: any
  ) => {
    setSystemSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Save all settings
  const saveAllSettings = () => {
    console.log("Saving all settings", {
      generalSettings,
      notificationSettings,
      appearanceSettings,
      systemSettings,
    });
    // Here you would typically make an API call to save the settings
  };

  // Reset all settings to defaults
  const resetAllSettings = () => {
    // Reset to default values
    console.log("Resetting all settings to defaults");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <TopNavbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          userRole={user?.role}
        />

        <main className="flex-1 overflow-y-auto relative z-10">
          <motion.div
            className="p-4 md:p-8 space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header section */}
            <motion.div
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300"
              variants={itemVariants}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-600/20 rounded-lg mr-4">
                    <FaCog className="h-8 w-8 text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300">
                      Settings
                    </h1>
                    <p className="mt-1 text-gray-300">
                      Configure system-wide settings and preferences
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white shadow-md flex items-center gap-2"
                    onClick={saveAllSettings}
                  >
                    <FaSave className="h-4 w-4" />
                    Save All
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-700 hover:bg-gray-700/50 text-gray-300 flex items-center gap-2"
                    onClick={resetAllSettings}
                  >
                    <FaUndo className="h-4 w-4" />
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/70 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300 p-6"
              variants={itemVariants}
            >
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-6 bg-gray-700/50 p-1">
                  <TabsTrigger
                    value="general"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    General
                  </TabsTrigger>
                  <TabsTrigger
                    value="notifications"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Notifications
                  </TabsTrigger>
                  <TabsTrigger
                    value="appearance"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Appearance
                  </TabsTrigger>
                  <TabsTrigger
                    value="system"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    System
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                  <Card className="bg-gray-800/50 border-gray-700/50">
                    <CardHeader className="border-gray-700/50">
                      <CardTitle className="text-white">
                        General Settings
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Configure basic system settings and preferences
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="site-name" className="text-gray-300">
                            Site Name
                          </Label>
                          <input
                            id="site-name"
                            type="text"
                            value={generalSettings.siteName}
                            onChange={(e) =>
                              handleGeneralSettingsChange(
                                "siteName",
                                e.target.value
                              )
                            }
                            className="w-full py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="support-email"
                            className="text-gray-300"
                          >
                            Support Email
                          </Label>
                          <input
                            id="support-email"
                            type="email"
                            value={generalSettings.supportEmail}
                            onChange={(e) =>
                              handleGeneralSettingsChange(
                                "supportEmail",
                                e.target.value
                              )
                            }
                            className="w-full py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="site-description">
                            Site Description
                          </Label>
                          <Textarea
                            id="site-description"
                            value={generalSettings.siteDescription}
                            onChange={(e) =>
                              handleGeneralSettingsChange(
                                "siteDescription",
                                e.target.value
                              )
                            }
                            rows={3}
                            className="w-full py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white resize-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="timezone">Timezone</Label>
                          <Select
                            value={generalSettings.timezone}
                            onValueChange={(value) =>
                              handleGeneralSettingsChange("timezone", value)
                            }
                          >
                            <SelectTrigger
                              id="timezone"
                              className="bg-gray-900/50 border-gray-700 text-white"
                            >
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                              <SelectItem value="UTC">UTC</SelectItem>
                              <SelectItem value="America/New_York">
                                Eastern Time (ET)
                              </SelectItem>
                              <SelectItem value="America/Chicago">
                                Central Time (CT)
                              </SelectItem>
                              <SelectItem value="America/Denver">
                                Mountain Time (MT)
                              </SelectItem>
                              <SelectItem value="America/Los_Angeles">
                                Pacific Time (PT)
                              </SelectItem>
                              <SelectItem value="Europe/London">
                                Greenwich Mean Time (GMT)
                              </SelectItem>
                              <SelectItem value="Europe/Paris">
                                Central European Time (CET)
                              </SelectItem>
                              <SelectItem value="Asia/Tokyo">
                                Japan Standard Time (JST)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="date-format">Date Format</Label>
                          <Select
                            value={generalSettings.dateFormat}
                            onValueChange={(value) =>
                              handleGeneralSettingsChange("dateFormat", value)
                            }
                          >
                            <SelectTrigger id="date-format">
                              <SelectValue placeholder="Select date format" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MM/DD/YYYY">
                                MM/DD/YYYY
                              </SelectItem>
                              <SelectItem value="DD/MM/YYYY">
                                DD/MM/YYYY
                              </SelectItem>
                              <SelectItem value="YYYY-MM-DD">
                                YYYY-MM-DD
                              </SelectItem>
                              <SelectItem value="MMMM D, YYYY">
                                MMMM D, YYYY
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="time-format">Time Format</Label>
                          <Select
                            value={generalSettings.timeFormat}
                            onValueChange={(value) =>
                              handleGeneralSettingsChange("timeFormat", value)
                            }
                          >
                            <SelectTrigger id="time-format">
                              <SelectValue placeholder="Select time format" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="12h">
                                12-hour (AM/PM)
                              </SelectItem>
                              <SelectItem value="24h">24-hour</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={() =>
                            console.log(
                              "General settings saved",
                              generalSettings
                            )
                          }
                        >
                          Save General Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notifications">
                  <Card className="bg-gray-800/50 border-gray-700/50">
                    <CardHeader className="border-gray-700/50">
                      <CardTitle className="text-white">
                        Notification Settings
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Configure how and when notifications are sent
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label
                              htmlFor="email-notifications"
                              className="block"
                            >
                              Email Notifications
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Send notifications via email
                            </p>
                          </div>
                          <Switch
                            id="email-notifications"
                            checked={notificationSettings.emailNotifications}
                            onCheckedChange={(checked) =>
                              handleNotificationSettingsChange(
                                "emailNotifications",
                                checked
                              )
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label
                              htmlFor="in-app-notifications"
                              className="block"
                            >
                              In-App Notifications
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Show notifications within the application
                            </p>
                          </div>
                          <Switch
                            id="in-app-notifications"
                            checked={notificationSettings.inAppNotifications}
                            onCheckedChange={(checked) =>
                              handleNotificationSettingsChange(
                                "inAppNotifications",
                                checked
                              )
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="sound-alerts" className="block">
                              Sound Alerts
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Play sound when notifications arrive
                            </p>
                          </div>
                          <Switch
                            id="sound-alerts"
                            checked={notificationSettings.soundAlerts}
                            onCheckedChange={(checked) =>
                              handleNotificationSettingsChange(
                                "soundAlerts",
                                checked
                              )
                            }
                          />
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium mb-4">
                            Notification Events
                          </h3>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="ticket-created">
                                Ticket Created
                              </Label>
                              <Switch
                                id="ticket-created"
                                checked={notificationSettings.ticketCreated}
                                onCheckedChange={(checked) =>
                                  handleNotificationSettingsChange(
                                    "ticketCreated",
                                    checked
                                  )
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label htmlFor="ticket-updated">
                                Ticket Updated
                              </Label>
                              <Switch
                                id="ticket-updated"
                                checked={notificationSettings.ticketUpdated}
                                onCheckedChange={(checked) =>
                                  handleNotificationSettingsChange(
                                    "ticketUpdated",
                                    checked
                                  )
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label htmlFor="ticket-assigned">
                                Ticket Assigned
                              </Label>
                              <Switch
                                id="ticket-assigned"
                                checked={notificationSettings.ticketAssigned}
                                onCheckedChange={(checked) =>
                                  handleNotificationSettingsChange(
                                    "ticketAssigned",
                                    checked
                                  )
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label htmlFor="ticket-resolved">
                                Ticket Resolved
                              </Label>
                              <Switch
                                id="ticket-resolved"
                                checked={notificationSettings.ticketResolved}
                                onCheckedChange={(checked) =>
                                  handleNotificationSettingsChange(
                                    "ticketResolved",
                                    checked
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium mb-4">
                            Digest Settings
                          </h3>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="daily-digest">Daily Digest</Label>
                              <Switch
                                id="daily-digest"
                                checked={notificationSettings.dailyDigest}
                                onCheckedChange={(checked) =>
                                  handleNotificationSettingsChange(
                                    "dailyDigest",
                                    checked
                                  )
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label htmlFor="weekly-report">
                                Weekly Report
                              </Label>
                              <Switch
                                id="weekly-report"
                                checked={notificationSettings.weeklyReport}
                                onCheckedChange={(checked) =>
                                  handleNotificationSettingsChange(
                                    "weeklyReport",
                                    checked
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={() =>
                            console.log(
                              "Notification settings saved",
                              notificationSettings
                            )
                          }
                        >
                          Save Notification Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="appearance">
                  <Card className="bg-gray-800/50 border-gray-700/50">
                    <CardHeader className="border-gray-700/50">
                      <CardTitle className="text-white">
                        Appearance Settings
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Customize the look and feel of the application
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="theme-select"
                            className="text-gray-300"
                          >
                            Theme
                          </Label>
                          <Select
                            value={appearanceSettings.theme}
                            onValueChange={(value) =>
                              handleAppearanceSettingsChange("theme", value)
                            }
                          >
                            <SelectTrigger
                              id="theme-select"
                              className="bg-gray-900/50 border-gray-700 text-white"
                            >
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="primary-color">Primary Color</Label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              id="primary-color"
                              value={appearanceSettings.primaryColor}
                              onChange={(e) =>
                                handleAppearanceSettingsChange(
                                  "primaryColor",
                                  e.target.value
                                )
                              }
                              className="w-10 h-10 rounded border border-gray-300 dark:border-gray-700"
                            />
                            <input
                              type="text"
                              value={appearanceSettings.primaryColor}
                              onChange={(e) =>
                                handleAppearanceSettingsChange(
                                  "primaryColor",
                                  e.target.value
                                )
                              }
                              className="flex-1 py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="accent-color">Accent Color</Label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              id="accent-color"
                              value={appearanceSettings.accentColor}
                              onChange={(e) =>
                                handleAppearanceSettingsChange(
                                  "accentColor",
                                  e.target.value
                                )
                              }
                              className="w-10 h-10 rounded border border-gray-300 dark:border-gray-700"
                            />
                            <input
                              type="text"
                              value={appearanceSettings.accentColor}
                              onChange={(e) =>
                                handleAppearanceSettingsChange(
                                  "accentColor",
                                  e.target.value
                                )
                              }
                              className="flex-1 py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label
                              htmlFor="sidebar-collapsed"
                              className="block"
                            >
                              Collapsed Sidebar by Default
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Start with a minimized sidebar
                            </p>
                          </div>
                          <Switch
                            id="sidebar-collapsed"
                            checked={appearanceSettings.sidebarCollapsed}
                            onCheckedChange={(checked) =>
                              handleAppearanceSettingsChange(
                                "sidebarCollapsed",
                                checked
                              )
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="dense-mode" className="block">
                              Dense Mode
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Compact UI with less whitespace
                            </p>
                          </div>
                          <Switch
                            id="dense-mode"
                            checked={appearanceSettings.denseMode}
                            onCheckedChange={(checked) =>
                              handleAppearanceSettingsChange(
                                "denseMode",
                                checked
                              )
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label
                              htmlFor="animations-enabled"
                              className="block"
                            >
                              Enable Animations
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Use motion animations throughout the UI
                            </p>
                          </div>
                          <Switch
                            id="animations-enabled"
                            checked={appearanceSettings.animationsEnabled}
                            onCheckedChange={(checked) =>
                              handleAppearanceSettingsChange(
                                "animationsEnabled",
                                checked
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={() =>
                            console.log(
                              "Appearance settings saved",
                              appearanceSettings
                            )
                          }
                        >
                          Save Appearance Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="system">
                  <Card className="bg-gray-800/50 border-gray-700/50">
                    <CardHeader className="border-gray-700/50">
                      <CardTitle className="text-white">
                        System Settings
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Configure technical system parameters
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <Label
                            htmlFor="max-file-upload"
                            className="mb-2 block"
                          >
                            Maximum File Upload Size:{" "}
                            {systemSettings.maxFileUploadSize} MB
                          </Label>
                          <Slider
                            id="max-file-upload"
                            min={1}
                            max={50}
                            step={1}
                            value={[systemSettings.maxFileUploadSize]}
                            onValueChange={(value) =>
                              handleSystemSettingsChange(
                                "maxFileUploadSize",
                                value[0]
                              )
                            }
                            className="w-full max-w-md"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="allowed-file-types">
                            Allowed File Types
                          </Label>
                          <input
                            id="allowed-file-types"
                            type="text"
                            value={systemSettings.allowedFileTypes}
                            onChange={(e) =>
                              handleSystemSettingsChange(
                                "allowedFileTypes",
                                e.target.value
                              )
                            }
                            className="w-full py-2 px-3 rounded-lg bg-gray-900/50 border border-gray-700 focus:border-blue-500 text-white"
                          />
                          <p className="text-sm text-gray-400">
                            Comma-separated list of file extensions (e.g.,
                            .jpg,.png,.pdf)
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="auto-logout" className="mb-2 block">
                            Auto Logout After Inactivity:{" "}
                            {systemSettings.autoLogout} minutes
                          </Label>
                          <Slider
                            id="auto-logout"
                            min={5}
                            max={120}
                            step={5}
                            value={[systemSettings.autoLogout]}
                            onValueChange={(value) =>
                              handleSystemSettingsChange("autoLogout", value[0])
                            }
                            className="w-full max-w-md"
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor="max-tickets-per-page"
                            className="mb-2 block"
                          >
                            Maximum Tickets Per Page:{" "}
                            {systemSettings.maxTicketsPerPage}
                          </Label>
                          <Slider
                            id="max-tickets-per-page"
                            min={10}
                            max={100}
                            step={5}
                            value={[systemSettings.maxTicketsPerPage]}
                            onValueChange={(value) =>
                              handleSystemSettingsChange(
                                "maxTicketsPerPage",
                                value[0]
                              )
                            }
                            className="w-full max-w-md"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label
                              htmlFor="enable-maintenance-mode"
                              className="block"
                            >
                              Maintenance Mode
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Put the system in maintenance mode
                            </p>
                          </div>
                          <Switch
                            id="enable-maintenance-mode"
                            checked={systemSettings.enableMaintenanceMode}
                            onCheckedChange={(checked) =>
                              handleSystemSettingsChange(
                                "enableMaintenanceMode",
                                checked
                              )
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label
                              htmlFor="enable-debug-mode"
                              className="block"
                            >
                              Debug Mode
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Enable detailed error messages and logging
                            </p>
                          </div>
                          <Switch
                            id="enable-debug-mode"
                            checked={systemSettings.enableDebugMode}
                            onCheckedChange={(checked) =>
                              handleSystemSettingsChange(
                                "enableDebugMode",
                                checked
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          onClick={() =>
                            console.log("System settings saved", systemSettings)
                          }
                        >
                          Save System Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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

export default SettingsPage;
