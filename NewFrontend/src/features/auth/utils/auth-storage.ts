import CryptoJS from 'crypto-js';
import { logger } from '@/utils/logger';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

// Storage types
type StorageType = 'localStorage' | 'sessionStorage' | 'inMemory';

// In-memory fallback storage
const inMemoryStorage = new Map<string, string>();

// Encryption configuration
const ENCRYPTION_CONFIG = {
  keySize: 256 / 32,
  iterations: 1000,
  algorithm: 'AES'
};

// Storage availability cache
const storageAvailabilityCache: Record<StorageType, boolean | null> = {
  localStorage: null,
  sessionStorage: null,
  inMemory: true
};

/**
 * Check if a storage type is available
 */
export const isStorageAvailable = (type: StorageType): boolean => {
  // Return cached result if available
  if (storageAvailabilityCache[type] !== null) {
    return storageAvailabilityCache[type] as boolean;
  }

  // In-memory is always available
  if (type === 'inMemory') return true;

  try {
    const storage = window[type];
    const testKey = `__storage_test_${Math.random()}`;
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    storageAvailabilityCache[type] = true;
    return true;
  } catch (e) {
    storageAvailabilityCache[type] = false;
    logger.warn(`${type} is not available`, { error: e });
    return false;
  }
};

/**
 * Get the best available storage type
 */
export const getBestAvailableStorage = (): StorageType => {
  if (isStorageAvailable('localStorage')) return 'localStorage';
  if (isStorageAvailable('sessionStorage')) return 'sessionStorage';
  return 'inMemory';
};

/**
 * Generate a storage key with optional namespace
 */
const getStorageKey = (key: string, namespace?: string): string => {
  return namespace ? `${namespace}:${key}` : key;
};

/**
 * Derive encryption key from master key and salt
 */
const deriveEncryptionKey = (masterKey: string, salt: string): string => {
  return CryptoJS.PBKDF2(
    masterKey,
    salt,
    {
      keySize: ENCRYPTION_CONFIG.keySize,
      iterations: ENCRYPTION_CONFIG.iterations
    }
  ).toString();
};

/**
 * Get encryption master key (in a real app, this would be more securely managed)
 */
const getEncryptionMasterKey = (): string => {
  // In a production app, this would be more sophisticated
  // For example, derived from user-specific data or retrieved from a secure source
  return window.location.hostname + navigator.userAgent.substring(0, 20);
};

/**
 * Encrypt data for storage
 */
const encryptData = (data: string, salt: string = 'auth-storage-salt'): string => {
  try {
    const masterKey = getEncryptionMasterKey();
    const key = deriveEncryptionKey(masterKey, salt);
    
    // Generate random IV
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Encrypt
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Combine IV and encrypted data
    const result = iv.toString() + encrypted.toString();
    return result;
  } catch (error) {
    logger.error('Encryption failed', { error });
    return data; // Fallback to unencrypted data
  }
};

/**
 * Decrypt data from storage
 */
const decryptData = (encryptedData: string, salt: string = 'auth-storage-salt'): string => {
  try {
    const masterKey = getEncryptionMasterKey();
    const key = deriveEncryptionKey(masterKey, salt);
    
    // Extract IV (first 32 chars)
    const iv = CryptoJS.enc.Hex.parse(encryptedData.substring(0, 32));
    const encrypted = encryptedData.substring(32);
    
    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    logger.error('Decryption failed', { error });
    return ''; // Return empty string on failure
  }
};

/**
 * Securely store data
 */
export const secureSet = (
  key: string,
  value: any,
  options: {
    encrypt?: boolean;
    storage?: StorageType;
    namespace?: string;
    expiresIn?: number; // in milliseconds
  } = {}
): boolean => {
  try {
    const {
      encrypt = true,
      storage = getBestAvailableStorage(),
      namespace = 'auth',
      expiresIn
    } = options;

    // Prepare data with expiration if needed
    const dataToStore = expiresIn
      ? JSON.stringify({
          value,
          expires: Date.now() + expiresIn
        })
      : JSON.stringify({ value });

    // Encrypt if requested
    const processedData = encrypt ? encryptData(dataToStore) : dataToStore;
    const fullKey = getStorageKey(key, namespace);

    // Store based on storage type
    if (storage === 'inMemory') {
      inMemoryStorage.set(fullKey, processedData);
    } else if (isStorageAvailable(storage)) {
      window[storage].setItem(fullKey, processedData);
    } else {
      // Fallback to in-memory if preferred storage is unavailable
      inMemoryStorage.set(fullKey, processedData);
      logger.warn(`Fallback to in-memory storage for ${key}`);
    }

    // Broadcast storage event for cross-tab sync (for non-localStorage)
    if (storage !== 'localStorage' && isStorageAvailable('localStorage')) {
      const syncEvent = {
        key: fullKey,
        value: processedData,
        timestamp: Date.now()
      };
      window.localStorage.setItem(
        AUTH_CONSTANTS.STORAGE_KEYS.SYNC_EVENT,
        JSON.stringify(syncEvent)
      );
      // Clean up sync event after a short delay
      setTimeout(() => {
        window.localStorage.removeItem(AUTH_CONSTANTS.STORAGE_KEYS.SYNC_EVENT);
      }, 1000);
    }

    return true;
  } catch (error) {
    logger.error('Failed to store data securely', { key, error });
    return false;
  }
};

