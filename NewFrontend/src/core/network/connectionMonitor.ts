import { BehaviorSubject } from 'rxjs';
import { errorHandler } from '@/core/errors/errorHandler';

export class ConnectionMonitor {
  private static instance: ConnectionMonitor;
  private connectionStatus$ = new BehaviorSubject<boolean>(navigator.onLine);
  private heartbeatInterval: number | null = null;
  private readonly HEARTBEAT_URL = `${API_CONFIG.BASE_URL}/health`;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  private constructor() {
    this.setupListeners();
    this.startHeartbeat();
  }

  private setupListeners(): void {
    window.addEventListener('online', () => this.updateStatus(true));
    window.addEventListener('offline', () => this.updateStatus(false));
  }

  private updateStatus(isOnline: boolean): void {
    this.connectionStatus$.next(isOnline);
    if (isOnline) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
  }

  private async checkConnection(): Promise<void> {
    try {
      await apiClient.get(this.HEARTBEAT_URL);
      this.connectionStatus$.next(true);
    } catch (error) {
      this.connectionStatus$.next(false);
      errorHandler.handleError(error, {
        component: 'ConnectionMonitor',
        action: 'heartbeat'
      });
    }
  }

  private startHeartbeat(): void {
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = window.setInterval(
        () => this.checkConnection(),
        this.HEARTBEAT_INTERVAL
      );
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public static getInstance(): ConnectionMonitor {
    if (!ConnectionMonitor.instance) {
      ConnectionMonitor.instance = new ConnectionMonitor();
    }
    return ConnectionMonitor.instance;
  }

  public getStatus$() {
    return this.connectionStatus$.asObservable();
  }

  public getCurrentStatus(): boolean {
    return this.connectionStatus$.getValue();
  }
}

export const connectionMonitor = ConnectionMonitor.getInstance();