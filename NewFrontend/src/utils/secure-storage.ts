import { encrypt, decrypt } from '@/utils/crypto';

export class SecureStorage {
  private namespace: string;
  
  constructor(namespace: string) {
    this.namespace = namespace;
  }
  
  async setItem(key: string, value: string): Promise<void> {
    const fullKey = `${this.namespace}:${key}`;
    
    // For sensitive data, use sessionStorage instead of localStorage
    sessionStorage.setItem(fullKey, value);
    
    // For extra security, consider using IndexedDB with encryption
    // await this.storeInIndexedDB(fullKey, value);
  }
  
  async getItem(key: string): Promise<string | null> {
    const fullKey = `${this.namespace}:${key}`;
    return sessionStorage.getItem(fullKey);
  }
  
  async removeItem(key: string): Promise<void> {
    const fullKey = `${this.namespace}:${key}`;
    sessionStorage.removeItem(fullKey);
  }
  
  // Additional methods for IndexedDB storage with encryption
}