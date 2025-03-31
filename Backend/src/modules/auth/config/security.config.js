/**
 * Centralized security configuration
 */
const isDevelopment = process.env.NODE_ENV === 'development';
const sessionConfig = require('./session.config');

module.exports = {
    // Rate limiting settings
    rateLimiting: {
        login: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: isDevelopment ? 20 : 5, // 5 attempts per window in production
            message: 'Too many login attempts, please try again later'
        },
        passwordReset: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: isDevelopment ? 10 : 3
        },
        emailVerification: {
            windowMs: 24 * 60 * 60 * 1000, // 24 hours
            max: isDevelopment ? 20 : 5
        },
        api: {
            windowMs: 60 * 1000, // 1 minute
            max: isDevelopment ? 500 : 100
        }
    },
    
    // Account lockout settings
    lockout: {
        maxAttempts: isDevelopment ? 10 : 5,
        durationMinutes: 30,
        progressiveDelay: true,
        maxAttemptsPerIP: isDevelopment ? 30 : 10
    },
    
    // CSRF protection
    csrf: {
        enabled: true,
        cookieName: 'csrf_token',
        headerName: 'X-CSRF-Token',
        tokenTTL: 60 * 60 // 1 hour in seconds
    },
    
    // Security levels - reference session.config.js for timeout values
    levels: {
        low: {
            requireMFA: false,
            sessionTimeout: sessionConfig.timeouts.absolute, // 24 hours
            passwordExpiryDays: 180       // 6 months
        },
        medium: {
            requireMFA: false,
            sessionTimeout: sessionConfig.timeouts.absolute / 3, // 8 hours
            passwordExpiryDays: 90        // 3 months
        },
        high: {
            requireMFA: true,
            sessionTimeout: sessionConfig.timeouts.absolute / 24, // 1 hour
            passwordExpiryDays: 30        // 1 month
        }
    },
    
    // WebSocket security settings
    socket: {
        enforceOrigin: true,
        allowedOrigins: [
            process.env.FRONTEND_URL || 'http://localhost:5173'
        ],
        maxPayloadSize: 1024 * 1024, // 1MB
        rateLimiting: {
            messagesPerMinute: isDevelopment ? 300 : 100,
            connectionsPerIP: isDevelopment ? 50 : 20
        },
        securityEvents: {
            propagationDelay: 500, // ms delay between broadcasting security events
            retryAttempts: 3 // Number of times to retry sending critical security events
        }
    }
};
