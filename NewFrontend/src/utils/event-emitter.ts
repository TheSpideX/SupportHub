type EventCallback = (...args: any[]) => void;

export class EventEmitter {
  private static instance: EventEmitter;
  private events: Map<string, EventCallback[]>;

  private constructor() {
    this.events = new Map();
  }

  static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
    }
    return EventEmitter.instance;
  }

  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) return;

    const callbacks = this.events.get(event)!;
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }

    if (callbacks.length === 0) {
      this.events.delete(event);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events.has(event)) return;

    this.events.get(event)!.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      this.off(event, onceCallback);
      callback(...args);
    };
    this.on(event, onceCallback);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.length || 0;
  }

  listeners(event: string): EventCallback[] {
    return this.events.get(event) || [];
  }
}

// Export a singleton instance
export const eventEmitter = EventEmitter.getInstance();