/**
 * Securely retrieve data
 */
export const secureGet = <T = any>(
  key: string,
  options: {
    decrypt?: boolean;
    storage?: StorageType;
    namespace?: string;
    defaultValue?: T;
  } = {}
): T | null => {
  try {
    const {
      decrypt = true,
      storage = getBestAvailableStorage(),
      namespace = 'auth',
      defaultValue = null
    } = options;

    const fullKey = getStorageKey(key, namespace);
    let rawData: string | null = null;

    // Retrieve based on storage type
    if (storage === 'inMemory') {
      rawData = inMemoryStorage.get(fullKey) || null;
    } else if (isStorageAvailable(storage)) {
      rawData = window[storage].getItem(fullKey);
    } else {
      // Try fallback storages
      if (isStorageAvailable('localStorage')) {
        rawData = window.localStorage.getItem(fullKey);
      } else if (isStorageAvailable('sessionStorage')) {
        rawData = window.sessionStorage.getItem(fullKey);
      } else {
        rawData = inMemoryStorage.get(fullKey) || null;
      }
    }

    if (!rawData) return defaultValue;

    // Decrypt if needed
    const processedData = decrypt ? decryptData(rawData) : rawData;
    
    try {
      const parsedData = JSON.parse(processedData);
      
      // Check expiration
      if (parsedData.expires && parsedData.expires < Date.now()) {
        secureClear(key, { storage, namespace });
        return defaultValue;
      }
      
      return parsedData.value as T;
    } catch (e) {
      logger.error('Failed to parse stored data', { key, error: e });
      return defaultValue;
    }
  } catch (error) {
    logger.error('Failed to retrieve data securely', { key, error });
    return null;
  }
};

/**
 * Securely clear data
 */
export const secureClear = (
  key: string,
  options: {
    storage?: StorageType;
    namespace?: string;
    clearAll?: boolean;
  } = {}
): boolean => {
  try {
    const {
      storage = getBestAvailableStorage(),
      namespace = 'auth',
      clearAll = false
    } = options;

    if (clearAll) {
      // Clear all auth data
      if (isStorageAvailable('localStorage')) {
        Object.keys(window.localStorage).forEach(storageKey => {
          if (storageKey.startsWith(`${namespace}:`)) {
            window.localStorage.removeItem(storageKey);
          }
        });
      }
      
      if (isStorageAvailable('sessionStorage')) {
        Object.keys(window.sessionStorage).forEach(storageKey => {
          if (storageKey.startsWith(`${namespace}:`)) {
            window.sessionStorage.removeItem(storageKey);
          }
        });
      }
      
      // Clear in-memory storage
      for (const storageKey of inMemoryStorage.keys()) {
        if (storageKey.startsWith(`${namespace}:`)) {
          inMemoryStorage.delete(storageKey);
        }
      }
      
      return true;
    }

    const fullKey = getStorageKey(key, namespace);
    
    // Clear from all storage types to ensure complete removal
    if (isStorageAvailable('localStorage')) {
      window.localStorage.removeItem(fullKey);
    }
    
    if (isStorageAvailable('sessionStorage')) {
      window.sessionStorage.removeItem(fullKey);
    }
    
    inMemoryStorage.delete(fullKey);

    // Broadcast clear event for cross-tab sync
    if (isStorageAvailable('localStorage')) {
      const clearEvent = {
        key: fullKey,
        action: 'clear',
        timestamp: Date.now()
      };
      window.localStorage.setItem(
        AUTH_CONSTANTS.STORAGE_KEYS.SYNC_EVENT,
        JSON.stringify(clearEvent)
      );
      // Clean up sync event after a short delay
      setTimeout(() => {
        window.localStorage.removeItem(AUTH_CONSTANTS.STORAGE_KEYS.SYNC_EVENT);
      }, 1000);
    }

    return true;
  } catch (error) {
    logger.error('Failed to clear data securely', { key, error });
    return false;
  }
};

