/**
 * Simple EventEmitter implementation for browser
 * This replaces the Node.js events module which is not available in the browser
 */

type EventListener = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string, EventListener[]>;

  constructor() {
    this.events = new Map();
  }

  /**
   * Add event listener
   * @param event Event name
   * @param listener Event listener function
   */
  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    this.events.get(event)!.push(listener);
    return this;
  }

  /**
   * Add one-time event listener
   * @param event Event name
   * @param listener Event listener function
   */
  once(event: string, listener: EventListener): this {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    
    return this.on(event, onceWrapper);
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param listener Event listener function
   */
  off(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      return this;
    }
    
    const listeners = this.events.get(event)!;
    const index = listeners.indexOf(listener);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    
    if (listeners.length === 0) {
      this.events.delete(event);
    }
    
    return this;
  }

  /**
   * Remove all listeners for an event
   * @param event Event name (optional)
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    
    return this;
  }

  /**
   * Emit an event
   * @param event Event name
   * @param args Arguments to pass to listeners
   */
  emit(event: string, ...args: any[]): boolean {
    if (!this.events.has(event)) {
      return false;
    }
    
    const listeners = this.events.get(event)!.slice();
    
    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
    
    return true;
  }

  /**
   * Get listeners for an event
   * @param event Event name
   */
  listeners(event: string): EventListener[] {
    return this.events.get(event) || [];
  }
}

// Export a default instance
export default EventEmitter;
