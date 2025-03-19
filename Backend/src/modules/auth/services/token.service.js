const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const config = require('../config');
const logger = require('../../../utils/logger');
const { AuthError } = require('../errors');
const Token = require('../models/token.model');
const redisClient = require('../../../config/redis');

const COMPONENT = 'TokenService';

class TokenService {
  constructor() {
    this.accessTokenSecret = config.jwt.accessSecret;
    this.refreshTokenSecret = config.jwt.refreshSecret;
    this.accessTokenExpiry = config.jwt.accessExpiry;
    this.refreshTokenExpiry = config.jwt.refreshExpiry;
    this.extendedRefreshTokenExpiry = config.jwt.extendedRefreshExpiry;
    this.cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict'
    };
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
        userId: user._id.toString(),
        email: user.email,
        role: user.role || 'user',
        version: user.security?.tokenVersion || 0,
      };

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

      // Store refresh token in database for revocation capability
      await this._storeRefreshToken(refreshToken, user._id, {
        deviceFingerprint,
        expiresAt: new Date(Date.now() + this._getExpiryMilliseconds(refreshExpiry)),
        sessionId
      });

      return { accessToken, refreshToken };
    } catch (error) {
      logger.error('Token generation error', { 
        component: COMPONENT, 
        userId: user._id,
        error: error.message 
      });
      throw new AuthError('Failed to generate tokens', 'TOKEN_GENERATION_ERROR');
    }
  }

  /**
   * Set tokens in cookies
   * @param {Object} res - Express response object
   * @param {Object} user - User object
   * @param {Object} options - Token options
   * @returns {Object} Token pair
   */
  async setTokenCookies(res, user, options = {}) {
    try {
      logger.debug('Setting token cookies', { 
        component: COMPONENT, 
        userId: user._id,
        rememberMe: !!options.rememberMe
      });
      
      // Generate token pair
      const { accessToken, refreshToken } = await this.generateTokenPair(user, options);
      
      // Set access token cookie
      const accessExpiry = this._getExpiryMilliseconds(this.accessTokenExpiry);
      
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: accessExpiry
      });
      
      // Set refresh token cookie with longer expiry if rememberMe is true
      const refreshExpiry = options.rememberMe ? 
        this._getExpiryMilliseconds(this.extendedRefreshTokenExpiry) : 
        this._getExpiryMilliseconds(this.refreshTokenExpiry);
      
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: refreshExpiry
      });
      
      // Return tokens for debugging purposes
      return { accessToken, refreshToken };
    } catch (error) {
      logger.error('Error setting token cookies', { 
        component: COMPONENT, 
        userId: user._id,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Verify a token
   * @param {String} token - JWT token
   * @param {String} type - Token type (access or refresh)
   * @returns {Object} Decoded token
   */
  async verifyToken(token, type = 'access') {
    try {
      const secret = type === 'access' ? this.accessTokenSecret : this.refreshTokenSecret;
      
      // Verify token signature and expiration
      const decoded = jwt.verify(token, secret);
      
      // Ensure token type matches
      if (decoded.type !== type) {
        throw new AuthError('Invalid token type', 'INVALID_TOKEN_TYPE');
      }
      
      // Check if refresh token has been revoked
      if (type === 'refresh' && decoded.jti) {
        const isRevoked = await this._isTokenRevoked(decoded.jti);
        if (isRevoked) {
          throw new AuthError('Token has been revoked', 'TOKEN_REVOKED');
        }
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthError('Token has expired', 'TOKEN_EXPIRED');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthError('Invalid token', 'INVALID_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {String} refreshToken - Refresh token
   * @returns {Object} New access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = await this.verifyToken(refreshToken, 'refresh');
      
      // Get user
      const user = await require('../models/user.model').findById(decoded.userId);
      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }
      
      // Check token version
      if (decoded.version !== user.security.tokenVersion) {
        throw new AuthError('Token version mismatch', 'TOKEN_VERSION_MISMATCH');
      }
      
      // Generate new access token
      const accessToken = jwt.sign(
        {
          sub: user._id.toString(),
          userId: user._id.toString(),
          email: user.email,
          role: user.role || 'user',
          version: user.security.tokenVersion,
          type: 'access',
          deviceFingerprint: decoded.deviceFingerprint,
          sessionId: decoded.sessionId
        },
        this.accessTokenSecret,
        { expiresIn: this.accessTokenExpiry }
      );
      
      return { accessToken };
    } catch (error) {
      logger.error('Token refresh error', { 
        component: COMPONENT, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Revoke a refresh token
   * @param {String} token - Refresh token
   * @returns {Promise<void>}
   */
  async revokeToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.jti) {
        throw new AuthError('Invalid token', 'INVALID_TOKEN');
      }
      
      await Token.findOneAndUpdate(
        { token: decoded.jti },
        { isRevoked: true, revokedAt: new Date() }
      );
      
      // Also add to Redis blacklist for faster lookups
      await redisClient.set(
        `token:blacklist:${decoded.jti}`,
        '1',
        'EX',
        this._getExpirySeconds(decoded.exp)
      );
    } catch (error) {
      logger.error('Token revocation error', { 
        component: COMPONENT, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Revoke all tokens for a user
   * @param {String} userId - User ID
   * @returns {Promise<void>}
   */
  async revokeAllUserTokens(userId) {
    try {
      // Update all tokens in database
      await Token.updateMany(
        { user: userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() }
      );
      
      // Increment user's token version to invalidate all tokens
      const User = require('../models/user.model');
      const user = await User.findById(userId);
      if (user) {
        await user.incrementTokenVersion();
      }
    } catch (error) {
      logger.error('User token revocation error', { 
        component: COMPONENT, 
        userId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Clear token cookies
   * @param {Object} res - Express response object
   */
  clearTokenCookies(res) {
    res.clearCookie('access_token', {
      ...this.cookieOptions,
      maxAge: 0
    });
    
    res.clearCookie('refresh_token', {
      ...this.cookieOptions,
      path: '/api/auth/refresh',
      maxAge: 0
    });
  }

  /**
   * Store refresh token in database
   * @private
   * @param {String} token - Refresh token
   * @param {String} userId - User ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Stored token
   */
  async _storeRefreshToken(token, userId, options = {}) {
    const { deviceFingerprint, expiresAt, sessionId } = options;
    
    // Decode token to get jti
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) {
      throw new AuthError('Invalid token format', 'INVALID_TOKEN_FORMAT');
    }
    
    // Store token in database
    return Token.create({
      token: decoded.jti,
      user: userId,
      type: 'refresh',
      expiresAt: expiresAt || new Date(decoded.exp * 1000),
      deviceFingerprint,
      metadata: {
        sessionId: sessionId?.toString()
      }
    });
  }

  /**
   * Check if a token has been revoked
   * @private
   * @param {String} jti - Token ID
   * @returns {Promise<boolean>} Whether token is revoked
   */
  async _isTokenRevoked(jti) {
    // Check Redis blacklist first for performance
    const blacklisted = await redisClient.get(`token:blacklist:${jti}`);
    if (blacklisted) {
      return true;
    }
    
    // Fall back to database check
    const token = await Token.findOne({ token: jti });
    return token ? token.isRevoked : false;
  }

  /**
   * Convert JWT expiry string to milliseconds
   * @private
   * @param {String} expiry - JWT expiry string
   * @returns {Number} Milliseconds
   */
  _getExpiryMilliseconds(expiry) {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600 * 1000; // Default 1 hour
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600 * 1000;
    }
  }

  /**
   * Get seconds remaining until token expiry
   * @private
   * @param {Number} exp - Token expiry timestamp
   * @returns {Number} Seconds
   */
  _getExpirySeconds(exp) {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, exp - now);
  }

  /**
   * Verify token from cookies
   * @param {Object} req - Express request object
   * @returns {Object} Decoded token
   */
  async verifyTokenFromCookies(req) {
    const accessToken = req.cookies?.access_token;
    
    if (!accessToken) {
      throw new AuthError('No access token provided', 'TOKEN_MISSING');
    }
    
    try {
      return await this.verifyToken(accessToken, 'access');
    } catch (error) {
      // If access token is expired, try to refresh using refresh token
      if (error.code === 'TOKEN_EXPIRED' && req.cookies?.refresh_token) {
        return await this.refreshAccessTokenFromCookie(req.cookies.refresh_token);
      }
      throw error;
    }
  }

  /**
   * Refresh access token from cookie and set new cookie
   * @param {String} refreshToken - Refresh token
   * @param {Object} res - Express response object
   * @returns {Object} New access token
   */
  async refreshAccessTokenFromCookie(refreshToken, res) {
    const { accessToken } = await this.refreshAccessToken(refreshToken);
    
    // Set new access token cookie
    if (res) {
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: this._getExpiryMilliseconds(this.accessTokenExpiry)
      });
    }
    
    return { accessToken };
  }
}

module.exports = new TokenService();
