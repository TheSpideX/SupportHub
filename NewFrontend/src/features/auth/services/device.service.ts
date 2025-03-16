import { logger } from '@/utils/logger';
import { secureGet, secureSet, secureClear } from '../utils/auth-storage';
import { AuthError } from '../errors/auth-error';
import { AuthApi } from '../api/auth-api';
// import { v4 as uuidv4 } from "uuid";

// Simple UUID v4 implementation
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Define interfaces
export interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  language: string;
  colorDepth?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  touchSupport?: boolean;
  webglInfo?: string;
  timestamp?: string;
}

export interface TrustedDevice {
  id: string;
  fingerprint: string;
  name: string;
  userAgent: string;
  trusted: boolean;
  lastUsed: number;
  createdAt: number;
  verifiedAt?: number;
  trustExpiration?: number;
}

export interface DeviceVerificationStatus {
  required: boolean;
  verified: boolean;
  method?: 'email' | 'sms';
  expiresAt?: number;
  deviceId?: string;
}

export class DeviceService {
  private readonly COMPONENT = 'DeviceService';
  private readonly DEVICE_INFO_KEY = 'device_info';
  private readonly DEVICE_FINGERPRINT_KEY = 'device_fingerprint';
  private readonly TRUSTED_DEVICES_KEY = 'trusted_devices';
  private readonly VERIFICATION_STATUS_KEY = 'device_verification_status';
  private readonly TRUST_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

  private deviceInfo: DeviceInfo | null = null;
  private verificationStatus: DeviceVerificationStatus | null = null;
  private fingerprintCache: string | null = null;

  constructor() {
    this.loadVerificationStatus();
    this.cleanupExpiredDevices();
    
    // Log initialization
    logger.debug('Device service initialized', {
      component: this.COMPONENT,
      action: 'constructor'
    });
  }

  /**
   * Load verification status from storage
   */
  private loadVerificationStatus(): void {
    try {
      this.verificationStatus = secureGet<DeviceVerificationStatus>(this.VERIFICATION_STATUS_KEY);
    } catch (error) {
      logger.error('Failed to load verification status', {
        component: this.COMPONENT,
        action: 'loadVerificationStatus',
        error
      });
    }
  }

