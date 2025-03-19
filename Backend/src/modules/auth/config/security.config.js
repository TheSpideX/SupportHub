/**
 * Centralized security configuration
 */
const isDevelopment = process.env.NODE_ENV === 'development';

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
        cookieName: 'csrf_token',       // Match the cookie name in cookie.config.js
        headerName: 'X-CSRF-Token'      // Match the header name expected by frontend
    },
    
    // Password requirements (moved to main index.js)
    
    // Security levels
    levels: {
        low: {
            requireMFA: false,
            sessionTimeout: 24 * 60 * 60, // 24 hours
            passwordExpiryDays: 180       // 6 months
        },
        medium: {
            requireMFA: false,
            sessionTimeout: 8 * 60 * 60,  // 8 hours
            passwordExpiryDays: 90        // 3 months
        },
        high: {
            requireMFA: true,
            sessionTimeout: 1 * 60 * 60,  // 1 hour
            passwordExpiryDays: 30        // 1 month
        }
    }
};
