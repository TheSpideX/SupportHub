import { EventEmitter } from '@/utils/event-emitter';
import { serverStatusService } from './server-status.service';

/**
 * Centralized network monitoring service
 * This service coordinates all network-related monitoring
 * to prevent duplicate monitoring from different components
 */
class NetworkMonitorService {
  // Singleton instance
  private static instance: NetworkMonitorService | null = null;
  private events: EventEmitter;
  private isInitialized: boolean;
  private _status: {
    isOnline: boolean;
    latency: number | null;
    lastChecked: number;
    status: string;
  };

  // Static method to get the instance
  public static getInstance(): NetworkMonitorService {
    if (!NetworkMonitorService.instance) {
      NetworkMonitorService.instance = new NetworkMonitorService();
    }
    return NetworkMonitorService.instance;
  }

  // Private constructor to enforce singleton pattern
  private constructor() {
    // Initialize properties
    this._status = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      latency: null,
      lastChecked: Date.now(),
      status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
    };
    this.events = new EventEmitter();
    this.isInitialized = false;
  }
  
  /**
   * Initialize all network monitoring
   * This should be called once at application startup
   * @returns {boolean} Whether initialization was performed (true) or skipped (false)
   */
  public initialize(): boolean {
    if (this.isInitialized) {
      console.debug('Network monitoring already initialized');
      return false;
    }
    
    console.log('Initializing network monitoring');
    
    // Start server status monitoring with a clean start
    serverStatusService.startMonitoring(true);
    
    // Set up browser online/offline event listeners
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Register cleanup function for application shutdown
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
    
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Clean up all network monitoring
   * This should be called when the application is shutting down
   */
  public cleanup(): void {
    if (!this.isInitialized) {
      return;
    }
    
    console.log('Cleaning up network monitoring');
    
    // Stop server status monitoring
    serverStatusService.stopMonitoring();
    
    // Remove browser online/offline event listeners
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    this.isInitialized = false;
  }
  
  private handleOnline = (): void => {
    console.log('Browser reports online status');
    // Trigger an immediate server status check
    serverStatusService.checkServerStatus().then(status => {
      console.log('Online status check result:', status);
    });
  };
  
  private handleOffline = (): void => {
    console.log('Browser reports offline status');
    // Update server status to offline
    this._status = {
      isOnline: false,
      latency: null,
      lastChecked: Date.now(),
      status: 'offline'
    };
    this.events.emit('statusChange', this._status);
  };
}

export const networkMonitorService = NetworkMonitorService.getInstance();