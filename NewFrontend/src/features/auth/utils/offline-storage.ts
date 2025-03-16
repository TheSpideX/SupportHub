import { logger } from '@/utils/logger';

const COMPONENT = 'offline-storage';
const DB_NAME = 'auth_offline_storage';
const STORE_NAME = 'auth_data';
const DB_VERSION = 1;

/**
 * Creates and manages an IndexedDB store for offline authentication data
 */
export function createOfflineStore() {
  let db: IDBDatabase | null = null;

  /**
   * Opens the IndexedDB database
   */
  const openDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = (event) => {
          db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = (event) => {
          logger.error('Failed to open offline database', { 
            component: COMPONENT, 
            error: (event.target as IDBOpenDBRequest).error 
          });
          reject((event.target as IDBOpenDBRequest).error);
        };
      } catch (error) {
        logger.error('Error opening offline database', { component: COMPONENT, error });
        reject(error);
      }
    });
  };

  /**
   * Stores data in the offline store
   */
  const set = async (key: string, value: any): Promise<void> => {
    try {
      const database = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
          logger.error('Failed to store offline data', { 
            component: COMPONENT, 
            error: (event.target as IDBRequest).error,
            key
          });
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      logger.error('Error storing offline data', { component: COMPONENT, error, key });
      throw error;
    }
  };

  /**
   * Retrieves data from the offline store
   */
  const get = async (key: string): Promise<any> => {
    try {
      const database = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = (event) => {
          resolve((event.target as IDBRequest).result);
        };
        
        request.onerror = (event) => {
          logger.error('Failed to retrieve offline data', { 
            component: COMPONENT, 
            error: (event.target as IDBRequest).error,
            key
          });
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      logger.error('Error retrieving offline data', { component: COMPONENT, error, key });
      throw error;
    }
  };

  /**
   * Removes data from the offline store
   */
  const remove = async (key: string): Promise<void> => {
    try {
      const database = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
          logger.error('Failed to remove offline data', { 
            component: COMPONENT, 
            error: (event.target as IDBRequest).error,
            key
          });
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      logger.error('Error removing offline data', { component: COMPONENT, error, key });
      throw error;
    }
  };

  /**
   * Clears all data from the offline store
   */
  const clear = async (): Promise<void> => {
    try {
      const database = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
          logger.error('Failed to clear offline data', { 
            component: COMPONENT, 
            error: (event.target as IDBRequest).error 
          });
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      logger.error('Error clearing offline data', { component: COMPONENT, error });
      throw error;
    }
  };

  return {
    set,
    get,
    remove,
    clear
  };
}