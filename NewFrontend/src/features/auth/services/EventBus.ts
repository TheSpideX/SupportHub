// Simple event bus implementation for service communication
class EventBus {
  private listeners: Record<string, Function[]> = {};

  // Subscribe to an event
  public on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  // Unsubscribe from an event
  public off(event: string, callback: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  // Emit an event with data
  public emit(event: string, data?: any): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}

// Create a singleton instance
export const authEventBus = new EventBus();

// Define event types for type safety
export const AUTH_EVENTS = {
  // TokenService events
  TOKEN_REFRESHED: 'token.refreshed',
  TOKEN_EXPIRED: 'token.expired',
  AUTH_STATE_CHANGED: 'auth.stateChanged',
  
  // SessionService events
  SESSION_ACTIVE: 'session.active',
  SESSION_IDLE: 'session.idle',
  SESSION_TERMINATED: 'session.terminated'
};

export default authEventBus;