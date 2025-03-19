const nodemailer = require('nodemailer');
const { logger } = require('../../../utils/logger');
const emailConfig = require('../config/email.config');

// Create transporter
const transporter = nodemailer.createTransport(emailConfig.transport);

/**
 * Send email
 * @param {Object} options - Email options
 * @returns {Promise}
 */
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: emailConfig.from,
      to: options.to,
      subject: options.subject,
      html: options.html
    };
    
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    logger.error('Email sending failed:', error);
    throw error;
  }
};

/**
 * Send password reset email
 * @param {String} email - User email
 * @param {Object} data - Template data
 */
exports.sendPasswordResetEmail = async (email, data) => {
  return sendEmail({
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h1>Password Reset</h1>
      <p>Hello ${data.name},</p>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${data.resetUrl}">Reset Password</a>
      <p>If you didn't request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `
  });
};

/**
 * Send email verification
 * @param {String} email - User email
 * @param {Object} data - Template data
 */
exports.sendEmailVerification = async (email, data) => {
  return sendEmail({
    to: email,
    subject: 'Verify Your Email',
    html: `
      <h1>Email Verification</h1>
      <p>Hello ${data.name},</p>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${data.verificationUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `
  });
};

/**
 * Send email change verification
 * @param {String} email - New email address
 * @param {Object} data - Template data
 */
exports.sendEmailChangeVerification = async (email, data) => {
  return sendEmail({
    to: email,
    subject: 'Verify Your New Email',
    html: `
      <h1>Email Change Verification</h1>
      <p>Hello ${data.name},</p>
      <p>Please verify your new email address by clicking the link below:</p>
      <a href="${data.verificationUrl}">Verify New Email</a>
      <p>This link will expire in 24 hours.</p>
    `
  });
};