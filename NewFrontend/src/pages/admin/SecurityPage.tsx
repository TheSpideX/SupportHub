import React, { useState } from "react";
import {
  FaShieldAlt,
  FaLock,
  FaUserShield,
  FaKey,
  FaHistory,
  FaExclamationTriangle,
  FaToggleOn,
  FaToggleOff,
  FaInfoCircle,
  FaChartBar,
} from "react-icons/fa";
import EnhancedAdminPageTemplate from "@/components/dashboard/EnhancedAdminPageTemplate";
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
import { Badge } from "@/components/ui/badge";
import { InputField } from "@/components/ui/inputs/InputField";
import { Slider } from "@/components/ui/slider";

const SecurityPage: React.FC = () => {
  // State for security settings
  const [passwordPolicy, setPasswordPolicy] = useState({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    expiryDays: 90,
  });

  const [authSettings, setAuthSettings] = useState({
    twoFactorEnabled: true,
    sessionTimeout: 30, // minutes
    maxLoginAttempts: 5,
    lockoutDuration: 15, // minutes
  });

  const [accessControls, setAccessControls] = useState({
    ipRestriction: false,
    allowedIPs: "",
    deviceRestriction: true,
    geolocationRestriction: false,
  });

  // Sample security events
  const securityEvents = [
    {
      id: "1",
      type: "login_attempt",
      status: "failed",
      user: "john.doe@example.com",
      ip: "192.168.1.1",
      timestamp: "2023-10-16 14:30:22",
      details: "Invalid password (3rd attempt)",
    },
    {
      id: "2",
      type: "login_attempt",
      status: "success",
      user: "jane.smith@example.com",
      ip: "192.168.1.2",
      timestamp: "2023-10-16 14:25:10",
      details: "Successful login",
    },
    {
      id: "3",
      type: "password_reset",
      status: "success",
      user: "robert.johnson@example.com",
      ip: "192.168.1.3",
      timestamp: "2023-10-16 13:45:33",
      details: "Password reset completed",
    },
    {
      id: "4",
      type: "permission_change",
      status: "success",
      user: "admin@example.com",
      ip: "192.168.1.4",
      timestamp: "2023-10-16 12:30:15",
      details: "Changed permissions for user emily.davis@example.com",
    },
    {
      id: "5",
      type: "login_attempt",
      status: "failed",
      user: "unknown",
      ip: "203.0.113.1",
      timestamp: "2023-10-16 11:20:05",
      details: "User not found",
    },
  ];

  // Handle password policy changes
  const handlePasswordPolicyChange = (
    key: keyof typeof passwordPolicy,
    value: any
  ) => {
    setPasswordPolicy((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle auth settings changes
  const handleAuthSettingsChange = (
    key: keyof typeof authSettings,
    value: any
  ) => {
    setAuthSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle access control changes
  const handleAccessControlChange = (
    key: keyof typeof accessControls,
    value: any
  ) => {
    setAccessControls((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Get event type badge color
  const getEventTypeBadgeColor = (type: string) => {
    switch (type) {
      case "login_attempt":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "password_reset":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "permission_change":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get event status badge color
  const getEventStatusBadgeColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <EnhancedAdminPageTemplate
      title="Security Settings"
      description="Manage security and access control settings"
      icon={FaShieldAlt}
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Admin", href: "/admin" },
        { label: "Security", href: "/admin/security" },
      ]}
      actions={[
        {
          label: "Save Changes",
          onClick: () => console.log("Save security settings"),
          icon: FaLock,
        },
      ]}
    >
      <Tabs defaultValue="password-policy" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="password-policy">Password Policy</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="access-control">Access Control</TabsTrigger>
          <TabsTrigger value="security-log">Security Log</TabsTrigger>
        </TabsList>

        <TabsContent value="password-policy">
          <Card>
            <CardHeader>
              <CardTitle>Password Policy</CardTitle>
              <CardDescription>
                Configure password requirements and expiration settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="min-length" className="mb-2 block">
                    Minimum Password Length: {passwordPolicy.minLength}{" "}
                    characters
                  </Label>
                  <Slider
                    id="min-length"
                    min={6}
                    max={16}
                    step={1}
                    value={[passwordPolicy.minLength]}
                    onValueChange={(value) =>
                      handlePasswordPolicyChange("minLength", value[0])
                    }
                    className="w-full max-w-md"
                  />
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <Label htmlFor="require-uppercase">
                    Require uppercase letters
                  </Label>
                  <Switch
                    id="require-uppercase"
                    checked={passwordPolicy.requireUppercase}
                    onCheckedChange={(checked) =>
                      handlePasswordPolicyChange("requireUppercase", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <Label htmlFor="require-lowercase">
                    Require lowercase letters
                  </Label>
                  <Switch
                    id="require-lowercase"
                    checked={passwordPolicy.requireLowercase}
                    onCheckedChange={(checked) =>
                      handlePasswordPolicyChange("requireLowercase", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <Label htmlFor="require-numbers">Require numbers</Label>
                  <Switch
                    id="require-numbers"
                    checked={passwordPolicy.requireNumbers}
                    onCheckedChange={(checked) =>
                      handlePasswordPolicyChange("requireNumbers", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <Label htmlFor="require-special-chars">
                    Require special characters
                  </Label>
                  <Switch
                    id="require-special-chars"
                    checked={passwordPolicy.requireSpecialChars}
                    onCheckedChange={(checked) =>
                      handlePasswordPolicyChange("requireSpecialChars", checked)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="expiry-days" className="mb-2 block">
                    Password Expiry: {passwordPolicy.expiryDays} days
                  </Label>
                  <Slider
                    id="expiry-days"
                    min={30}
                    max={180}
                    step={15}
                    value={[passwordPolicy.expiryDays]}
                    onValueChange={(value) =>
                      handlePasswordPolicyChange("expiryDays", value[0])
                    }
                    className="w-full max-w-md"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() =>
                    console.log("Password policy saved", passwordPolicy)
                  }
                >
                  Save Password Policy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authentication">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Settings</CardTitle>
              <CardDescription>
                Configure two-factor authentication and session settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between max-w-md">
                  <div>
                    <Label htmlFor="two-factor-auth" className="block">
                      Two-Factor Authentication
                    </Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Require two-factor authentication for all users
                    </p>
                  </div>
                  <Switch
                    id="two-factor-auth"
                    checked={authSettings.twoFactorEnabled}
                    onCheckedChange={(checked) =>
                      handleAuthSettingsChange("twoFactorEnabled", checked)
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="session-timeout" className="mb-2 block">
                    Session Timeout: {authSettings.sessionTimeout} minutes
                  </Label>
                  <Slider
                    id="session-timeout"
                    min={5}
                    max={120}
                    step={5}
                    value={[authSettings.sessionTimeout]}
                    onValueChange={(value) =>
                      handleAuthSettingsChange("sessionTimeout", value[0])
                    }
                    className="w-full max-w-md"
                  />
                </div>

                <div>
                  <Label htmlFor="max-login-attempts" className="mb-2 block">
                    Maximum Login Attempts: {authSettings.maxLoginAttempts}
                  </Label>
                  <Slider
                    id="max-login-attempts"
                    min={3}
                    max={10}
                    step={1}
                    value={[authSettings.maxLoginAttempts]}
                    onValueChange={(value) =>
                      handleAuthSettingsChange("maxLoginAttempts", value[0])
                    }
                    className="w-full max-w-md"
                  />
                </div>

                <div>
                  <Label htmlFor="lockout-duration" className="mb-2 block">
                    Account Lockout Duration: {authSettings.lockoutDuration}{" "}
                    minutes
                  </Label>
                  <Slider
                    id="lockout-duration"
                    min={5}
                    max={60}
                    step={5}
                    value={[authSettings.lockoutDuration]}
                    onValueChange={(value) =>
                      handleAuthSettingsChange("lockoutDuration", value[0])
                    }
                    className="w-full max-w-md"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() =>
                    console.log("Auth settings saved", authSettings)
                  }
                >
                  Save Authentication Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access-control">
          <Card>
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
              <CardDescription>
                Configure IP restrictions and device management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between max-w-md">
                  <div>
                    <Label htmlFor="ip-restriction" className="block">
                      IP Address Restriction
                    </Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Limit access to specific IP addresses
                    </p>
                  </div>
                  <Switch
                    id="ip-restriction"
                    checked={accessControls.ipRestriction}
                    onCheckedChange={(checked) =>
                      handleAccessControlChange("ipRestriction", checked)
                    }
                  />
                </div>

                {accessControls.ipRestriction && (
                  <div>
                    <Label htmlFor="allowed-ips" className="mb-2 block">
                      Allowed IP Addresses
                    </Label>
                    <InputField
                      id="allowed-ips"
                      placeholder="e.g. 192.168.1.1, 10.0.0.0/24"
                      value={accessControls.allowedIPs}
                      onChange={(e) =>
                        handleAccessControlChange("allowedIPs", e.target.value)
                      }
                      className="max-w-md"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Enter IP addresses or CIDR ranges, separated by commas
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between max-w-md">
                  <div>
                    <Label htmlFor="device-restriction" className="block">
                      Device Restriction
                    </Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Limit access to registered devices only
                    </p>
                  </div>
                  <Switch
                    id="device-restriction"
                    checked={accessControls.deviceRestriction}
                    onCheckedChange={(checked) =>
                      handleAccessControlChange("deviceRestriction", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between max-w-md">
                  <div>
                    <Label htmlFor="geolocation-restriction" className="block">
                      Geolocation Restriction
                    </Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Limit access based on geographic location
                    </p>
                  </div>
                  <Switch
                    id="geolocation-restriction"
                    checked={accessControls.geolocationRestriction}
                    onCheckedChange={(checked) =>
                      handleAccessControlChange(
                        "geolocationRestriction",
                        checked
                      )
                    }
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() =>
                    console.log("Access controls saved", accessControls)
                  }
                >
                  Save Access Controls
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security-log">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Security Log</CardTitle>
                <CardDescription>
                  View recent security events and activities
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                Export Log
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                      <th className="px-4 py-3 rounded-tl-lg font-medium">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 font-medium">Event Type</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">IP Address</th>
                      <th className="px-4 py-3 rounded-tr-lg font-medium">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-4 py-3 text-sm">{event.timestamp}</td>
                        <td className="px-4 py-3">
                          <Badge className={getEventTypeBadgeColor(event.type)}>
                            {event.type
                              .split("_")
                              .map(
                                (word) =>
                                  word.charAt(0).toUpperCase() + word.slice(1)
                              )
                              .join(" ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={getEventStatusBadgeColor(event.status)}
                          >
                            {event.status.charAt(0).toUpperCase() +
                              event.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{event.user}</td>
                        <td className="px-4 py-3 text-sm">{event.ip}</td>
                        <td className="px-4 py-3 text-sm">{event.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </EnhancedAdminPageTemplate>
  );
};

export default SecurityPage;
