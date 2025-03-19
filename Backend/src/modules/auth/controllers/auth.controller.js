const { AuthError } = require('../errors');
const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const securityService = require('../services/security.service');
const logger = require('../../../utils/logger');
const csrfUtils = require('../utils/csrf.utils');
const securityUtils = require('../utils/security.utils');

const COMPONENT = 'AuthController';

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.login = async (req, res, next) => {
  const requestStartTime = Date.now();
  const { email, password, rememberMe = false, deviceInfo = {} } = req.body;
  
  try {
    logger.info("Login attempt", {
      component: COMPONENT,
      email: email.substring(0, 3) + '***', // Log only part of the email for privacy
      hasDeviceInfo: !!deviceInfo
    });
    
    // Get client IP
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Merge device info with request data
    const enhancedDeviceInfo = {
      ...deviceInfo,
      ip: clientIp,
      userAgent: req.headers['user-agent'] || deviceInfo.userAgent
    };
    
    // Authenticate user
    const authResult = await authService.authenticateUser({
      email,
      password,
      rememberMe,
      deviceInfo: enhancedDeviceInfo
    });
    
    // Set tokens in cookies
    await tokenService.setTokenCookies(res, authResult.user, {
      rememberMe,
      deviceFingerprint: enhancedDeviceInfo.fingerprint,
      sessionId: authResult.session._id
    });
    
    // Generate CSRF token
    const csrfToken = csrfUtils.generateToken();
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false, // Must be accessible to JavaScript
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 1 day
    });
    
    // Log successful login
    logger.info("Login successful", {
      component: COMPONENT,
      userId: authResult.user._id,
      responseTime: Date.now() - requestStartTime,
    });
    
    // Return user data without sensitive information
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: authService.sanitizeUser(authResult.user),
        csrfToken,
        // Include session info for frontend
        session: {
          id: authResult.session._id,
          expiresAt: authResult.session.expiresAt
        }
      }
    });
  } catch (error) {
    logger.error("Login failed", {
      component: COMPONENT,
      email: email.substring(0, 3) + '***',
      error: error.message,
      stack: error.stack,
      responseTime: Date.now() - requestStartTime
    });
    
    next(error);
  }
}

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.logout = async (req, res) => {
    const requestStartTime = Date.now();
    const COMPONENT = 'AuthController.logout';
    
    try {
        const { allDevices } = req.body;
        const userId = req.user._id;
        const sessionId = req.decodedToken?.sessionId;
        
        // Log logout attempt
        logger.info("Logout attempt", {
            component: COMPONENT,
            userId,
            sessionId,
            allDevices
        });
        
        // Perform logout
        await authService.logoutUser({
            userId,
            sessionId,
            allDevices
        });
        
        // Clear auth cookies
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        res.clearCookie('csrf_token');
        
        // Log successful logout
        logger.info("Logout successful", {
            component: COMPONENT,
            userId,
            responseTime: Date.now() - requestStartTime,
        });
        
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        // Log error
        logger.error("Logout error", {
            component: COMPONENT,
            error: error.message,
            stack: error.stack,
            responseTime: Date.now() - requestStartTime,
        });
        
        // Return error response
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: error.message
        });
    }
};

/**
 * Refresh access token
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
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
        
        // Generate new CSRF token
        const csrfToken = csrfUtils.generateToken();
        res.cookie('csrf_token', csrfToken, {
            httpOnly: false,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                csrfToken
            }
        });
    } catch (error) {
        // Clear cookies on refresh error
        tokenService.clearTokenCookies(res);
        res.clearCookie('csrf_token');
        
        next(error);
    }
};

/**
 * Get current user
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // The user should be attached to req by the auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }
    
    // Return user data (excluding sensitive information)
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          // Add other non-sensitive user fields
        }
      }
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user data',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * Register new user
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
exports.register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        
        // Get device info from request
        const deviceInfo = req.body.deviceInfo || {};
        const safeDeviceInfo = sanitizeDeviceInfo(deviceInfo);
        
        // Register user
        const user = await authService.registerUser({
            email,
            password,
            firstName,
            lastName,
            deviceInfo: safeDeviceInfo
        });
        
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: authService.sanitizeUser(user)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get authentication status
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
exports.getAuthStatus = async (req, res) => {
  try {
    // If the request has a user property, they're authenticated
    const isAuthenticated = !!req.user;
    
    return res.status(200).json({
      success: true,
      isAuthenticated,
      // Only include user data if authenticated
      user: isAuthenticated ? {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        roles: req.user.roles,
        permissions: req.user.permissions
      } : null
    });
  } catch (error) {
    logger.error('Error checking auth status', {
      component: COMPONENT,
      error: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to check authentication status',
      error: {
        code: 'AUTH_STATUS_ERROR',
        message: error.message
      }
    });
  }
};

/**
 * Sync session with frontend
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.syncSession = async (req, res, next) => {
    const requestStartTime = Date.now();
    const COMPONENT = 'AuthController.syncSession';
    
    try {
        const { sessionId, lastActivity, metrics, deviceInfo } = req.body;
        
        // If user is authenticated, use their session
        if (req.user) {
            const result = await authService.syncSession({
                sessionId: sessionId || req.decodedToken?.sessionId,
                lastActivity,
                metrics,
                deviceInfo
            });
            
            return res.json({
                status: result.status,
                expiresAt: result.expiresAt
            });
        }
        
        // For unauthenticated requests, return a generic response
        return res.json({
            status: 'valid',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes from now
        });
    } catch (error) {
        logger.error("Session sync failed", {
            component: COMPONENT,
            error: error.message,
            responseTime: Date.now() - requestStartTime
        });
        
        next(error);
    }
};