/**
 * Check if a key exists in storage
 */
export const secureHas = (
  key: string,
  options: {
    storage?: StorageType;
    namespace?: string;
  } = {}
): boolean => {
  const { storage = getBestAvailableStorage(), namespace = 'auth' } = options;
  const fullKey = getStorageKey(key, namespace);

  if (storage === 'inMemory') {
    return inMemoryStorage.has(fullKey);
  } else if (isStorageAvailable(storage)) {
    return window[storage].getItem(fullKey) !== null;
  }

  // Try all storage types
  return (
    (isStorageAvailable('localStorage') && window.localStorage.getItem(fullKey) !== null) ||
    (isStorageAvailable('sessionStorage') && window.sessionStorage.getItem(fullKey) !== null) ||
    inMemoryStorage.has(fullKey)
  );
};

/**
 * Get all keys in a namespace
 */
export const secureGetKeys = (
  options: {
    storage?: StorageType;
    namespace?: string;
  } = {}
): string[] => {
  const { storage = getBestAvailableStorage(), namespace = 'auth' } = options;
  const prefix = `${namespace}:`;
  const keys: string[] = [];

  if (storage === 'localStorage' && isStorageAvailable('localStorage')) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
  } else if (storage === 'sessionStorage' && isStorageAvailable('sessionStorage')) {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
  } else if (storage === 'inMemory') {
    for (const key of inMemoryStorage.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }
  }

  return keys;
};

/**
 * Listen for storage sync events
 */
export const initStorageSyncListener = (callback?: (event: StorageEvent) => void): () => void => {
  const handleStorageEvent = (event: StorageEvent) => {
    // Handle sync events
    if (event.key === AUTH_CONSTANTS.STORAGE_KEYS.SYNC_EVENT && event.newValue) {
      try {
        const syncEvent = JSON.parse(event.newValue);
        const { key, value, action, timestamp } = syncEvent;
        
        if (action === 'clear') {
          // Clear the item from all storages
          if (isStorageAvailable('sessionStorage')) {
            window.sessionStorage.removeItem(key);
          }
          inMemoryStorage.delete(key);
        } else if (value) {
          // Update the item in all storages
          if (isStorageAvailable('sessionStorage')) {
            window.sessionStorage.setItem(key, value);
          }
          inMemoryStorage.set(key, value);
        }
      } catch (error) {
        logger.error('Failed to process sync event', { error });
      }
    }
    
    // Call the custom callback if provided
    if (callback) {
      callback(event);
    }
  };

  window.addEventListener('storage', handleStorageEvent);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('storage', handleStorageEvent);
  };
};

/**
 * Migrate data from one storage to another
 */
export const migrateStorage = (
  fromStorage: StorageType,
  toStorage: StorageType,
  namespace: string = 'auth'
): boolean => {
  try {
    if (!isStorageAvailable(fromStorage) || !isStorageAvailable(toStorage)) {
      return false;
    }

    const prefix = `${namespace}:`;
    const keys: string[] = [];

    // Collect keys from source storage
    if (fromStorage === 'localStorage') {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    } else if (fromStorage === 'sessionStorage') {
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    } else if (fromStorage === 'inMemory') {
      for (const key of inMemoryStorage.keys()) {
        if (key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    }

    // Migrate each key
    keys.forEach(key => {
      let value: string | null = null;
      
      if (fromStorage === 'localStorage') {
        value = window.localStorage.getItem(key);
      } else if (fromStorage === 'sessionStorage') {
        value = window.sessionStorage.getItem(key);
      } else if (fromStorage === 'inMemory') {
        value = inMemoryStorage.get(key) || null;
      }
      
      if (value) {
        if (toStorage === 'localStorage') {
          window.localStorage.setItem(key, value);
        } else if (toStorage === 'sessionStorage') {
          window.sessionStorage.setItem(key, value);
        } else if (toStorage === 'inMemory') {
          inMemoryStorage.set(key, value);
        }
      }
    });

    return true;
  } catch (error) {
    logger.error('Storage migration failed', { fromStorage, toStorage, error });
    return false;
  }
};

// Export a unified API
export const authStorage = {
  set: secureSet,
  get: secureGet,
  clear: secureClear,
  has: secureHas,
  getKeys: secureGetKeys,
  isAvailable: isStorageAvailable,
  getBestStorage: getBestAvailableStorage,
  initSyncListener: initStorageSyncListener,
  migrate: migrateStorage
};

export default authStorage;