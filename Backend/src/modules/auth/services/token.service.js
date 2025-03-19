const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const TokenModel = require('../models/token.model');
const tokenConfig = require('../config/token.config');
const logger = require('../../../utils/logger');
const { v4: uuidv4 } = require('uuid');

class TokenService {
  /**
   * Generate authentication tokens
   * @param {Object} user - User object
   * @param {String} sessionId - Session ID
   * @param {Boolean} rememberMe - Whether to extend token lifetime
   * @returns {Object} Object containing tokens
   */
  async generateTokens(user, sessionId, rememberMe = false) {
    // Generate access token with short expiry
    const accessToken = jwt.sign(
      {
        sub: user._id,
        email: user.email,
        role: user.role,
        tokenVersion: user.security.tokenVersion,
        sessionId
      },
      tokenConfig.ACCESS_TOKEN_SECRET,
      {
        expiresIn: tokenConfig.ACCESS_TOKEN_EXPIRY,
        jwtid: uuidv4()
      }
    );
    
    // Generate refresh token with longer expiry if rememberMe
    const refreshToken = jwt.sign(
      {
        sub: user._id,
        tokenVersion: user.security.tokenVersion,
        sessionId
      },
      tokenConfig.REFRESH_TOKEN_SECRET,
      {
        expiresIn: rememberMe 
          ? tokenConfig.REFRESH_TOKEN_EXPIRY * 7 // 7x longer for remember me
          : tokenConfig.REFRESH_TOKEN_EXPIRY,
        jwtid: uuidv4()
      }
    );
    
    // Generate CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex');
    
    return {
      accessToken,
      refreshToken,
      csrfToken
    };
  }

  /**
   * Generate access token
   * @param {Object} user - User object
   * @returns {String} JWT access token
   */
  generateAccessToken(user) {
    const payload = {
      sub: user.id || user._id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      type: 'access'
    };

    return jwt.sign(payload, tokenConfig.ACCESS_TOKEN_SECRET, {
      expiresIn: tokenConfig.ACCESS_TOKEN_EXPIRY
    });
  }

  /**
   * Generate refresh token
   * @param {Object} user - User object
   * @returns {String} JWT refresh token
   */
  generateRefreshToken(user) {
    const payload = {
      sub: user.id || user._id,
      type: 'refresh',
      tokenVersion: user.tokenVersion || 0
    };

    return jwt.sign(payload, tokenConfig.REFRESH_TOKEN_SECRET, {
      expiresIn: tokenConfig.REFRESH_TOKEN_EXPIRY
    });
  }

  /**
   * Generate CSRF token
   * @returns {String} CSRF token
   */
  generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Save refresh token to database
   * @param {String|ObjectId} userId - User ID
   * @param {String} refreshToken - Refresh token
   * @returns {Promise} Promise resolving to saved token
   */
  async saveRefreshToken(userId, refreshToken) {
    try {
      // Convert userId to a valid ObjectId
      let userObjectId;
      
      try {
        // If it's already an ObjectId, use it directly
        if (mongoose.Types.ObjectId.isValid(userId)) {
          userObjectId = new mongoose.Types.ObjectId(userId);
        } else if (typeof userId === 'string') {
          // If it's a string that can be converted to ObjectId
          if (mongoose.Types.ObjectId.isValid(userId)) {
            userObjectId = new mongoose.Types.ObjectId(userId);
          } else {
            throw new Error(`Invalid user ID format: ${userId}`);
          }
        } else {
          // For other cases, try to get string representation
          const userIdStr = userId.toString();
          if (mongoose.Types.ObjectId.isValid(userIdStr)) {
            userObjectId = new mongoose.Types.ObjectId(userIdStr);
          } else {
            throw new Error(`Cannot convert user ID to ObjectId: ${userIdStr}`);
          }
        }
      } catch (err) {
        logger.error('Error converting user ID to ObjectId:', err);
        throw new Error(`Invalid user ID: ${userId}`);
      }
      
      // Create token document
      const tokenDoc = new TokenModel({
        user: userObjectId,
        token: refreshToken,
        type: 'refresh',
        expiresAt: new Date(Date.now() + tokenConfig.REFRESH_TOKEN_EXPIRY * 1000)
      });

      // Save to database
      return await tokenDoc.save();
    } catch (error) {
      logger.error('Error saving refresh token:', error);
      throw error;
    }
  }