  /**
   * Get complete device information including fingerprint
   */
  public async getDeviceInfo(forceRefresh = false): Promise<DeviceInfo> {
    try {
      // Return cached info if available and not forcing refresh
      if (this.deviceInfo && !forceRefresh) {
        return this.deviceInfo;
      }

      // Try to load cached device info from storage if not forcing refresh
      if (!forceRefresh) {
        try {
          const cachedInfo = secureGet<DeviceInfo>(this.DEVICE_INFO_KEY);
          if (cachedInfo) {
            this.deviceInfo = cachedInfo;
            return cachedInfo;
          }
        } catch (storageError) {
          logger.warn('Failed to load cached device info', {
            component: this.COMPONENT,
            action: 'getDeviceInfo',
            error: storageError
          });
        }
      }

      // Generate fingerprint
      let fingerprint;
      try {
        fingerprint = await this.generateFingerprint();
      } catch (fingerprintError) {
        logger.error('Error generating device info', {
          component: this.COMPONENT,
          action: 'getDeviceInfo',
          error: fingerprintError
        });
        fingerprint = this.generateBasicFingerprint();
      }
      
      // Safely get navigator properties
      const userAgent = navigator?.userAgent || 'unknown';
      const platform = navigator?.platform || 'unknown';
      const language = navigator?.language || 'unknown';
      
      // Safely get screen properties
      const screenWidth = window?.screen?.width || 0;
      const screenHeight = window?.screen?.height || 0;
      const screenResolution = `${screenWidth}x${screenHeight}`;
      const colorDepth = window?.screen?.colorDepth;
      
      // Safely get hardware info
      const hardwareConcurrency = navigator?.hardwareConcurrency;
      const deviceMemory = (navigator as any)?.deviceMemory;
      const touchSupport = 'ontouchstart' in window;
      
      // Safely get timezone
      let timezone = 'unknown';
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
      } catch (timezoneError) {
        logger.warn('Failed to get timezone', {
          component: this.COMPONENT,
          action: 'getDeviceInfo',
          error: timezoneError
        });
      }
      
      // Create device info
      const deviceInfo: DeviceInfo = {
        fingerprint,
        userAgent,
        platform,
        screenResolution,
        timezone,
        language,
        colorDepth,
        hardwareConcurrency,
        deviceMemory,
        touchSupport,
        timestamp: new Date().toISOString()
      };
      
      // Cache device info
      this.deviceInfo = deviceInfo;
      try {
        secureSet(this.DEVICE_INFO_KEY, deviceInfo);
      } catch (cacheError) {
        logger.warn('Failed to cache device info', {
          component: this.COMPONENT,
          action: 'getDeviceInfo',
          error: cacheError
        });
      }
      
      return deviceInfo;
    } catch (error) {
      logger.error('Failed to get device info', {
        component: this.COMPONENT,
        action: 'getDeviceInfo',
        error
      });
      
      // Return basic fallback info
      return {
        fingerprint: this.simpleHash(Date.now().toString()),
        userAgent: navigator?.userAgent || 'unknown',
        platform: navigator?.platform || 'unknown',
        screenResolution: '0x0',
        timezone: 'unknown',
        language: 'unknown'
      };
    }
  }

  /**
   * Generate a device fingerprint
   */
  private async generateFingerprint(): Promise<string> {
    try {
      // Check cache first
      if (this.fingerprintCache) {
        return this.fingerprintCache;
      }
      
      // Try to get from storage
      try {
        const storedFingerprint = secureGet<string>(this.DEVICE_FINGERPRINT_KEY);
        if (storedFingerprint) {
          this.fingerprintCache = storedFingerprint;
          return storedFingerprint;
        }
      } catch (storageError) {
        logger.warn('Failed to retrieve stored fingerprint', {
          component: this.COMPONENT,
          action: 'generateFingerprint',
          error: storageError
        });
      }
      
      // Collect browser information
      const userAgent = navigator?.userAgent || '';
      const platform = navigator?.platform || '';
      const screenWidth = window?.screen?.width || 0;
      const screenHeight = window?.screen?.height || 0;
      const colorDepth = window?.screen?.colorDepth || 0;
      const timezone = new Date().getTimezoneOffset();
      const language = navigator?.language || '';
      const hardwareConcurrency = navigator?.hardwareConcurrency || 0;
      const deviceMemory = (navigator as any)?.deviceMemory || 0;
      const touchSupport = 'ontouchstart' in window ? 1 : 0;
      
      // Get canvas fingerprint
      let canvasFingerprint = '';
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 200;
          canvas.height = 50;
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillStyle = '#f60';
          ctx.fillRect(10, 10, 100, 30);
          ctx.fillStyle = '#069';
          ctx.fillText('Fingerprint', 2, 15);
          canvasFingerprint = canvas.toDataURL().slice(0, 100);
        }
      } catch (canvasError) {
        logger.warn('Failed to get canvas fingerprint', {
          component: this.COMPONENT,
          action: 'generateFingerprint',
          error: canvasError
        });
      }
      
      // Combine values and create a hash
      const values = [
        userAgent,
        platform,
        `${screenWidth}x${screenHeight}`,
        colorDepth,
        timezone,
        language,
        hardwareConcurrency,
        deviceMemory,
        touchSupport,
        canvasFingerprint,
        // Add a unique component to reduce collision risk
        uuidv4().slice(0, 8)
      ].join('|');
      
      const fingerprint = this.simpleHash(values);
      
      // Store the fingerprint
      try {
        secureSet(this.DEVICE_FINGERPRINT_KEY, fingerprint);
        this.fingerprintCache = fingerprint;
      } catch (storageError) {
        logger.warn('Failed to store fingerprint', {
          component: this.COMPONENT,
          action: 'generateFingerprint',
          error: storageError
        });
      }
      
      return fingerprint;
    } catch (error) {
      logger.error('Error generating device fingerprint', {
        component: this.COMPONENT,
        action: 'generateFingerprint',
        error
      });
      return this.generateBasicFingerprint();
    }
  }

  /**
   * Generate a basic fingerprint as fallback
   */
  private generateBasicFingerprint(): string {
    try {
      const userAgent = navigator?.userAgent || 'unknown';
      const platform = navigator?.platform || 'unknown';
      const now = Date.now().toString();
      const random = Math.random().toString(36).substring(2);
      
      return this.simpleHash(`${userAgent}|${platform}|${now}|${random}`);
    } catch (error) {
      logger.error('Failed to generate basic fingerprint', {
        component: this.COMPONENT,
        action: 'generateBasicFingerprint',
        error
      });
      
      // Ultimate fallback
      return this.simpleHash(Date.now().toString() + Math.random().toString());
    }
  }

  /**
   * Simple hash function for strings
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * Store device information on the server
   */
  public async storeDeviceInfo(userId?: string): Promise<void> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      // Only store on server if we have a user ID
      if (userId) {
        await AuthApi.storeDeviceInfo({
          userId,
          deviceInfo
        });
        
        logger.debug('Device info stored on server', {
          component: this.COMPONENT,
          action: 'storeDeviceInfo'
        });
      }
    } catch (error) {
      logger.error('Failed to store device info', {
        component: this.COMPONENT,
        action: 'storeDeviceInfo',
        error
      });
    }
  }

  /**
   * Trust the current device
   */
  public async trustCurrentDevice(name?: string): Promise<TrustedDevice | null> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      return this.trustDevice(deviceInfo.fingerprint, name);
    } catch (error) {
      logger.error('Failed to trust current device', {
        component: this.COMPONENT,
        action: 'trustCurrentDevice',
        error
      });
      return null;
    }
  }

  /**
   * Trust a specific device
   */
  public trustDevice(fingerprint: string, name?: string): TrustedDevice {
    try {
      const trustedDevices = this.getTrustedDevices();
      const now = Date.now();
      const trustExpiration = now + this.TRUST_DURATION;
      let device: TrustedDevice;
      
      // Get device info for additional data
      const deviceInfo = this.deviceInfo || {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        fingerprint
      };
      
      // Check if device already exists
      const existingIndex = trustedDevices.findIndex(d => d.fingerprint === fingerprint);
      
      if (existingIndex >= 0) {
        // Update existing device
        device = {
          ...trustedDevices[existingIndex],
          trustExpiration,
          lastUsed: now,
          trusted: true,
          name: name || trustedDevices[existingIndex].name
        };
        trustedDevices[existingIndex] = device;
      } else {
        // Add new trusted device
        device = {
          id: this.generateDeviceId(),
          fingerprint,
          trustExpiration,
          lastUsed: now,
          trusted: true,
          name: name || `Device ${new Date().toLocaleDateString()}`,
          userAgent: deviceInfo.userAgent,
          createdAt: now,
          verifiedAt: now
        };
        trustedDevices.push(device);
      }

      secureSet(this.TRUSTED_DEVICES_KEY, trustedDevices);
      
      // Update verification status
      if (this.verificationStatus) {
        this.verificationStatus.verified = true;
        this.verificationStatus.deviceId = device.id;
        secureSet(this.VERIFICATION_STATUS_KEY, this.verificationStatus);
      }
      
      // Sync with backend if possible
      this.syncDeviceWithBackend(device);
      
      logger.debug('Device trusted', {
        component: this.COMPONENT,
        action: 'trustDevice'
      });
      
      return device;
    } catch (error) {
      logger.error('Failed to trust device', {
        component: this.COMPONENT,
        action: 'trustDevice',
        error
      });
      throw new AuthError('DEVICE_TRUST_FAILED', 'Failed to trust device');
    }
  }

  /**
   * Sync device trust status with backend
   */
  private async syncDeviceWithBackend(device: TrustedDevice): Promise<void> {
    try {
      // Get current user ID from auth service or similar
      const userId = this.getCurrentUserId();
      if (!userId) {
        return; // Can't sync without user ID
      }
      
      await AuthApi.trustDevice({
        userId,
        deviceInfo: {
          fingerprint: device.fingerprint,
          userAgent: device.userAgent,
          name: device.name
        }
      });
      
      logger.debug('Device synced with backend', {
        component: this.COMPONENT,
        action: 'syncDeviceWithBackend'
      });
    } catch (error) {
      logger.error('Failed to sync device with backend', {
        component: this.COMPONENT,
        action: 'syncDeviceWithBackend',
        error
      });
      // Continue even if sync fails - local trust is still valid
    }
  }

  /**
   * Get current user ID (implement based on your auth system)
   */
  private getCurrentUserId(): string | null {
    try {
      // This is a placeholder - implement based on your auth system
      // For example, get from auth service or JWT token
      const authData = secureGet('auth_data');
      return authData?.userId || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    return uuidv4();
  }

  /**
   * Get all trusted devices
   */
  public getTrustedDevices(): TrustedDevice[] {
    try {
      const devices = secureGet<TrustedDevice[]>(this.TRUSTED_DEVICES_KEY) || [];
      return devices;
    } catch (error) {
      logger.error('Failed to get trusted devices', {
        component: this.COMPONENT,
        action: 'getTrustedDevices',
        error
      });
      return [];
    }
  }

  /**
   * Get current device
   */
  public async getCurrentDevice(): Promise<TrustedDevice | null> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      const trustedDevices = this.getTrustedDevices();
      
      return trustedDevices.find(d => d.fingerprint === deviceInfo.fingerprint) || null;
    } catch (error) {
      logger.error('Failed to get current device', {
        component: this.COMPONENT,
        action: 'getCurrentDevice',
        error
      });
      return null;
    }
  }

  /**
   * Untrust a device
   */
  public async untrustDevice(deviceId: string): Promise<boolean> {
    try {
      const trustedDevices = this.getTrustedDevices();
      const deviceIndex = trustedDevices.findIndex(d => d.id === deviceId);
      
      if (deviceIndex >= 0) {
        const device = trustedDevices[deviceIndex];
        device.trusted = false;
        trustedDevices[deviceIndex] = device;
        secureSet(this.TRUSTED_DEVICES_KEY, trustedDevices);
        
        // Sync with backend
        try {
          const userId = this.getCurrentUserId();
          if (userId) {
            await AuthApi.untrustDevice({
              userId,
              fingerprint: device.fingerprint
            });
          }
        } catch (syncError) {
          logger.warn('Failed to sync untrust with backend', {
            component: this.COMPONENT,
            action: 'untrustDevice',
            error: syncError
          });
        }
        
        logger.debug('Device untrusted', {
          component: this.COMPONENT,
          action: 'untrustDevice',
          deviceId
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to untrust device', {
        component: this.COMPONENT,
        action: 'untrustDevice',
        error
      });
      return false;
    }
  }

  /**
   * Remove a device from trusted devices
   */
  public async removeDevice(deviceId: string): Promise<boolean> {
    try {
      let trustedDevices = this.getTrustedDevices();
      const deviceToRemove = trustedDevices.find(d => d.id === deviceId);
      
      if (!deviceToRemove) {
        return false;
      }
      
      const initialCount = trustedDevices.length;
      trustedDevices = trustedDevices.filter(d => d.id !== deviceId);
      
      if (trustedDevices.length !== initialCount) {
        secureSet(this.TRUSTED_DEVICES_KEY, trustedDevices);
        
        // Sync with backend
        try {
          const userId = this.getCurrentUserId();
          if (userId) {
            await AuthApi.untrustDevice({
              userId,
              fingerprint: deviceToRemove.fingerprint
            });
          }
        } catch (syncError) {
          logger.warn('Failed to sync device removal with backend', {
            component: this.COMPONENT,
            action: 'removeDevice',
            error: syncError
          });
        }
        
        logger.debug('Device removed', {
          component: this.COMPONENT,
          action: 'removeDevice',
          deviceId
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to remove device', {
        component: this.COMPONENT,
        action: 'removeDevice',
        error
      });
      return false;
    }
  }

  /**
   * Clean up expired trusted devices
   */
  public cleanupExpiredDevices(): void {
    try {
      const trustedDevices = this.getTrustedDevices();
      const now = Date.now();
      
      const validDevices = trustedDevices.filter(d => !d.trustExpiration || d.trustExpiration > now);
      
      if (validDevices.length !== trustedDevices.length) {
        secureSet(this.TRUSTED_DEVICES_KEY, validDevices);
        
        logger.debug('Expired devices cleaned up', {
          component: this.COMPONENT,
          action: 'cleanupExpiredDevices',
          removed: trustedDevices.length - validDevices.length
        });
      }
    } catch (error) {
      logger.error('Failed to clean up expired devices', {
        component: this.COMPONENT,
        action: 'cleanupExpiredDevices',
        error
      });
    }
  }

  /**
   * Check if a device is known (has been seen before)
   */
  public async isKnownDevice(): Promise<boolean> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      const trustedDevices = this.getTrustedDevices();
      
      return trustedDevices.some(d => d.fingerprint === deviceInfo.fingerprint);
    } catch (error) {
      logger.error('Failed to check if device is known', {
        component: this.COMPONENT,
        action: 'isKnownDevice',
        error
      });
      return false;
    }
  }

  /**
   * Check if current device is trusted
   */
  public async isCurrentDeviceTrusted(): Promise<boolean> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      const trustedDevices = this.getTrustedDevices();
      
      const device = trustedDevices.find(d => d.fingerprint === deviceInfo.fingerprint);
      if (!device) return false;
      
      // Check if device is trusted and not expired
      return device.trusted && (!device.trustExpiration || device.trustExpiration > Date.now());
    } catch (error) {
      logger.error('Failed to check if device is trusted', {
        component: this.COMPONENT,
        action: 'isCurrentDeviceTrusted',
        error
      });
      return false;
    }
  }

  /**
   * Verify device trust status with backend
   */
  public async verifyDeviceTrustWithBackend(userId: string): Promise<boolean> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      const response = await AuthApi.isDeviceTrusted({
        userId,
        fingerprint: deviceInfo.fingerprint
      });
      
      // If backend says device is trusted but local storage doesn't, update local
      if (response.trusted) {
        const currentDevice = await this.getCurrentDevice();
        if (!currentDevice || !currentDevice.trusted) {
          await this.trustCurrentDevice();
        }
      }
      
      return response.trusted;
    } catch (error) {
      logger.error('Failed to verify device trust with backend', {
        component: this.COMPONENT,
        action: 'verifyDeviceTrustWithBackend',
        error
      });
      
      // Fall back to local trust status
      return this.isCurrentDeviceTrusted();
    }
  }

  /**
   * Initiate device verification process
   */
  public async initiateDeviceVerification(method: 'email' | 'sms' = 'email'): Promise<DeviceVerificationStatus> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      // Call API to initiate verification
      const response = await AuthApi.initiateDeviceVerification({
        deviceInfo,
        method
      });
      
      // Store verification status
      this.verificationStatus = {
        required: true,
        verified: false,
        method,
        expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
        deviceId: response.deviceId
      };
      
      secureSet(this.VERIFICATION_STATUS_KEY, this.verificationStatus);
      
      logger.debug('Device verification initiated', {
        component: this.COMPONENT,
        action: 'initiateDeviceVerification',
        method
      });
      
      return this.verificationStatus;
    } catch (error) {
      logger.error('Failed to initiate device verification', {
        component: this.COMPONENT,
        action: 'initiateDeviceVerification',
        error
      });
      throw new AuthError('DEVICE_VERIFICATION_FAILED', 'Failed to initiate device verification');
    }
  }

  /**
   * Complete device verification with code
   */
  public async completeDeviceVerification(code: string): Promise<boolean> {
    try {
      if (!this.verificationStatus) {
        throw new AuthError('VERIFICATION_NOT_INITIATED', 'Device verification not initiated');
      }
      
      if (this.verificationStatus.verified) {
        return true; // Already verified
      }
      
      if (this.verificationStatus.expiresAt && this.verificationStatus.expiresAt < Date.now()) {
        throw new AuthError('VERIFICATION_EXPIRED', 'Verification code expired');
      }
      
      const deviceInfo = await this.getDeviceInfo();
      
      // Call API to verify code
      const response = await AuthApi.verifyDeviceCode({
        deviceInfo,
        code,
        method: this.verificationStatus.method || 'email'
      });
      
      if (response.verified) {
        // Update verification status
        this.verificationStatus.verified = true;
        secureSet(this.VERIFICATION_STATUS_KEY, this.verificationStatus);
        
        // Trust this device
        await this.trustCurrentDevice();
        
        logger.debug('Device verification completed', {
          component: this.COMPONENT,
          action: 'completeDeviceVerification'
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to complete device verification', {
        component: this.COMPONENT,
        action: 'completeDeviceVerification',
        error
      });
      throw new AuthError('DEVICE_VERIFICATION_FAILED', 'Failed to complete device verification');
    }
  }

  /**
   * Get current verification status
   */
  public getVerificationStatus(): DeviceVerificationStatus | null {
    return this.verificationStatus;
  }

  /**
   * Reset device verification status
   */
  public resetVerificationStatus(): void {
    this.verificationStatus = null;
    secureClear(this.VERIFICATION_STATUS_KEY);
  }

  /**
   * Update device name
   */
  public async updateDeviceName(deviceId: string, name: string): Promise<boolean> {
    try {
      const trustedDevices = this.getTrustedDevices();
      const deviceIndex = trustedDevices.findIndex(d => d.id === deviceId);
      
      if (deviceIndex >= 0) {
        const device = trustedDevices[deviceIndex];
        device.name = name;
        trustedDevices[deviceIndex] = device;
        secureSet(this.TRUSTED_DEVICES_KEY, trustedDevices);
        
        // Sync with backend
        try {
          const userId = this.getCurrentUserId();
          if (userId) {
            await AuthApi.updateDeviceName({
              userId,
              fingerprint: device.fingerprint,
              name
            });
          }
        } catch (syncError) {
          logger.warn('Failed to sync device name update with backend', {
            component: this.COMPONENT,
            action: 'updateDeviceName',
            error: syncError
          });
        }
        
        logger.debug('Device name updated', {
          component: this.COMPONENT,
          action: 'updateDeviceName',
          deviceId
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to update device name', {
        component: this.COMPONENT,
        action: 'updateDeviceName',
        error
      });
      return false;
    }
  }

  /**
   * Sync trusted devices with backend
   */
  public async syncDevicesWithBackend(userId: string): Promise<void> {
    try {
      // Get devices from backend
      const backendDevices = await AuthApi.getUserDevices({ userId });
      
      // Get local devices
      const localDevices = this.getTrustedDevices();
      
      // Merge devices (prefer backend for trust status)
      const mergedDevices: TrustedDevice[] = [];
      
      // Add backend devices
      for (const backendDevice of backendDevices) {
        const localDevice = localDevices.find(d => d.fingerprint === backendDevice.fingerprint);
        
        if (localDevice) {
          // Merge local and backend device
          mergedDevices.push({
            ...localDevice,
            trusted: backendDevice.trusted,
            name: backendDevice.name || localDevice.name,
            lastUsed: Math.max(localDevice.lastUsed, new Date(backendDevice.lastUsed).getTime())
          });
        } else {
          // Add backend device
          mergedDevices.push({
            id: this.generateDeviceId(),
            fingerprint: backendDevice.fingerprint,
            name: backendDevice.name || `Device ${new Date(backendDevice.createdAt).toLocaleDateString()}`,
            userAgent: backendDevice.userAgent || 'unknown',
            trusted: backendDevice.trusted,
            lastUsed: new Date(backendDevice.lastUsed).getTime(),
            createdAt: new Date(backendDevice.createdAt).getTime(),
            trustExpiration: Date.now() + this.TRUST_DURATION
          });
        }
      }
      
      // Add local devices not in backend
      for (const localDevice of localDevices) {
        if (!mergedDevices.some(d => d.fingerprint === localDevice.fingerprint)) {
          mergedDevices.push(localDevice);
        }
      }
      
      // Update local storage
      secureSet(this.TRUSTED_DEVICES_KEY, mergedDevices);
      
      logger.debug('Devices synced with backend', {
        component: this.COMPONENT,
        action: 'syncDevicesWithBackend',
        deviceCount: mergedDevices.length
      });
    } catch (error) {
      logger.error('Failed to sync devices with backend', {
        component: this.COMPONENT,
        action: 'syncDevicesWithBackend',
        error
      });
    }
  }

  /**
   * Clear all device data
   */
  public clearDeviceData(): void {
    try {
      secureClear(this.DEVICE_FINGERPRINT_KEY);
      secureClear(this.TRUSTED_DEVICES_KEY);
      secureClear(this.DEVICE_INFO_KEY);
      secureClear(this.VERIFICATION_STATUS_KEY);
      this.deviceInfo = null;
      this.verificationStatus = null;
      this.fingerprintCache = null;
      
      logger.debug('Device data cleared', {
        component: this.COMPONENT,
        action: 'clearDeviceData'
      });
    } catch (error) {
      logger.error('Failed to clear device data', {
        component: this.COMPONENT,
        action: 'clearDeviceData',
        error
      });
    }
  }

  /**
   * Extend trust period for a device
   */
  public extendDeviceTrust(deviceId: string, durationDays: number = 30): boolean {
    try {
      const trustedDevices = this.getTrustedDevices();
      const deviceIndex = trustedDevices.findIndex(d => d.id === deviceId);
      
      if (deviceIndex >= 0) {
        // Calculate new expiration date
        const newExpiration = Date.now() + (durationDays * 24 * 60 * 60 * 1000);
        trustedDevices[deviceIndex].trustExpiration = newExpiration;
        
        secureSet(this.TRUSTED_DEVICES_KEY, trustedDevices);
        
        logger.debug('Device trust period extended', {
          component: this.COMPONENT,
          action: 'extendDeviceTrust',
          deviceId,
          newExpiration: new Date(newExpiration).toISOString()
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to extend device trust period', {
        component: this.COMPONENT,
        action: 'extendDeviceTrust',
        error
      });
      return false;
    }
  }

  /**
   * Get current device ID if it's trusted
   */
  public async getCurrentDeviceId(): Promise<string | null> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      const trustedDevices = this.getTrustedDevices();
      
      const currentDevice = trustedDevices.find(d => d.fingerprint === deviceInfo.fingerprint);
      return currentDevice?.id || null;
    } catch (error) {
      logger.error('Failed to get current device ID', {
        component: this.COMPONENT,
        action: 'getCurrentDeviceId',
        error
      });
      return null;
    }
  }

  /**
   * Check if device trust is about to expire
   * @param daysThreshold Number of days before expiration to consider as "about to expire"
   */
  public async isDeviceTrustExpiring(daysThreshold: number = 5): Promise<boolean> {
    try {
      const deviceId = await this.getCurrentDeviceId();
      if (!deviceId) return false;
      
      const trustedDevices = this.getTrustedDevices();
      const device = trustedDevices.find(d => d.id === deviceId);
      
      if (!device) return false;
      
      const thresholdTime = Date.now() + (daysThreshold * 24 * 60 * 60 * 1000);
      return device.trustExpiration < thresholdTime;
    } catch (error) {
      logger.error('Failed to check if device trust is expiring', {
        component: this.COMPONENT,
        action: 'isDeviceTrustExpiring',
        error
      });
      return false;
    }
  }
}

// Export singleton instance
export const deviceService = new DeviceService();
