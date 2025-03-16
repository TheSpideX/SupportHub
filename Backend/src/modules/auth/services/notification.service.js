const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

class NotificationService {
    constructor() {
        this.mailer = nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: config.email.secure,
            auth: {
                user: config.email.user,
                pass: config.email.password
            }
        });
    }

    async sendSecurityAlert(user, alertType, details) {
        const templates = {
            ACCOUNT_LOCKED: {
                subject: 'Account Locked - Suspicious Activity Detected',
                template: 'security-alert-locked'
            },
            NEW_DEVICE: {
                subject: 'New Device Login Detected',
                template: 'security-alert-device'
            },
            PASSWORD_CHANGED: {
                subject: 'Your Password Was Changed',
                template: 'security-alert-password'
            },
            SUSPICIOUS_LOGIN: {
                subject: 'Suspicious Login Activity Detected',
                template: 'security-alert-suspicious'
            }
        };

        const { subject, template } = templates[alertType];
        
        await this.mailer.sendMail({
            to: user.email,
            subject,
            template,
            context: {
                name: user.name,
                ...details
            }
        });

        await this.logNotification(user.id, alertType, details);
    }

    async sendVerificationEmail(user, token) {
        const verificationUrl = `${config.app.frontendUrl}/verify-email?token=${token}`;
        
        await this.mailer.sendMail({
            to: user.email,
            subject: 'Verify Your Email Address',
            template: 'email-verification',
            context: {
                name: user.name,
                verificationUrl
            }
        });
    }

    async sendPasswordResetEmail(user, token) {
        const resetUrl = `${config.app.frontendUrl}/reset-password?token=${token}`;
        
        await this.mailer.sendMail({
            to: user.email,
            subject: 'Password Reset Request',
            template: 'password-reset',
            context: {
                name: user.name,
                resetUrl
            }
        });
    }

    private async logNotification(userId, type, details) {
        await prisma.notificationLog.create({
            data: {
                userId,
                type,
                details,
                sentAt: new Date()
            }
        });
    }
}

module.exports = new NotificationService();