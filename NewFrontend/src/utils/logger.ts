type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogCategory = 'auth' | 'security' | 'performance' | 'user' | 'system';

interface LogContext {
  component?: string;
  action?: string;
  category?: LogCategory;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  category: LogCategory;
  metadata: Record<string, any>;
}

export class Logger {
  private isDevelopment = import.meta.env.MODE === 'development';
  private readonly SENSITIVE_FIELDS = ['password', 'token', 'secret', 'credential', 'auth'];
  private component: string;

  constructor(component?: string) {
    this.component = component || 'App';
  }

  private formatMessage(
    level: LogLevel, 
    message: string, 
    context: LogContext = {},
    category: LogCategory = 'system',
    fileIdentifier?: string
  ): LogEntry {
    const timestamp = new Date().toISOString();
    const componentInfo = context.component ? `[${context.component}]` : '';
    const fileInfo = fileIdentifier ? `[${fileIdentifier}]` : '';
    
    // Remove sensitive data
    const sanitizedContext = this.sanitizeSensitiveData(context);
    
    return {
      timestamp,
      level,
      category,
      message: `${componentInfo}${fileInfo} ${message}`,
      metadata: sanitizedContext
    };
  }

  private sanitizeSensitiveData(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'object') {
      const sanitized = { ...data };
      for (const key in sanitized) {
        if (this.SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitizeSensitiveData(sanitized[key]);
        }
      }
      return sanitized;
    }
    
    return data;
  }

  private async persistLog(logEntry: LogEntry): Promise<void> {
    try {
      // Store in localStorage for development
      if (this.isDevelopment) {
        const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
        logs.push(logEntry);
        localStorage.setItem('app_logs', JSON.stringify(logs.slice(-1000))); // Keep last 1000 logs
      }

      // Send to backend in production
      if (!this.isDevelopment) {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logEntry)
        });
      }
    } catch (error) {
      console.error('Failed to persist log:', error);
    }
  }

  // Add a function to get the calling file information
  private getCallerInfo(): string | undefined {
    try {
      const err = new Error();
      const stack = err.stack || '';
      const stackLines = stack.split('\n');
      
      // Skip the first few lines which are this function and the logger methods
      // Usually the 4th line contains the actual caller
      if (stackLines.length >= 4) {
        const callerLine = stackLines[3];
        // Extract file path from the stack trace
        const match = callerLine.match(/\((.+?):\d+:\d+\)/) || 
                      callerLine.match(/at\s+(.+?):\d+:\d+/);
        
        if (match && match[1]) {
          // Get just the filename without the full path
          const fullPath = match[1];
          const pathParts = fullPath.split('/');
          return pathParts[pathParts.length - 1];
        }
      }
      return undefined;
    } catch (e) {
      // If anything goes wrong, just return undefined
      return undefined;
    }
  }

  debug(message: string, context: LogContext = {}, category: LogCategory = 'system', fileIdentifier?: string): void {
    const caller = fileIdentifier || this.getCallerInfo();
    const logEntry = this.formatMessage('debug', message, context, category, caller);
    console.debug(logEntry.message, logEntry.metadata);
    this.persistLog(logEntry);
  }

  info(message: string, context: LogContext = {}, category: LogCategory = 'system', fileIdentifier?: string): void {
    const caller = fileIdentifier || this.getCallerInfo();
    const logEntry = this.formatMessage('info', message, context, category, caller);
    
    // If in development, also log to console
    if (this.isDevelopment) {
      console.info(`%c${logEntry.message}`, 'color: #6495ED', logEntry.metadata);
    }
    
    this.persistLog(logEntry);
  }

  warn(message: string, context: LogContext = {}, category: LogCategory = 'system', fileIdentifier?: string): void {
    const caller = fileIdentifier || this.getCallerInfo();
    const logEntry = this.formatMessage('warn', message, context, category, caller);
    console.warn(logEntry.message, logEntry.metadata);
    this.persistLog(logEntry);
  }

  error(message: string, error?: Error | any, context: LogContext = {}, category: LogCategory = 'system', fileIdentifier?: string): void {
    const caller = fileIdentifier || this.getCallerInfo();
    const errorContext: LogContext = {
      ...context,
      error: this.sanitizeSensitiveData(error),
      stack: error?.stack,
      code: error?.code,
    };
    const logEntry = this.formatMessage('error', message, errorContext, category, caller);
    console.error(logEntry.message, logEntry.metadata);
    this.persistLog(logEntry);
  }

  trackPerformance(action: string, duration: number, context?: LogContext, fileIdentifier?: string) {
    this.info(`Performance: ${action}`, {
      ...context,
      duration,
      category: 'performance'
    }, 'performance', fileIdentifier);
  }
}

// Export a default instance
export const logger = new Logger();

// Add a helper function to create a file-specific logger
export function createFileLogger(fileIdentifier: string) {
  return {
    debug: (message: string, context: LogContext = {}, category: LogCategory = 'system') => 
      logger.debug(message, context, category, fileIdentifier),
    
    info: (message: string, context: LogContext = {}, category: LogCategory = 'system') => 
      logger.info(message, context, category, fileIdentifier),
    
    warn: (message: string, context: LogContext = {}, category: LogCategory = 'system') => 
      logger.warn(message, context, category, fileIdentifier),
    
    error: (message: string, error?: Error | any, context: LogContext = {}, category: LogCategory = 'system') => 
      logger.error(message, error, context, category, fileIdentifier),
    
    trackPerformance: (action: string, duration: number, context?: LogContext) => 
      logger.trackPerformance(action, duration, context, fileIdentifier)
  };
}
