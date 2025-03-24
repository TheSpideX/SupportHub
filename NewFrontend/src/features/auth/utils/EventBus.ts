/**
 * Simple event bus implementation to avoid circular dependencies
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  private constructor() {} // Private constructor

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) return;

    const eventListeners = this.listeners.get(event)!;
    const index = eventListeners.indexOf(callback);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
  }

  public emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) return;

    const eventListeners = this.listeners.get(event)!;
    eventListeners.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();
