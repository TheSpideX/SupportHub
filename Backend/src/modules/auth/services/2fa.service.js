const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { redisClient } = require('../../../config/redis');

/**
 * Generate a new secret for 2FA
 * @param {string} userEmail - User's email for labeling the 2FA
 * @returns {Object} Object containing secret and QR code data
 */
const generate2FASecret = async (userEmail) => {
  const secret = speakeasy.generateSecret({
    name: `SupportHub:${userEmail}`
  });

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qrCode: qrCodeUrl
  };
};

/**
 * Verify a 2FA token
 * @param {string} token - Token provided by the user
 * @param {string} secret - User's stored secret
 * @returns {boolean} Whether the token is valid
 */
const verify2FAToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1 // Allow 1 step before/after for time drift
  });
};

/**
 * Generate a temporary token for 2FA verification
 * @param {string} userId - User ID
 * @returns {Promise<string>} Temporary token
 */
const generateTempToken = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store in Redis with 10 minute expiry
  await redisClient.set(
    `2fa_temp_token:${token}`, 
    userId,
    'EX',
    600 // 10 minutes
  );
  
  return token;
};

/**
 * Verify a temporary 2FA token
 * @param {string} token - Temporary token
 * @returns {Promise<string|null>} User ID or null if invalid
 */
const verifyTempToken = async (token) => {
  const userId = await redisClient.get(`2fa_temp_token:${token}`);
  if (userId) {
    // Delete the token after use
    await redisClient.del(`2fa_temp_token:${token}`);
  }
  return userId;
};

module.exports = {
  generate2FASecret,
  verify2FAToken,
  generateTempToken,
  verifyTempToken
};