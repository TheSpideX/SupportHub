const { AuthError } = require('../errors');
const tokenService = require('../services/token.service');
const User = require('../models/user.model');
const logger = require('../../../utils/logger');

const COMPONENT = 'AuthMiddleware';

/**
 * Middleware to authenticate requests using JWT
 * @param {Object} options - Authentication options
 * @returns {Function} Express middleware
 */
exports.authenticate = (options = {}) => {
    const { 
        required = true, 
        roles = null,
        checkFingerprint = true
    } = options;
    
    return async (req, res, next) => {
        try {
            // Get token from Authorization header or cookie
            const headerToken = req.headers.authorization?.split(' ')[1];
            const cookieToken = req.cookies?.access_token;
            
            // If no token and not required, continue
            if (!headerToken && !cookieToken) {
                if (!required) {
                    return next();
                }
                throw new AuthError('Authentication required', 'AUTHENTICATION_REQUIRED');
            }
            
            // Prefer cookie token over header token for security
            const token = cookieToken || headerToken;
            
            // Verify token
            const decoded = await tokenService.verifyToken(token, 'access');
            
            // Get user
            const user = await User.findById(decoded.userId);
            if (!user) {
                throw new AuthError('User not found', 'USER_NOT_FOUND');
            }
            
            // Check if token version matches
            if (decoded.version !== user.security?.tokenVersion) {
                throw new AuthError('Token has been revoked', 'TOKEN_REVOKED');
            }
            
            // Check device fingerprint if required
            if (checkFingerprint && 
                decoded.deviceFingerprint && 
                req.body.deviceInfo?.fingerprint && 
                decoded.deviceFingerprint !== req.body.deviceInfo.fingerprint) {
                throw new AuthError('Device fingerprint mismatch', 'DEVICE_MISMATCH');
            }
            
            // Check role if specified
            if (roles && !roles.includes(user.role)) {
                throw new AuthError('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS');
            }
            
            // Attach user and token to request
            req.user = user;
            req.token = token;
            req.decodedToken = decoded;
            
            next();
        } catch (error) {
            if (error.code === 'TOKEN_EXPIRED') {
                // Try to refresh token if available
                try {
                    const refreshToken = req.cookies?.refresh_token;
                    if (refreshToken) {
                        const { accessToken } = await tokenService.refreshAccessToken(refreshToken);
                        
                        // Set new access token in cookie
                        tokenService.setTokenCookies({ accessToken, refreshToken }, res);
                        
                        // Verify the new token
                        const decoded = await tokenService.verifyToken(accessToken, 'access');
                        
                        // Get user
                        const user = await User.findById(decoded.userId);
                        if (!user) {
                            throw new AuthError('User not found', 'USER_NOT_FOUND');
                        }
                        
                        // Attach user and token to request
                        req.user = user;
                        req.token = accessToken;
                        req.decodedToken = decoded;
                        
                        return next();
                    }
                } catch (refreshError) {
                    logger.debug('Token refresh failed during authentication', {
                        component: COMPONENT,
                        error: refreshError.message
                    });
                    // Continue to error handling
                }
            }
            
            if (!required) {
                return next();
            }
            
            if (error.code === 'TOKEN_EXPIRED') {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'TOKEN_EXPIRED',
                        message: 'Your session has expired, please log in again'
                    }
                });
            }
            
            next(error);
        }
    };
};

/**
 * Middleware to refresh access token
 */
exports.refreshToken = async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.refresh_token;
        
        if (!refreshToken) {
            throw new AuthError('Refresh token required', 'REFRESH_TOKEN_REQUIRED');
        }
        
        const { accessToken } = await tokenService.refreshAccessToken(refreshToken);
        
        // Set new access token in cookie
        tokenService.setTokenCookies({ accessToken, refreshToken }, res);
        
        res.json({
            success: true,
            message: 'Token refreshed successfully'
        });
    } catch (error) {
        // Clear cookies on refresh error
        tokenService.clearTokenCookies(res);
        
        next(error);
    }
};

/**
 * Middleware to check CSRF token
 */
exports.csrfProtection = (req, res, next) => {
    // Skip for non-mutating methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    
    const csrfToken = req.headers['x-csrf-token'];
    const storedToken = req.cookies?.['csrf_token'];
    
    if (!csrfToken || !storedToken || csrfToken !== storedToken) {
        return res.status(403).json({
            success: false,
            error: {
                code: 'INVALID_CSRF_TOKEN',
                message: 'Invalid or missing CSRF token'
            }
        });
    }
    
    next();
};

/**
 * Middleware to authenticate requests using JWT in HTTP-only cookies
 * @param {Object} options - Authentication options
 * @returns {Function} Express middleware
 */
exports.authenticateToken = async (req, res, next) => {
    try {
        const token = req.cookies?.access_token;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_REQUIRED',
                    message: 'Access token required'
                }
            });
        }
        
        try {
            // Verify token
            const decoded = await tokenService.verifyToken(token, 'access');
            
            // Get user
            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User not found'
                    }
                });
            }
            
            // Attach user to request
            req.user = user;
            req.token = token;
            req.decodedToken = decoded;
            
            next();
        } catch (error) {
            console.error('Token verification error:', error);
            return res.status(401).json({
                success: false,
                error: {
                    code: error.code || 'AUTHENTICATION_FAILED',
                    message: error.message || 'Authentication failed'
                }
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal server error'
            }
        });
    }
};

/**
 * Middleware to optionally authenticate a user
 * Doesn't reject the request if no token is present
 */
exports.optionalAuth = (req, res, next) => {
    try {
        const token = req.cookies?.access_token;
        
        if (!token) {
            // Continue without authentication
            return next();
        }
        
        // Try to authenticate but don't fail if invalid
        tokenService.verifyToken(token, 'access')
            .then(decoded => {
                User.findById(decoded.userId)
                    .then(user => {
                        if (user) {
                            req.user = user;
                            req.token = token;
                            req.decodedToken = decoded;
                        }
                        next();
                    })
                    .catch(() => next());
            })
            .catch(() => next());
    } catch (error) {
        // Continue without authentication
        next();
    }
};
