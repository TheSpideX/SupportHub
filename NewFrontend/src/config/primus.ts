/**
 * Primus Client Configuration
 * 
 * This file contains configuration for the Primus client connection.
 * It's used to configure the reconnection strategy and other Primus-specific options.
 */

import { SOCKET_CONFIG } from './socket';

// Define the Primus reconnection strategy
export const PRIMUS_CONFIG = {
  // Connection URL
  url: SOCKET_CONFIG.SERVER.URL,
  
  // Connection path
  path: SOCKET_CONFIG.SERVER.PATH,
  
  // Reconnection strategy
  reconnect: {
    // Maximum number of reconnection attempts
    max: SOCKET_CONFIG.CONNECTION.RECONNECTION.MAX_ATTEMPTS,
    
    // Minimum delay between reconnection attempts (in ms)
    min: SOCKET_CONFIG.CONNECTION.RECONNECTION.DELAY,
    
    // Maximum delay between reconnection attempts (in ms)
    maxDelay: SOCKET_CONFIG.CONNECTION.RECONNECTION.MAX_DELAY,
    
    // Number of reconnection attempts
    retries: SOCKET_CONFIG.CONNECTION.RECONNECTION.MAX_ATTEMPTS,
    
    // Exponential backoff factor
    factor: 1.5,
    
    // Random jitter factor to prevent thundering herd
    jitter: SOCKET_CONFIG.CONNECTION.RECONNECTION.JITTER,
    
    // Whether to use exponential backoff
    backoff: true
  },
  
  // Connection timeout (in ms)
  timeout: SOCKET_CONFIG.CONNECTION.TIMEOUT,
  
  // Transport strategies
  strategy: ['websocket', 'polling'],
  
  // Whether to manually connect
  manual: true,
  
  // Whether to include credentials (cookies)
  withCredentials: SOCKET_CONFIG.CONNECTION.WITH_CREDENTIALS,
  
  // Ping interval (in ms)
  pingInterval: SOCKET_CONFIG.HEARTBEAT.INTERVAL
};

export default PRIMUS_CONFIG;
