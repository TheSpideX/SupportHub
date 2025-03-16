import { axiosInstance } from '@/utils/axios';
import { Logger } from '@/utils/logger';
import { EventEmitter } from '@/utils/event-emitter';

export interface ServerStatus {
  isOnline: boolean;
  latency: number | null;
  lastChecked: number;
}

export class NetworkService {
  private static instance: NetworkService;
  private logger: Logger;
  private events: EventEmitter;
  private checkInterval: NodeJS.Timeout | null = null;
  private _status: ServerStatus = {
    isOnline: navigator.onLine,
    latency: null,
    lastChecked: 0
  };
  private static _checkInProgress = false;
  private static _lastCheckTime = 0;
  private static _checkInterval = 30000; // 30 seconds minimum between checks
  
  private constructor() {
    this.logger = new Logger('NetworkService');
    this.events = new EventEmitter();
    
    // Listen for browser online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }
  
  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }
  
  private handleOnline = () => {
    this._status.isOnline = true;
    this.events.emit('online');
    this.checkServerStatus(); // Verify server is actually reachable
  };
  
  private handleOffline = () => {
    this._status.isOnline = false;
    this._status.latency = null;
    this.events.emit('offline');
  };
  
  public get status(): ServerStatus {
    return { ...this._status };
  }
  
  public async checkServerStatus(): Promise<ServerStatus> {
    try {
      // Prevent duplicate calls in quick succession
      const now = Date.now();
      if (NetworkService._checkInProgress || 
          (now - NetworkService._lastCheckTime < NetworkService._checkInterval)) {
        // Return the last status if we checked recently
        if (this._status) {
          return this._status;
        }
      }
      
      NetworkService._checkInProgress = true;
      NetworkService._lastCheckTime = now;
      
      const startTime = Date.now();
      await axiosInstance.get('/api/health', { 
        timeout: 5000,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const endTime = Date.now();
      
      this._status = {
        isOnline: true,
        latency: endTime - startTime,
        lastChecked: endTime
      };
      
      this.events.emit('statusChange', this._status);
      NetworkService._checkInProgress = false;
      return this._status;
    } catch (error) {
      this._status = {
        isOnline: false,
        latency: null,
        lastChecked: Date.now()
      };
      
      this.logger.warn('Server status check failed', { error });
      this.events.emit('statusChange', this._status);
      NetworkService._checkInProgress = false;
      return this._status;
    }
  }
  
  public startPeriodicChecks(interval: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(() => {
      this.checkServerStatus();
    }, interval);
  }
  
  public stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  public onStatusChange(callback: (status: ServerStatus) => void): () => void {
    this.events.on('statusChange', callback);
    return () => this.events.removeListener('statusChange', callback);
  }
  
  public onOnline(callback: () => void): () => void {
    this.events.on('online', callback);
    return () => this.events.removeListener('online', callback);
  }
  
  public onOffline(callback: () => void): () => void {
    this.events.on('offline', callback);
    return () => this.events.removeListener('offline', callback);
  }
  
  public dispose(): void {
    this.stopPeriodicChecks();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.events.removeAllListeners();
  }
}

export const networkService = NetworkService.getInstance();