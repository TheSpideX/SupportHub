const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const { AuthError } = require('../errors');
const config = require('../config');

// Token models
const TokenModel = require('../models/token.model');
const BlacklistedTokenModel = require('../models/blacklisted-token.model');

const COMPONENT = 'TokenService';

class TokenService {
  constructor() {
    this.accessTokenSecret = config.jwt.accessSecret;
    this.refreshTokenSecret = config.jwt.refreshSecret;
    this.accessTokenExpiry = config.jwt.accessExpiry || '15m';
    this.refreshTokenExpiry = config.jwt.refreshExpiry || '7d';
    this.extendedRefreshTokenExpiry = config.jwt.extendedRefreshExpiry || '30d';
  }

  /**
   * Generate a pair of tokens (access and refresh) for a user
   * @param {Object} user - User object
   * @param {Object} options - Additional options
   * @returns {Object} Token pair
   */
  async generateTokenPair(user, options = {}) {
    try {
      const { deviceFingerprint, rememberMe = false, sessionId } = options;
      
      // Common payload for both tokens
      const basePayload = {
        sub: user._id.toString(),
        role: user.role || 'user',
        version: user.tokenVersion || 0,
      };

      console.log('Token generation - user ID:', user._id.toString());
      console.log('Token generation - user object:', JSON.stringify({
        id: user._id,
        role: user.role,
        tokenVersion: user.tokenVersion
      }));

      // Add device fingerprint if available
      if (deviceFingerprint) {
        basePayload.deviceFingerprint = deviceFingerprint;
      }

      // Add session ID if available
      if (sessionId) {
        basePayload.sessionId = sessionId.toString();
      }

      // Generate access token
      const accessToken = jwt.sign(
        { ...basePayload, type: 'access' },
        this.accessTokenSecret,
        { expiresIn: this.accessTokenExpiry }
      );

      // Calculate expiry time for refresh token
      const refreshExpiry = rememberMe ? 
        this.extendedRefreshTokenExpiry : 
        this.refreshTokenExpiry;

      // Generate refresh token with unique ID (jti)
      const refreshToken = jwt.sign(
        { 
          ...basePayload, 
          type: 'refresh',
          jti: crypto.randomBytes(16).toString('hex')
        },
        this.refreshTokenSecret,
        { expiresIn: refreshExpiry }
      );

      // Calculate expiration time in seconds
      const decoded = jwt.decode(accessToken);
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

      // Store refresh token in database for tracking
      await this.storeToken(refreshToken, user._id, 'refresh', {
        deviceFingerprint,
        sessionId
      });

      logger.debug('Generated token pair', { 
        component: COMPONENT, 
        userId: user._id,
        expiresIn
      });

      return {
        accessToken,
        refreshToken,
        expiresIn
      };
    } catch (error) {
      logger.error('Failed to generate token pair', { 
        component: COMPONENT, 
        error: error.message 
      });
      throw new AuthError('TOKEN_GENERATION_FAILED');
    }
  }

