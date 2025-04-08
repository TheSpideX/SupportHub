/**
 * Socket.IO Diagnostic Tool
 * 
 * This utility helps diagnose Socket.IO connection issues by providing
 * detailed logging and testing of Socket.IO connections.
 */

import { io, Socket } from 'socket.io-client';
import { logger } from './logger';

interface DiagnosticResult {
  success: boolean;
  connectionId?: string;
  error?: any;
  transportUsed?: string;
  handshakeTime?: number;
  cookies?: string;
  headers?: Record<string, string>;
}

/**
 * Run a diagnostic test on Socket.IO connection
 * @param url The Socket.IO server URL
 * @param options Connection options
 * @returns Promise resolving to diagnostic results
 */
export async function runSocketDiagnostic(
  url: string = 'http://localhost:4290',
  namespace: string = '',
  options: any = {}
): Promise<DiagnosticResult> {
  logger.info(`Running Socket.IO diagnostic on ${url}${namespace}`);
  
  // Default options
  const defaultOptions = {
    transports: ['polling'],
    withCredentials: true,
    timeout: 10000,
    forceNew: true,
    autoConnect: false
  };
  
  // Merge options
  const socketOptions = {
    ...defaultOptions,
    ...options
  };
  
  logger.debug('Socket.IO connection options:', socketOptions);
  
  // Log cookie information
  logger.debug('Cookie information:', {
    hasCookies: document.cookie.length > 0,
    cookieCount: document.cookie.split(';').length,
    cookies: document.cookie
  });
  
  // Create socket instance
  const socket = io(`${url}${namespace}`, socketOptions);
  
  // Create promise to handle connection
  return new Promise((resolve) => {
    const startTime = Date.now();
    let timeoutId: ReturnType<typeof setTimeout>;
    
    // Set timeout
    timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        error: new Error('Connection timeout'),
      });
    }, socketOptions.timeout);
    
    // Handle successful connection
    socket.on('connect', () => {
      const endTime = Date.now();
      const handshakeTime = endTime - startTime;
      
      logger.info(`Socket.IO connected successfully in ${handshakeTime}ms`);
      logger.debug('Socket.IO connection details:', {
        id: socket.id,
        transport: socket.io.engine.transport.name,
        protocol: socket.io.engine.protocol,
        hostname: new URL(url).hostname,
        connected: socket.connected,
        disconnected: socket.disconnected
      });
      
      cleanup();
      resolve({
        success: true,
        connectionId: socket.id,
        transportUsed: socket.io.engine.transport.name,
        handshakeTime,
        cookies: document.cookie,
        headers: {
          'User-Agent': navigator.userAgent,
          'Origin': window.location.origin
        }
      });
    });
    
    // Handle connection error
    socket.on('connect_error', (error) => {
      logger.error('Socket.IO connection error:', error);
      logger.debug('Socket.IO error details:', {
        message: error.message,
        type: error.type,
        description: error.description,
        context: error.context
      });
      
      cleanup();
      resolve({
        success: false,
        error: {
          message: error.message,
          type: error.type || 'unknown',
          description: error.description || 'No description',
          context: error.context || 'unknown'
        }
      });
    });
    
    // Handle general error
    socket.on('error', (error) => {
      logger.error('Socket.IO general error:', error);
      
      cleanup();
      resolve({
        success: false,
        error: error
      });
    });
    
    // Clean up function
    function cleanup() {
      clearTimeout(timeoutId);
      socket.disconnect();
    }
    
    // Start connection
    logger.debug('Initiating Socket.IO connection...');
    socket.connect();
  });
}

/**
 * Test different Socket.IO connection configurations
 * This will try multiple configurations to find one that works
 */
export async function testMultipleConfigurations(): Promise<DiagnosticResult | null> {
  logger.info('Testing multiple Socket.IO configurations...');
  
  const configurations = [
    // Test 1: Basic polling
    {
      url: 'http://localhost:4290',
      namespace: '',
      options: {
        transports: ['polling'],
        withCredentials: true
      },
      description: 'Basic polling to root namespace'
    },
    
    // Test 2: Basic polling to auth namespace
    {
      url: 'http://localhost:4290',
      namespace: '/auth',
      options: {
        transports: ['polling'],
        withCredentials: true
      },
      description: 'Basic polling to auth namespace'
    },
    
    // Test 3: WebSocket only
    {
      url: 'http://localhost:4290',
      namespace: '',
      options: {
        transports: ['websocket'],
        withCredentials: true
      },
      description: 'WebSocket only to root namespace'
    },
    
    // Test 4: Without credentials
    {
      url: 'http://localhost:4290',
      namespace: '',
      options: {
        transports: ['polling'],
        withCredentials: false
      },
      description: 'Polling without credentials'
    },
    
    // Test 5: Different URL format
    {
      url: 'http://127.0.0.1:4290',
      namespace: '',
      options: {
        transports: ['polling'],
        withCredentials: true
      },
      description: 'Using 127.0.0.1 instead of localhost'
    },
    
    // Test 6: With explicit path
    {
      url: 'http://localhost:4290',
      namespace: '',
      options: {
        transports: ['polling'],
        withCredentials: true,
        path: '/socket.io'
      },
      description: 'With explicit socket.io path'
    }
  ];
  
  // Try each configuration
  for (const config of configurations) {
    logger.info(`Testing configuration: ${config.description}`);
    
    try {
      const result = await runSocketDiagnostic(
        config.url,
        config.namespace,
        config.options
      );
      
      if (result.success) {
        logger.info(`✅ Configuration successful: ${config.description}`);
        return result;
      } else {
        logger.warn(`❌ Configuration failed: ${config.description}`);
      }
    } catch (error) {
      logger.error(`Error testing configuration: ${config.description}`, error);
    }
  }
  
  logger.error('All Socket.IO configurations failed');
  return null;
}

/**
 * Check network connectivity to the Socket.IO server
 */
export async function checkNetworkConnectivity(url: string = 'http://localhost:4290'): Promise<boolean> {
  try {
    logger.info(`Checking network connectivity to ${url}/socket.io/`);
    
    // Try to fetch the Socket.IO info endpoint
    const response = await fetch(`${url}/socket.io/`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      logger.info('Network connectivity check successful');
      return true;
    } else {
      logger.warn(`Network connectivity check failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.error('Network connectivity check failed with error:', error);
    return false;
  }
}
