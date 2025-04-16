import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  profileApi,
  Session,
  ActivityEvent,
  SecuritySettings,
  UserPreferences,
} from "../api/profileApi";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface ProfileData {
  // Sessions
  activeSessions: Session[];
  isLoadingSessions: boolean;
  errorSessions: Error | null;

  // Activity
  recentActivity: ActivityEvent[];
  isLoadingActivity: boolean;
  errorActivity: Error | null;

  // Security Settings
  securitySettings: SecuritySettings | null;
  isLoadingSecuritySettings: boolean;
  errorSecuritySettings: Error | null;

  // Preferences
  preferences: UserPreferences | null;
  isLoadingPreferences: boolean;
  errorPreferences: Error | null;

  // Two-factor authentication
  twoFactorEnabled: boolean;
  twoFactorQrCode: string | null;
  twoFactorSecret: string | null;
  isLoading2FA: boolean;
  error2FA: Error | null;

  // Methods
  refreshSessions: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  refreshSecuritySettings: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
  terminateSession: (sessionId: string) => Promise<void>;
  terminateAllOtherSessions: () => Promise<void>;
  updateSecuritySettings: (
    settings: Partial<SecuritySettings>
  ) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  setup2FA: () => Promise<void>;
  verify2FASetup: (token: string) => Promise<boolean>;
  disable2FA: (token: string) => Promise<boolean>;
}