  /**
   * Verify and decode a token
   * @param {string} token - JWT token to verify
   * @param {string} type - Token type ('access' or 'refresh')
   * @returns {Object} Decoded token payload
   */
  async verifyToken(token, type = 'access') {
    try {
      // Log token details for debugging (remove in production)
      logger.debug('Token verification attempt', { 
        component: COMPONENT,
        tokenLength: token ? token.length : 0,
        tokenType: type,
        tokenFirstChars: token ? token.substring(0, 10) + '...' : 'none'
      });
      
      // Verify the token with the appropriate secret
      const secret = type === 'access' 
        ? this.accessTokenSecret  // Fix: use instance property instead of this.config
        : this.refreshTokenSecret; // Fix: use instance property instead of this.config
      
      const decoded = jwt.verify(token, secret);
      
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        const error = new Error('Token has been revoked');
        error.code = 'TOKEN_REVOKED';
        throw error;
      }
      
      return decoded;
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token has expired');
        err.code = 'TOKEN_EXPIRED';
        throw err;
      } else if (error.name === 'JsonWebTokenError') {
        const err = new Error('Invalid token');
        err.code = 'INVALID_TOKEN';
        throw err;
      }
      throw error;
    }
  }

  /**
   * Decode a token without verification
   * @param {String} token - JWT token
   * @returns {Object} Decoded token payload
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.warn('Failed to decode token', { 
        component: COMPONENT, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Check if a token is blacklisted
   * @param {String} token - JWT token
   * @returns {Boolean} Whether token is blacklisted
   */
  async isTokenBlacklisted(token) {
    try {
      // Hash token for lookup
      const tokenHash = this.hashToken(token);
      
      // Check blacklist
      const blacklistedToken = await BlacklistedTokenModel.findOne({ token: tokenHash });
      
      return !!blacklistedToken;
    } catch (error) {
      logger.error('Error checking blacklisted token', { 
        component: COMPONENT, 
        error: error.message 
      });
      // Default to not blacklisted on error
      return false;
    }
  }

  /**
   * Add a token to the blacklist
   * @param {String} token - JWT token to blacklist
   * @returns {Boolean} Success indicator
   */
  async blacklistToken(token) {
    try {
      // Decode token to get expiration and ID
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        logger.warn('Cannot blacklist invalid token', { component: COMPONENT });
        return false;
      }

      // Calculate TTL (time to live) for the blacklist entry
      const now = Math.floor(Date.now() / 1000);
      const ttl = Math.max(0, decoded.exp - now);

      // Create blacklist entry
      await BlacklistedTokenModel.create({
        token: this.hashToken(token),
        jti: decoded.jti || 'unknown',
        type: decoded.type || 'unknown',
        userId: decoded.sub || 'unknown',
        expiresAt: new Date(decoded.exp * 1000)
      });

      logger.info('Token blacklisted', { 
        component: COMPONENT, 
        tokenId: decoded.jti,
        userId: decoded.sub,
        type: decoded.type
      });

      return true;
    } catch (error) {
      logger.error('Failed to blacklist token', { 
        component: COMPONENT, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Rotate a refresh token (invalidate old, generate new)
   * @param {String} refreshToken - Current refresh token
   * @param {Object} options - Additional options
   * @returns {Object} New token pair
   */
  async rotateRefreshToken(refreshToken, options = {}) {
    try {
      // Verify the refresh token
      const decoded = await this.verifyToken(refreshToken, 'refresh');
      const userId = decoded.sub;

      // Blacklist the old refresh token
      await this.blacklistToken(refreshToken);

      // Get the user object from database
      const UserModel = mongoose.model('User');
      const user = await UserModel.findById(userId);
      
      if (!user) {
        throw new AuthError('USER_NOT_FOUND');
      }

      // Preserve session ID if it exists
      const sessionId = decoded.sessionId;
      
      // Generate new token pair
      return this.generateTokenPair(user, {
        ...options,
        sessionId,
        deviceFingerprint: decoded.deviceFingerprint
      });
    } catch (error) {
      logger.error('Token rotation failed', { 
        component: COMPONENT, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Store token in database for tracking
   * @param {String} token - JWT token
   * @param {String} userId - User ID
   * @param {String} type - Token type
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Stored token record
   */
  async storeToken(token, userId, type, metadata = {}) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded) {
        throw new Error('Invalid token format');
      }

      const { deviceFingerprint, sessionId } = metadata;
      
      // Create token record
      const tokenRecord = await TokenModel.create({
        token: this.hashToken(token),
        user: userId,
        type,
        expiresAt: new Date(decoded.exp * 1000),
        deviceFingerprint,
        metadata: {
          jti: decoded.jti,
          sessionId,
          ...metadata
        }
      });

      return tokenRecord;
    } catch (error) {
      logger.error('Failed to store token', { 
        component: COMPONENT, 
        userId,
        type,
        error: error.message 
      });
      // Don't throw - this is a non-critical operation
      return null;
    }
  }

  /**
   * Revoke all tokens for a user
   * @param {String} userId - User ID
   * @returns {Number} Number of tokens revoked
   */
  async revokeAllUserTokens(userId) {
    try {
      // Mark all tokens as revoked
      const result = await TokenModel.updateMany(
        { user: userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() }
      );

      logger.info('Revoked all user tokens', { 
        component: COMPONENT, 
        userId,
        count: result.modifiedCount
      });

      return result.modifiedCount;
    } catch (error) {
      logger.error('Failed to revoke user tokens', { 
        component: COMPONENT, 
        userId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Validate a token with additional security checks
   * @param {String} token - JWT token
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async validateToken(token, options = {}) {
    try {
      const { expectedType, requireFingerprint, fingerprint } = options;
      
      // Decode token without verification first
      const decoded = this.decodeToken(token);
      if (!decoded) {
        return { valid: false, reason: 'MALFORMED_TOKEN' };
      }

      // Log decoded token for debugging
      console.log('Decoded token:', JSON.stringify(decoded, null, 2));
      
      // Determine token type
      const type = decoded.type || 'access';
      
      // If specific type is expected, check it
      if (expectedType && type !== expectedType) {
        return { valid: false, reason: 'WRONG_TOKEN_TYPE' };
      }

      // Verify token (this checks signature, expiration, and blacklist)
      try {
        await this.verifyToken(token, type);
      } catch (error) {
        return { 
          valid: false, 
          reason: error.code || 'INVALID_TOKEN',
          message: error.message
        };
      }

      // Check device fingerprint if required
      if (requireFingerprint && 
          decoded.deviceFingerprint && 
          decoded.deviceFingerprint !== fingerprint) {
        return { valid: false, reason: 'DEVICE_MISMATCH' };
      }

      return { 
        valid: true, 
        payload: decoded,
        expiresAt: new Date(decoded.exp * 1000)
      };
    } catch (error) {
      logger.error('Token validation error', { 
        component: COMPONENT, 
        error: error.message 
      });
      return { valid: false, reason: 'VALIDATION_ERROR' };
    }
  }

  /**
   * Hash a token for storage
   * @param {String} token - JWT token
   * @returns {String} Hashed token
   */
  hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  /**
   * Clean up expired blacklisted tokens
   * @returns {Number} Number of tokens removed
   */
  async cleanupBlacklistedTokens() {
    try {
      const result = await BlacklistedTokenModel.deleteMany({
        expiresAt: { $lt: new Date() }
      });

      logger.info('Cleaned up expired blacklisted tokens', { 
        component: COMPONENT, 
        count: result.deletedCount
      });

      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to clean up blacklisted tokens', { 
        component: COMPONENT, 
        error: error.message 
      });
      return 0;
    }
  }

  /**
   * Set refresh token in HTTP-only cookie
   * @param {Object} res - Express response object
   * @param {String} token - Refresh token
   * @param {Object} options - Cookie options
   */
  setRefreshTokenCookie(res, token, options = {}) {
    try {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Use lax in development
        maxAge: options.rememberMe 
          ? ms(this.extendedRefreshTokenExpiry) 
          : ms(this.refreshTokenExpiry),
        path: '/', // Set path to root to make cookie available across all routes
        ...options
      };
      
      res.cookie('refreshToken', token, cookieOptions);
      
      logger.debug('Set refresh token cookie', { 
        component: COMPONENT,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        maxAge: cookieOptions.maxAge
      });
    } catch (error) {
      logger.error('Failed to set refresh token cookie', {
        component: COMPONENT,
        error: error.message
      });
    }
  }

  /**
   * Generate token pair and set refresh token cookie
   * @param {Object} user - User object
   * @param {Object} res - Express response object
   * @param {Object} options - Token options
   * @returns {Object} Token pair with access token and expiry
   */
  async generateTokenPairWithCookie(user, res, options = {}) {
    try {
      // Generate token pair
      const tokenPair = await this.generateTokenPair(user, options);
      
      // Set refresh token in cookie
      this.setRefreshTokenCookie(res, tokenPair.refreshToken, {
        rememberMe: options.rememberMe
      });
      
      // Return only access token (refresh token is in cookie)
      return {
        accessToken: tokenPair.accessToken,
        expiresIn: tokenPair.expiresIn
      };
    } catch (error) {
      logger.error('Failed to generate token pair with cookie', {
        component: COMPONENT,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = TokenService;
