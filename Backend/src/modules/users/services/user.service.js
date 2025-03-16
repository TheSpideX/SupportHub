const mongoose = require('mongoose');
const logger = require('../../../utils/logger');

/**
 * User Service for managing user operations
 */
class UserService {
  constructor() {
    this.COMPONENT = 'UserService';
    // Get the User model
    this.User = mongoose.model('User');
  }

  /**
   * Find a user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User document
   */
  async findByEmail(email) {
    try {
      logger.debug('Finding user by email', { component: this.COMPONENT, email });
      
      if (!email) {
        throw new Error('Email is required');
      }
      
      const user = await this.User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        logger.warn('User not found', { component: this.COMPONENT, email });
        throw new Error('INVALID_CREDENTIALS');
      }
      
      return user;
    } catch (error) {
      logger.error('Error finding user by email', { 
        component: this.COMPONENT, 
        email,
        errorMessage: error.message || 'Unknown error' 
      });
      throw error;
    }
  }
}

module.exports = UserService;