  /**
   * Set token cookies on response object
   * @param {Object} res - Express response object
   * @param {Object} tokens - Object containing tokens
   */
  setTokenCookies(res, tokens) {
    // Access token cookie (short-lived)
    res.cookie(cookieConfig.names.ACCESS_TOKEN, tokens.accessToken, {
      ...cookieConfig.baseOptions,
      maxAge: tokenConfig.ACCESS_TOKEN_EXPIRY * 1000
    });
    
    // Refresh token cookie (longer-lived)
    res.cookie(cookieConfig.names.REFRESH_TOKEN, tokens.refreshToken, {
      ...cookieConfig.baseOptions,
      maxAge: tokenConfig.REFRESH_TOKEN_EXPIRY * 1000
    });
    
    // CSRF token (JavaScript accessible)
    res.cookie(cookieConfig.names.CSRF_TOKEN, tokens.csrfToken, {
      ...cookieConfig.csrfOptions,
      maxAge: tokenConfig.ACCESS_TOKEN_EXPIRY * 1000
    });
  }

  /**
   * Clear token cookies
   * @param {Object} res - Express response object
   */
  clearTokenCookies(res) {
    res.cookie(cookieConfig.names.ACCESS_TOKEN, '', { 
      ...cookieConfig.baseOptions, 
      maxAge: 0 
    });
    
    res.cookie(cookieConfig.names.REFRESH_TOKEN, '', { 
      ...cookieConfig.baseOptions, 
      maxAge: 0 
    });
    
    res.cookie(cookieConfig.names.CSRF_TOKEN, '', { 
      ...cookieConfig.csrfOptions, 
      maxAge: 0 
    });
  }

  /**
   * Verify access token
   * @param {String} token - JWT access token
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, tokenConfig.ACCESS_TOKEN_SECRET);
      
      // Verify it's an access token
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      logger.error('Access token verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify refresh token
   * @param {String} token - JWT refresh token
   * @returns {Object} Decoded token payload
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, tokenConfig.REFRESH_TOKEN_SECRET);
      
      // Verify it's a refresh token
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      logger.error('Refresh token verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify token exists in database
   * @param {String} token - Refresh token
   * @returns {Promise<Boolean>} Whether token exists and is valid
   */
  async verifyTokenInDatabase(token) {
    try {
      const tokenDoc = await TokenModel.findOne({ token, type: 'refresh' });
      
      if (!tokenDoc) {
        return false;
      }
      
      // Check if token is expired
      if (tokenDoc.expiresAt < new Date()) {
        await TokenModel.deleteOne({ _id: tokenDoc._id });
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Error verifying token in database:', error);
      return false;
    }
  }

  /**
   * Delete refresh token from database
   * @param {String} token - Refresh token
   * @returns {Promise<Boolean>} Whether deletion was successful
   */
  async deleteRefreshToken(token) {
    try {
      const result = await TokenModel.deleteOne({ token, type: 'refresh' });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Error deleting refresh token:', error);
      return false;
    }
  }

  /**
   * Delete all refresh tokens for a user
   * @param {String} userId - User ID
   * @returns {Promise<Number>} Number of tokens deleted
   */
  async deleteAllUserTokens(userId) {
    try {
      const result = await TokenModel.deleteMany({ user: userId, type: 'refresh' });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error deleting all user tokens:', error);
      return 0;
    }
  }

  /**
   * Rotate refresh token
   * @param {String} oldToken - Old refresh token
   * @param {Object} user - User object
   * @returns {Promise<Object>} New tokens
   */
  async rotateRefreshToken(oldToken, user) {
    try {
      // Verify old token exists in database
      const isValid = await this.verifyTokenInDatabase(oldToken);
      
      if (!isValid) {
        throw new Error('Invalid refresh token');
      }
      
      // Delete old token
      await this.deleteRefreshToken(oldToken);
      
      // Generate new tokens
      return await this.generateAuthTokens(user);
    } catch (error) {
      logger.error('Error rotating refresh token:', error);
      throw error;
    }
  }
}

module.exports = new TokenService();
