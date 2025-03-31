const logger = require('../../../utils/logger');

/**
 * Simple email service with no third-party dependencies
 * This is a placeholder implementation that logs email operations
 * but doesn't actually send emails
 */
class EmailService {
  constructor() {
    this.enabled = process.env.EMAIL_ENABLED === 'true';
    logger.info('Email service initialized', {
      enabled: this.enabled,
      mode: 'development-only'
    });
  }

  /**
   * Send verification email
   * @param {string} email - Recipient email address
   * @param {Object} data - Email template data
   * @returns {Promise<Object>} - Result of the operation
   */
  async sendVerificationEmail(email, data) {
    logger.info('Verification email requested', {
      recipient: email,
      verificationUrl: data.verificationUrl
    });

    if (!this.enabled) {
      logger.info('Email sending skipped (disabled in config)');
      return { success: true, sent: false };
    }

    // In a real implementation, this would send an actual email
    // For now, we just log the details
    logger.info(`[DEV MODE] Verification email would be sent to ${email}`, {
      subject: 'Verify Your Email Address',
      name: data.name,
      verificationUrl: data.verificationUrl
    });

    return {
      success: true,
      sent: false,
      messageId: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      message: 'Email would be sent in production mode'
    };
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email address
   * @param {Object} data - Email template data
   * @returns {Promise<Object>} - Result of the operation
   */
  async sendPasswordResetEmail(email, data) {
    logger.info('Password reset email requested', {
      recipient: email,
      resetUrl: data.resetUrl
    });

    if (!this.enabled) {
      logger.info('Email sending skipped (disabled in config)');
      return { success: true, sent: false };
    }

    // In a real implementation, this would send an actual email
    // For now, we just log the details
    logger.info(`[DEV MODE] Password reset email would be sent to ${email}`, {
      subject: 'Reset Your Password',
      name: data.name,
      resetUrl: data.resetUrl
    });

    return {
      success: true,
      sent: false,
      messageId: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      message: 'Email would be sent in production mode'
    };
  }

  /**
   * Send welcome email
   * @param {string} email - Recipient email address
   * @param {Object} data - Email template data
   * @returns {Promise<Object>} - Result of the operation
   */
  async sendWelcomeEmail(email, data) {
    logger.info('Welcome email requested', {
      recipient: email
    });

    if (!this.enabled) {
      logger.info('Email sending skipped (disabled in config)');
      return { success: true, sent: false };
    }

    // In a real implementation, this would send an actual email
    // For now, we just log the details
    logger.info(`[DEV MODE] Welcome email would be sent to ${email}`, {
      subject: 'Welcome to Our Platform',
      name: data.name
    });

    return {
      success: true,
      sent: false,
      messageId: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      message: 'Email would be sent in production mode'
    };
  }
}

module.exports = new EmailService();