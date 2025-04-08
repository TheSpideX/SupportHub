/**
 * Primus Authentication Middleware
 * Handles authentication for Primus WebSocket connections
 */

const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const logger = require('../../../utils/logger');
const AppError = require('../../../utils/AppError');
const { verifyToken } = require('../services/token.service');
const { validateCsrfToken } = require('./csrf');
const cookieConfig = require('../config').cookies;

/**
 * Authenticate Primus spark (client connection)
 * @param {Object} spark - Primus spark
 * @param {Function} next - Next function
 */
const authenticatePrimus = (spark, next) => {
  try {
    // Extract cookies from request
    const cookies = spark.request.headers.cookie;
    if (!cookies) {
      logger.warn('Primus connection rejected: No cookies found');
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    // Parse cookies
    const parsedCookies = cookie.parse(cookies);
    const accessToken = parsedCookies[cookieConfig.names.ACCESS_TOKEN];

    if (!accessToken) {
      logger.warn('Primus connection rejected: No access token found');
      return next(new AppError('No access token found', 401, 'MISSING_TOKEN'));
    }

    // Verify access token
    verifyToken(accessToken)
      .then(decoded => {
        if (!decoded || !decoded.userId) {
          logger.warn('Primus connection rejected: Invalid token payload');
          return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
        }

        // Store user data on spark
        spark.request.user = decoded;
        spark.request.userId = decoded.userId;

        // Validate CSRF token if enabled
        const csrfToken = spark.request.headers[cookieConfig.csrf.headerName] || 
                         (spark.request.query && spark.request.query.csrf) ||
                         (spark.request.body && spark.request.body.csrf);

        if (cookieConfig.csrf.enabled && !csrfToken) {
          logger.warn('Primus connection rejected: Missing CSRF token');
          return next(new AppError('CSRF token required', 403, 'MISSING_CSRF'));
        }

        if (cookieConfig.csrf.enabled) {
          const csrfCookie = parsedCookies[cookieConfig.csrf.cookieName];
          
          if (!validateCsrfToken(csrfToken, csrfCookie)) {
            logger.warn('Primus connection rejected: Invalid CSRF token');
            return next(new AppError('Invalid CSRF token', 403, 'INVALID_CSRF'));
          }
        }

        // Authentication successful
        logger.debug(`Primus authenticated: ${spark.id} (User: ${decoded.userId})`);
        next();
      })
      .catch(error => {
        logger.error('Primus authentication error:', error);
        next(new AppError('Authentication failed', 401, 'AUTH_FAILED'));
      });
  } catch (error) {
    logger.error('Primus authentication error:', error);
    next(new AppError('Authentication error', 500, 'AUTH_ERROR'));
  }
};

module.exports = {
  authenticatePrimus
};
