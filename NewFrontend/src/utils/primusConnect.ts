/**
 * Primus Connection Utility
 * 
 * This utility provides a function to create a Primus connection with proper configuration.
 * It handles reconnection, authentication, and other connection settings.
 */

import { logger } from './logger';
import { PRIMUS_CONFIG } from '../config/primus';
import { SOCKET_CONFIG } from '../config/socket';

// Define the Primus connection options
interface PrimusConnectionOptions {
  url?: string;
  path?: string;
  csrfToken?: string;
  deviceId?: string;
  tabId: string;
  withCredentials?: boolean;
  autoConnect?: boolean;
  reconnect?: boolean;
  timeout?: number;
}

/**
 * Create a Primus connection with proper configuration
 * @param options Connection options
 * @returns Primus connection
 */
export function createPrimusConnection(options: PrimusConnectionOptions): any {
  try {
    // Check if Primus is available
    if (typeof window === 'undefined' || !window.Primus) {
      logger.error('Primus client library not available');
      return null;
    }

    // Merge options with defaults
    const connectionOptions = {
      url: options.url || PRIMUS_CONFIG.url,
      path: options.path || PRIMUS_CONFIG.path,
      csrfToken: options.csrfToken || '',
      deviceId: options.deviceId || '',
      tabId: options.tabId,
      withCredentials: options.withCredentials !== undefined ? options.withCredentials : PRIMUS_CONFIG.withCredentials,
      autoConnect: options.autoConnect !== undefined ? options.autoConnect : !PRIMUS_CONFIG.manual,
      reconnect: options.reconnect !== undefined ? options.reconnect : true,
      timeout: options.timeout || PRIMUS_CONFIG.timeout
    };

    // Create the URL
    const url = `${connectionOptions.url}${connectionOptions.path}`;
    
    // Create the Primus connection options
    const primusOptions = {
      // Reconnection settings
      reconnect: connectionOptions.reconnect ? {
        max: PRIMUS_CONFIG.reconnect.max,
        min: PRIMUS_CONFIG.reconnect.min,
        retries: PRIMUS_CONFIG.reconnect.retries,
        factor: PRIMUS_CONFIG.reconnect.factor,
        jitter: PRIMUS_CONFIG.reconnect.jitter
      } : false,
      
      // Connection timeout
      timeout: connectionOptions.timeout,
      
      // Transport strategy
      strategy: PRIMUS_CONFIG.strategy,
      
      // Manual connection
      manual: !connectionOptions.autoConnect,
      
      // Include credentials (cookies)
      withCredentials: connectionOptions.withCredentials,
      
      // Headers for authentication
      transport: {
        headers: {
          [SOCKET_CONFIG.CONNECTION.SECURITY.CSRF_HEADER]: connectionOptions.csrfToken,
          [SOCKET_CONFIG.CONNECTION.SECURITY.DEVICE_ID_HEADER]: connectionOptions.deviceId,
          [SOCKET_CONFIG.CONNECTION.SECURITY.TAB_ID_HEADER]: connectionOptions.tabId,
          [SOCKET_CONFIG.CONNECTION.SECURITY.TIMESTAMP_HEADER]: Date.now().toString()
        }
      }
    };

    // Log connection attempt
    logger.debug('Creating Primus connection', {
      url,
      options: {
        ...primusOptions,
        transport: {
          ...primusOptions.transport,
          headers: {
            ...primusOptions.transport.headers,
            [SOCKET_CONFIG.CONNECTION.SECURITY.CSRF_HEADER]: connectionOptions.csrfToken ? '[REDACTED]' : '',
          }
        }
      }
    });

    // Create the Primus connection
    const primus = new window.Primus(url, primusOptions);

    // Return the connection
    return primus;
  } catch (error) {
    logger.error('Error creating Primus connection', error);
    return null;
  }
}

export default createPrimusConnection;
