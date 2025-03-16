const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/user.model');

class AuditService {
    async logSecurityEvent(eventType, details) {
        // Create a schema if it doesn't exist
        const SecurityAuditLogSchema = mongoose.models.SecurityAuditLog || 
            mongoose.model('SecurityAuditLog', new mongoose.Schema({
                type: String,
                details: Object,
                timestamp: Date,
                ipAddress: String,
                userId: String
            }));
            
        await SecurityAuditLogSchema.create({
            type: eventType,
            details,
            timestamp: new Date(),
            ipAddress: details.ipAddress,
            userId: details.userId
        });
    }

    async logPasswordChange(userId, details) {
        // Create a schema if it doesn't exist
        const PasswordHistorySchema = mongoose.models.PasswordHistory || 
            mongoose.model('PasswordHistory', new mongoose.Schema({
                userId: String,
                hashedPassword: String,
                changedAt: Date
            }));
            
        await PasswordHistorySchema.create({
            userId,
            hashedPassword: details.newPassword,
            changedAt: new Date()
        });

        await this.logSecurityEvent('PASSWORD_CHANGED', {
            userId,
            ipAddress: details.ipAddress,
            userAgent: details.userAgent
        });
    }

    async checkPasswordHistory(userId, newPassword) {
        const PasswordHistorySchema = mongoose.models.PasswordHistory || 
            mongoose.model('PasswordHistory', new mongoose.Schema({
                userId: String,
                hashedPassword: String,
                changedAt: Date
            }));
            
        const recentPasswords = await PasswordHistorySchema.find({
            userId,
            changedAt: {
                $gte: new Date(Date.now() - config.security.passwordHistoryDays * 24 * 60 * 60 * 1000)
            }
        }).sort({ changedAt: -1 }).limit(config.security.passwordHistoryCount);

        for (const history of recentPasswords) {
            if (await bcrypt.compare(newPassword, history.hashedPassword)) {
                return false;
            }
        }
        return true;
    }

    async logLoginAttempt(userId, deviceInfo, status, context = {}) {
        const LoginAttemptSchema = mongoose.models.LoginAttempt || 
            mongoose.model('LoginAttempt', new mongoose.Schema({
                userId: String,
                ipAddress: String,
                userAgent: String,
                location: String,
                status: String,
                timestamp: Date,
                context: Object
            }));
            
        await LoginAttemptSchema.create({
            userId,
            ipAddress: deviceInfo.ip,
            userAgent: deviceInfo.userAgent,
            location: deviceInfo.location,
            status,
            timestamp: new Date(),
            context
        });
    }

    // Changed from private to regular method with underscore prefix
    async _calculateRiskScore(deviceInfo) {
        // Implementation
    }
}

module.exports = AuditService;
