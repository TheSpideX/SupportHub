const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../../../db');
const notificationService = require('../services/notification.service');
const auditService = require('../services/audit.service');
const { AuthError } = require('../errors');

const passwordController = {
    async requestReset(req, res) {
        const { email } = req.body;
        
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Return success even if user doesn't exist to prevent email enumeration
            return res.json({ message: 'If an account exists, a reset email will be sent' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await prisma.passwordReset.create({
            data: {
                userId: user.id,
                token: await bcrypt.hash(token, 10),
                expires
            }
        });

        await notificationService.sendPasswordResetEmail(user, token);
        await auditService.logSecurityEvent('PASSWORD_RESET_REQUESTED', {
            userId: user.id,
            ipAddress: req.ip
        });

        res.json({ message: 'If an account exists, a reset email will be sent' });
    },

    async resetPassword(req, res) {
        const { token, newPassword } = req.body;

        const resetRequest = await prisma.passwordReset.findFirst({
            where: {
                expires: { gt: new Date() },
                used: false
            },
            include: { user: true }
        });

        if (!resetRequest || !await bcrypt.compare(token, resetRequest.token)) {
            throw new AuthError('INVALID_RESET_TOKEN');
        }

        // Check password history
        const validPassword = await auditService.checkPasswordHistory(
            resetRequest.userId,
            newPassword
        );

        if (!validPassword) {
            throw new AuthError('PASSWORD_PREVIOUSLY_USED');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetRequest.userId },
                data: { password: hashedPassword }
            }),
            prisma.passwordReset.update({
                where: { id: resetRequest.id },
                data: { used: true }
            })
        ]);

        await auditService.logPasswordChange(resetRequest.userId, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        await notificationService.sendSecurityAlert(
            resetRequest.user,
            'PASSWORD_CHANGED',
            { ipAddress: req.ip }
        );

        res.json({ message: 'Password has been reset successfully' });
    }
};

module.exports = passwordController;