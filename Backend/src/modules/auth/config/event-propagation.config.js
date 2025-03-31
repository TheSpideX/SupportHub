/**
 * Event propagation configuration for WebSocket authentication system
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const eventPropagationConfig = {
  // Event types and their propagation rules
  events: {
    // Token events
    'token:expiring': {
      direction: 'down', // Propagate down the hierarchy
      persist: true, // Store in event history
      priority: 'high', // High priority event
      throttle: false // Don't throttle these events
    },
    'token:refreshed': {
      direction: 'down',
      persist: true,
      priority: 'high',
      throttle: false
    },
    'token:invalid': {
      direction: 'down',
      persist: true,
      priority: 'critical',
      throttle: false
    },
    
    // Session events
    'session:activity': {
      direction: 'up', // Propagate up the hierarchy
      persist: false, // Don't store in event history
      priority: 'low',
      throttle: true, // Throttle these frequent events
      throttleWindow: 5000 // Throttle window in ms
    },
    'session:timeout_warning': {
      direction: 'down',
      persist: true,
      priority: 'medium',
      throttle: false
    },
    'session:terminated': {
      direction: 'both', // Propagate both up and down
      persist: true,
      priority: 'high',
      throttle: false
    },
    
    // Security events
    'security:password_changed': {
      direction: 'down',
      persist: true,
      priority: 'critical',
      throttle: false
    },
    'security:suspicious_activity': {
      direction: 'down',
      persist: true,
      priority: 'critical',
      throttle: false
    },
    'security:device_verified': {
      direction: 'both',
      persist: true,
      priority: 'high',
      throttle: false
    },
    'security:permission_changed': {
      direction: 'down',
      persist: true,
      priority: 'high',
      throttle: false
    }
  },
  
  // Propagation engine settings
  engine: {
    // Queue settings
    queueSize: 10000, // Maximum queue size
    processingConcurrency: isDevelopment ? 5 : 20, // Concurrent event processing
    
    // Processing settings
    batchSize: 100, // Process events in batches
    processingInterval: 50, // ms between processing batches
    
    // Priority settings (ms delay before processing)
    priorityDelays: {
      critical: 0, // No delay for critical events
      high: 100, // 100ms delay for high priority
      medium: 500, // 500ms delay for medium priority
      low: 2000 // 2s delay for low priority
    },
    
    // Retry settings
    retryAttempts: 3, // Number of retry attempts
    retryDelay: 1000, // Initial retry delay in ms
    
    // Monitoring
    monitoringEnabled: true, // Enable monitoring
    metricsInterval: 60000, // Collect metrics every minute
    alertThreshold: 1000 // Alert if queue exceeds this size
  }
};

module.exports = eventPropagationConfig;