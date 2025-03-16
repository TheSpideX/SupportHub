
import { EventEmitter } from "@/utils/events";

export type ServerStatus = {
  isOnline: boolean;
  latency: number | null;
  lastChecked: number;
  status: 'online' | 'degraded' | 'offline';
};

class ServerStatusService {
  private static instance: ServerStatusService;
  private _status: ServerStatus = {
    isOnline: false,
    latency: null,
    lastChecked: Date.now(),
    status: 'offline'
  };
  private intervalId: number | null = null;
  private checkInterval = 30000; // 30 seconds
  private isMonitoring = false; // Track if monitoring is active
  public events = new EventEmitter<{
    statusChange: [ServerStatus];
  }>();
  private static _checkInProgress = false;
  private static _lastCheckTime = 0;
  private static _checkInterval = 30000; // 30 seconds minimum between checks

  private constructor() {}

  public static getInstance(): ServerStatusService {
    if (!ServerStatusService.instance) {
      ServerStatusService.instance = new ServerStatusService();
    }
    return ServerStatusService.instance;
  }

  public get status(): ServerStatus {
    return this._status;
  }

  // Add debugging to help trace the calls
  public startMonitoring(forceClean?: boolean, interval?: number): void {
    // Add stack trace to see where this is being called from
    console.debug('startMonitoring called from:', new Error().stack);
    
    // If already monitoring with the same interval and not forcing a clean start, don't restart
    if (this.isMonitoring && (!interval || interval === this.checkInterval) && !forceClean) {
      console.log('Server status monitoring already active');
      return;
    }
    
    if (interval) {
      this.checkInterval = interval;
    }
    
    // Clear any existing interval if we're already monitoring
    if (this.isMonitoring || this.intervalId) {
      console.log('Stopping existing server status monitoring before restart');
      if (this.intervalId) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    
    console.log('Starting server status monitoring');
    
    // Check immediately
    this.checkServerStatus();
    
    // Then set up interval
    this.intervalId = window.setInterval(() => {
      this.checkServerStatus();
    }, this.checkInterval);
    
    this.isMonitoring = true;
  }

  // Add debugging to help trace the calls
  public stopMonitoring(): void {
    // Add stack trace to see where this is being called from
    console.debug('stopMonitoring called from:', new Error().stack);
    
    if (this.intervalId) {
      console.log('Stopping server status monitoring');
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      this.isMonitoring = false;
    }
  }

  public async checkServerStatus(): Promise<ServerStatus> {
    try {
      // Prevent duplicate calls in quick succession
      const now = Date.now();
      if (ServerStatusService._checkInProgress || 
          (now - ServerStatusService._lastCheckTime < ServerStatusService._checkInterval)) {
        // Return the last status if we checked recently
        if (this._status) {
          return this._status;
        }
      }
      
      ServerStatusService._checkInProgress = true;
      ServerStatusService._lastCheckTime = now;
      
      const startTime = Date.now();
      const response = await fetch('/api/health', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store' // Prevent browser caching
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      let status: 'online' | 'degraded' | 'offline';
      if (response.ok) {
        status = responseTime < 300 ? 'online' : 'degraded';
      } else {
        status = 'offline';
      }
      
      this._status = {
        isOnline: response.ok,
        latency: responseTime,
        lastChecked: endTime,
        status
      };
      
      ServerStatusService._checkInProgress = false;
      return this._status;
    } catch (error) {
      ServerStatusService._checkInProgress = false;
      
      this._status = {
        isOnline: false,
        latency: null,
        lastChecked: Date.now(),
        status: 'offline'
      };
      
      return this._status;
    }
  }
}

export const serverStatusService = ServerStatusService.getInstance();
