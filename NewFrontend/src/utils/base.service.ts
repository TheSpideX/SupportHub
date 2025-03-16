import { EventEmitter } from '@/utils/event-emitter';
import { Logger } from '@/utils/logger';

export abstract class BaseService {
  protected logger: Logger;
  protected events: EventEmitter;
  
  constructor(serviceName: string) {
    this.logger = new Logger(serviceName);
    this.events = new EventEmitter();
  }
  
  /**
   * Register an event listener
   * @param event Event name
   * @param listener Callback function
   * @returns Unsubscribe function
   */
  public on(event: string, listener: (...args: any[]) => void): () => void {
    this.events.on(event, listener);
    return () => this.events.removeListener(event, listener);
  }
  
  /**
   * Remove an event listener
   * @param event Event name
   * @param listener Callback function
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.events.removeListener(event, listener);
  }
  
  /**
   * Remove all listeners for an event
   * @param event Event name
   */
  public removeAllListeners(event?: string): void {
    this.events.removeAllListeners(event);
  }
  
  /**
   * Dispose of service resources
   */
  public dispose(): void {
    this.events.removeAllListeners();
  }
}

/**
 * Base class for singleton services
 */
export abstract class SingletonService<T extends BaseService> extends BaseService {
  protected static instance: any;
  
  protected constructor(serviceName: string) {
    super(serviceName);
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance<T extends BaseService>(this: new (...args: any[]) => T, ...args: any[]): T {
    if (!this.instance) {
      this.instance = new this(...args);
    }
    return this.instance;
  }
}