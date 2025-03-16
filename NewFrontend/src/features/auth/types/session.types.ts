export interface SessionState {
  isAuthenticated: boolean;
  sessionExpiry: number | null;
  isOffline: boolean;
  lastActivity: number;
}

export interface SessionConfig {
  checkInterval: number;
  expiryThreshold: number;
  maxInactivity: number;
}
export interface SessionMetrics {
  startTime: number;
  activeTime: number;
  interactions: number;
  networkRequests: number;
  errors: number;
}
