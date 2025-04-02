/**
 * Security Notification Model
 * Stores security-related notifications for users
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Add new notification types while maintaining backward compatibility
const notificationTypes = [
  'suspicious_login',
  'password_changed',
  'email_changed',
  'mfa_enabled',
  'mfa_disabled',
  'device_verified',
  'device_removed',
  'account_locked',
  'permission_changed',
  'security_alert',
  // Additional types for controller compatibility
  'security_context_created',
  'security_context_validated',
  'socket_security_initialized'
];

const SecurityNotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: notificationTypes
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    metadata: {
      type: Object,
      default: {}
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    read: {
      type: Boolean,
      default: false
    },
    actionRequired: {
      type: Boolean,
      default: false
    },
    actionType: {
      type: String,
      enum: ['verify', 'review', 'acknowledge', 'none'],
      default: 'none'
    },
    actionCompleted: {
      type: Boolean,
      default: false
    },
    // For linking to security events
    securityEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SecurityEvent'
    }
  },
  {
    timestamps: true
  }
);

// Create TTL index to automatically delete old notifications after 30 days
SecurityNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('SecurityNotification', SecurityNotificationSchema);