export const useProfileData = (): ProfileData => {
  const { user } = useAuth();

  // Sessions state
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [errorSessions, setErrorSessions] = useState<Error | null>(null);

  // Activity state
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [errorActivity, setErrorActivity] = useState<Error | null>(null);

  // Security Settings state
  const [securitySettings, setSecuritySettings] =
    useState<SecuritySettings | null>(null);
  const [isLoadingSecuritySettings, setIsLoadingSecuritySettings] =
    useState(false);
  const [errorSecuritySettings, setErrorSecuritySettings] =
    useState<Error | null>(null);

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [errorPreferences, setErrorPreferences] = useState<Error | null>(null);

  // Two-factor authentication state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorQrCode, setTwoFactorQrCode] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [isLoading2FA, setIsLoading2FA] = useState(false);
  const [error2FA, setError2FA] = useState<Error | null>(null);

  // Fetch active sessions
  const refreshSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setErrorSessions(null);

    try {
      const sessions = await profileApi.getActiveSessions();
      setActiveSessions(sessions);
    } catch (error) {
      setErrorSessions(error as Error);
      console.error("Error fetching sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // Fetch recent activity
  const refreshActivity = useCallback(async () => {
    setIsLoadingActivity(true);
    setErrorActivity(null);

    try {
      const activity = await profileApi.getRecentActivity();
      setRecentActivity(activity);
    } catch (error) {
      setErrorActivity(error as Error);
      console.error("Error fetching activity:", error);
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  // Fetch security settings
  const refreshSecuritySettings = useCallback(async () => {
    setIsLoadingSecuritySettings(true);
    setErrorSecuritySettings(null);

    try {
      const settings = await profileApi.getSecuritySettings();
      setSecuritySettings(settings);
      setTwoFactorEnabled(settings.twoFactorMethod !== "none");
    } catch (error) {
      setErrorSecuritySettings(error as Error);
      console.error("Error fetching security settings:", error);
    } finally {
      setIsLoadingSecuritySettings(false);
    }
  }, []);

  // Fetch user preferences
  const refreshPreferences = useCallback(async () => {
    setIsLoadingPreferences(true);
    setErrorPreferences(null);

    try {
      const prefs = await profileApi.getUserPreferences();
      setPreferences(prefs);
    } catch (error) {
      setErrorPreferences(error as Error);
      console.error("Error fetching preferences:", error);
    } finally {
      setIsLoadingPreferences(false);
    }
  }, []);

  // Terminate session
  const terminateSession = useCallback(
    async (sessionId: string) => {
      try {
        await profileApi.terminateSession(sessionId);
        toast.success("Session terminated successfully");
        await refreshSessions();
      } catch (error) {
        toast.error("Failed to terminate session");
        console.error("Error terminating session:", error);
      }
    },
    [refreshSessions]
  );

  // Terminate all other sessions
  const terminateAllOtherSessions = useCallback(async () => {
    try {
      await profileApi.terminateAllOtherSessions();
      toast.success("All other sessions terminated successfully");
      await refreshSessions();
    } catch (error) {
      toast.error("Failed to terminate all sessions");
      console.error("Error terminating all sessions:", error);
    }
  }, [refreshSessions]);

  // Update security settings
  const updateSecuritySettings = useCallback(
    async (settings: Partial<SecuritySettings>) => {
      try {
        const updatedSettings = await profileApi.updateSecuritySettings(
          settings
        );
        setSecuritySettings(updatedSettings);
        setTwoFactorEnabled(updatedSettings.twoFactorMethod !== "none");
        toast.success("Security settings updated successfully");
      } catch (error) {
        toast.error("Failed to update security settings");
        console.error("Error updating security settings:", error);
      }
    },
    []
  );

  // Update preferences
  const updatePreferences = useCallback(
    async (prefs: Partial<UserPreferences>) => {
      try {
        const updatedPreferences = await profileApi.updateUserPreferences(
          prefs
        );
        setPreferences(updatedPreferences);
        toast.success("Preferences updated successfully");
      } catch (error) {
        toast.error("Failed to update preferences");
        console.error("Error updating preferences:", error);
      }
    },
    []
  );

  // Setup 2FA
  const setup2FA = useCallback(async () => {
    setIsLoading2FA(true);
    setError2FA(null);

    try {
      const { qrCode, secret } = await profileApi.setup2FA();
      setTwoFactorQrCode(qrCode);
      setTwoFactorSecret(secret);
    } catch (error) {
      setError2FA(error as Error);
      toast.error("Failed to setup two-factor authentication");
      console.error("Error setting up 2FA:", error);
    } finally {
      setIsLoading2FA(false);
    }
  }, []);

  // Verify 2FA setup
  const verify2FASetup = useCallback(
    async (token: string) => {
      setIsLoading2FA(true);
      setError2FA(null);

      try {
        const { success } = await profileApi.verify2FASetup(token);
        if (success) {
          setTwoFactorEnabled(true);
          setTwoFactorQrCode(null);
          setTwoFactorSecret(null);
          toast.success("Two-factor authentication enabled successfully");
          await refreshSecuritySettings();
        }
        return success;
      } catch (error) {
        setError2FA(error as Error);
        toast.error("Failed to verify two-factor authentication");
        console.error("Error verifying 2FA setup:", error);
        return false;
      } finally {
        setIsLoading2FA(false);
      }
    },
    [refreshSecuritySettings]
  );

  // Disable 2FA
  const disable2FA = useCallback(
    async (token: string) => {
      setIsLoading2FA(true);
      setError2FA(null);

      try {
        const { success } = await profileApi.disable2FA(token);
        if (success) {
          setTwoFactorEnabled(false);
          toast.success("Two-factor authentication disabled successfully");
          await refreshSecuritySettings();
        }
        return success;
      } catch (error) {
        setError2FA(error as Error);
        toast.error("Failed to disable two-factor authentication");
        console.error("Error disabling 2FA:", error);
        return false;
      } finally {
        setIsLoading2FA(false);
      }
    },
    [refreshSecuritySettings]
  );

  // We're not loading data automatically on mount anymore
  // Data will only be loaded when the profile page is visited
  // and the respective refresh functions are called

  return {
    // Sessions
    activeSessions,
    isLoadingSessions,
    errorSessions,

    // Activity
    recentActivity,
    isLoadingActivity,
    errorActivity,

    // Security Settings
    securitySettings,
    isLoadingSecuritySettings,
    errorSecuritySettings,

    // Preferences
    preferences,
    isLoadingPreferences,
    errorPreferences,

    // Two-factor authentication
    twoFactorEnabled,
    twoFactorQrCode,
    twoFactorSecret,
    isLoading2FA,
    error2FA,

    // Methods
    refreshSessions,
    refreshActivity,
    refreshSecuritySettings,
    refreshPreferences,
    terminateSession,
    terminateAllOtherSessions,
    updateSecuritySettings,
    updatePreferences,
    setup2FA,
    verify2FASetup,
    disable2FA,
  };
};
