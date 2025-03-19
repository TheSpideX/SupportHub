/**
 * Centralized security configuration
 */
module.exports = {
    // Rate limiting settings
    rateLimiting: {
        login: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per window
            message: 'Too many login attempts, please try again later'
        },
        passwordReset: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3
        },
        emailVerification: {
            windowMs: 24 * 60 * 60 * 1000, // 24 hours
            max: 5
        },
        api: {
            windowMs: 60 * 1000, // 1 minute
            max: 100
        }
    },
    
    // Account lockout settings
    lockout: {
        maxAttempts: 5,
        durationMinutes: 30,
        progressiveDelay: true,
        maxAttemptsPerIP: 10
    },
    
    // CSRF protection
    csrf: {
        enabled: true,
        cookieName: 'csrf_token',       // Match the cookie name used in the controller
        headerName: 'X-CSRF-Token'      // Match the header name expected by frontend
    },
    
    // Session settings
    session: {
        accessTokenExpiry: 15 * 60, // 15 minutes in seconds
        refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days in seconds
        cookieSecure: process.env.NODE_ENV !== 'development',
        cookieHttpOnly: true,
        cookieSameSite: 'lax'
    },
    
    // Password requirements
    password: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
    }
};
