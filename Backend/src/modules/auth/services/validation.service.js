const { User } = require('../models');
const { ValidationError } = require('../errors');

class ValidationService {
    static validateTicketAssignment(user, ticket) {
        if (!user.canHandleNewTicket()) {
            throw new ValidationError('USER_CANNOT_HANDLE_TICKET', {
                userId: user.id,
                reason: user.isLocked() ? 'ACCOUNT_LOCKED' : 
                        !user.isActive() ? 'ACCOUNT_INACTIVE' : 
                        'MAX_TICKETS_REACHED'
            });
        }

        try {
            User.assertValidTicketPriority(ticket.priority);
        } catch (error) {
            throw new ValidationError('INVALID_TICKET_PRIORITY', {
                message: error.message
            });
        }
    }

    static validateTeamMembership(user, team, role) {
        try {
            user.assertValidRole(role);
        } catch (error) {
            throw new ValidationError('INVALID_TEAM_ROLE', {
                message: error.message
            });
        }

        if (!user.isActive()) {
            throw new ValidationError('INACTIVE_USER_TEAM_ASSIGNMENT');
        }
    }
}

module.exports = ValidationService;