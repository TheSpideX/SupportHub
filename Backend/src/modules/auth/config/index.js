// Environment-aware configuration file
const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = {
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiry: '15m',
        refreshExpiry: '7d',
        issuer: 'SupportHub'
    },
    security: {
        passwordPolicy: {
            minLength: isDevelopment ? 8 : 12,
            requireUppercase: !isDevelopment,
            requireLowercase: !isDevelopment,
            requireNumbers: !isDevelopment,
            requireSpecialChars: !isDevelopment,
            preventCommonPasswords: !isDevelopment,
            passwordHistoryDays: isDevelopment ? 0 : 365,
            passwordHistoryCount: isDevelopment ? 0 : 5
        },
        lockout: {
            maxAttempts: isDevelopment ? 10000 : 5, // Increased for development
            durationMinutes: isDevelopment ? 1 : 30, // Reduced for development
            resetAfterHours: isDevelopment ? 1 : 24,
            progressiveDelay: isDevelopment ? false : true // Disable in development
        },
        session: {  // This is singular "session", not plural "sessions"
            maxConcurrentSessions: isDevelopment ? 10000 : 10,
            sessionTimeout: isDevelopment ? 7 * 24 * 60 * 60 : 24 * 60 * 60,
            extendSessionBeforeExpiry: 15 * 60,
            enforceDeviceBinding: !isDevelopment,
            requireMfaOnNewDevice: !isDevelopment
        },
        deviceVerification: {
            requireVerification: false, // Disable device verification
            verificationTimeout: 10 * 60, // 10 minutes
            maxUnverifiedDevices: isDevelopment ? 10000 : 5, // Increased for development
            deviceFingerprintTimeout: isDevelopment ? 365 * 24 * 60 * 60 : 30 * 24 * 60 * 60 // 1 year in dev
        },
        suspicious: {
            blockImpossibleTravel: false // Disable impossible travel detection
        }
    },
    rateLimiting: {
        login: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: isDevelopment ? 10000 : 5, // Greatly increased for development
        },
        register: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: isDevelopment ? 10000 : 3, // Greatly increased for development
        },
        forgotPassword: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: isDevelopment ? 10000 : 3, // Greatly increased for development
        },
        twoFactor: {
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: isDevelopment ? 10000 : 3, // Greatly increased for development
        },
        refresh: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: isDevelopment ? 10000 : 100, // Greatly increased for development
        }
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
    }
};
