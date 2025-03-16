import { authStorage } from '@/features/auth/utils/auth-storage';

export class SecureStorage {
  private namespace: string;
  
  constructor(namespace: string) {
    this.namespace = namespace;
  }
  
  async setItem(key: string, value: string): Promise<void> {
    // Use the unified authStorage API
    authStorage.set(key, value, {
      namespace: this.namespace,
      storage: 'sessionStorage' // For sensitive data
    });
  }
  
  async getItem(key: string): Promise<string | null> {
    return authStorage.get(key, {
      namespace: this.namespace,
      storage: 'sessionStorage'
    });
  }
  
  async removeItem(key: string): Promise<void> {
    authStorage.clear(key, {
      namespace: this.namespace
    });
  }
}