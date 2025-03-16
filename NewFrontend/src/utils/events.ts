/**
 * Simple typed event emitter for use in services
 */
export class EventEmitter<T extends Record<string, any[]>> {
  private listeners: {
    [K in keyof T]?: Array<(...args: T[K]) => void>;
  } = {};

  /**
   * Register an event listener
   * @param event Event name
   * @param callback Function to call when event is emitted
   */
  public on<K extends keyof T>(event: K, callback: (...args: T[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]?.push(callback);
  }

  /**
   * Remove an event listener
   * @param event Event name
   * @param callback Function to remove
   */
  public off<K extends keyof T>(event: K, callback: (...args: T[K]) => void): void {
    if (!this.listeners[event]) return;
    
    const index = this.listeners[event]?.indexOf(callback) ?? -1;
    if (index !== -1) {
      this.listeners[event]?.splice(index, 1);
    }
  }

  /**
   * Emit an event with arguments
   * @param event Event name
   * @param args Arguments to pass to listeners
   */
  public emit<K extends keyof T>(event: K, ...args: T[K]): void {
    if (!this.listeners[event]) return;
    
    this.listeners[event]?.forEach(callback => {
      callback(...args);
    });
  }

  /**
   * Remove all listeners for an event
   * @param event Event name (optional - if not provided, removes all listeners)
   */
  public removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      this.listeners = {};
    }
  }
}