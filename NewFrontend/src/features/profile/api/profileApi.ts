import { apiClient } from "@/api/apiClient";
import { API_ROUTES } from "@/config/routes";

// Types
export interface Session {
  id: string;
  deviceName: string;
  deviceType: string;
  location: string;
  lastActive: string;
  current: boolean;
  browser?: string;
  os?: string;
  ip?: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  action: string;
  device: string;
  location: string;
  time: string;
  timestamp: string;
  ip?: string;
  metadata?: any;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  suspiciousActivityDetection: boolean;
  securityLevel: "low" | "medium" | "high";
  twoFactorMethod: "none" | "app" | "sms" | "email";
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: string;
  notifications: {
    email: boolean;
    browser: boolean;
    activityAlerts: boolean;
    marketingEmails: boolean;
    securityAlerts: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    largeText: boolean;
  };
}

// API functions
export const profileApi = {
  // Get active sessions
  getActiveSessions: async (): Promise<Session[]> => {
    try {
      const response = await apiClient.get(API_ROUTES.AUTH.ACTIVE_SESSIONS);
      return response.data.data.sessions;
    } catch (error) {
      console.error("Error fetching active sessions:", error);
      throw error;
    }
  },

  // Terminate session
  terminateSession: async (sessionId: string): Promise<void> => {
    try {
      await apiClient.delete(API_ROUTES.AUTH.TERMINATE_SESSION(sessionId));
    } catch (error) {
      console.error("Error terminating session:", error);
      throw error;
    }
  },

  // Terminate all other sessions
  terminateAllOtherSessions: async (): Promise<void> => {
    try {
      await apiClient.post(API_ROUTES.AUTH.TERMINATE_ALL_SESSIONS);
    } catch (error) {
      console.error("Error terminating all sessions:", error);
      throw error;
    }
  },

  // Get security settings
  getSecuritySettings: async (): Promise<SecuritySettings> => {
    try {
      const response = await apiClient.get(API_ROUTES.AUTH.SECURITY_SETTINGS);
      return response.data.data.settings;
    } catch (error) {
      console.error("Error fetching security settings:", error);
      throw error;
    }
  },

  // Update security settings
  updateSecuritySettings: async (settings: Partial<SecuritySettings>): Promise<SecuritySettings> => {
    try {
      const response = await apiClient.put(API_ROUTES.AUTH.SECURITY_SETTINGS, settings);
      return response.data.data.settings;
    } catch (error) {
      console.error("Error updating security settings:", error);
      throw error;
    }
  },

  // Get user preferences
  getUserPreferences: async (): Promise<UserPreferences> => {
    try {
      const response = await apiClient.get(API_ROUTES.AUTH.GET_PREFERENCES);
      return response.data.data.preferences;
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      throw error;
    }
  },

  // Update user preferences
  updateUserPreferences: async (preferences: Partial<UserPreferences>): Promise<UserPreferences> => {
    try {
      const response = await apiClient.put(API_ROUTES.AUTH.UPDATE_PREFERENCES, { preferences });
      return response.data.data.preferences;
    } catch (error) {
      console.error("Error updating user preferences:", error);
      throw error;
    }
  },

  // Get recent activity
  getRecentActivity: async (): Promise<ActivityEvent[]> => {
    try {
      const response = await apiClient.get('/api/auth/security/events');
      return response.data.data.events;
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      throw error;
    }
  },

  // Setup 2FA
  setup2FA: async (): Promise<{ qrCode: string; secret: string }> => {
    try {
      const response = await apiClient.post(API_ROUTES.AUTH.SETUP_2FA);
      return response.data.data;
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      throw error;
    }
  },

  // Verify 2FA setup
  verify2FASetup: async (token: string): Promise<{ success: boolean }> => {
    try {
      const response = await apiClient.post(API_ROUTES.AUTH.VERIFY_2FA_SETUP, { token });
      return response.data;
    } catch (error) {
      console.error("Error verifying 2FA setup:", error);
      throw error;
    }
  },

  // Disable 2FA
  disable2FA: async (token: string): Promise<{ success: boolean }> => {
    try {
      const response = await apiClient.post(API_ROUTES.AUTH.DISABLE_2FA, { token });
      return response.data;
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      throw error;
    }
  },

  // Generate backup codes
  generateBackupCodes: async (): Promise<string[]> => {
    try {
      const response = await apiClient.post(API_ROUTES.AUTH.GENERATE_BACKUP_CODES);
      return response.data.data.backupCodes;
    } catch (error) {
      console.error("Error generating backup codes:", error);
      throw error;
    }
  },

  // Update profile
  updateProfile: async (profileData: any): Promise<any> => {
    try {
      const response = await apiClient.put(API_ROUTES.AUTH.UPDATE_PROFILE, profileData);
      return response.data.data;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
    try {
      const response = await apiClient.put(API_ROUTES.AUTH.CHANGE_PASSWORD, {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      console.error("Error changing password:", error);
      throw error;
    }
  },

  // Upload avatar
  uploadAvatar: async (avatarFile: File): Promise<{ success: boolean; avatarUrl: string }> => {
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const response = await apiClient.post("/api/auth/user/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      throw error;
    }
  },

  // Delete avatar
  deleteAvatar: async (): Promise<{ success: boolean }> => {
    try {
      const response = await apiClient.delete("/api/auth/user/avatar");
      return response.data;
    } catch (error) {
      console.error("Error deleting avatar:", error);
      throw error;
    }
  },
};
