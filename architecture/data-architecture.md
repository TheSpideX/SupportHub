# Data Architecture - Technical Support CRM Portal

## Database Schema

### User Collection
- **Fields**: id, username, email, password (hashed), role, teams, preferences, metrics
- **Indexes**: email, role
- **Relationships**: One-to-many with Teams (via TeamMembership)

### Team Collection
- **Fields**: id, name, description, leadId, createdAt, updatedAt
- **Indexes**: leadId
- **Relationships**: Many-to-many with Users (via TeamMembership)

### TeamMembership Collection
- **Fields**: id, userId, teamId, role, joinedAt
- **Indexes**: userId, teamId
- **Purpose**: Junction collection for User-Team relationship

### Ticket Collection
- **Fields**: id, title, description, status, priority, createdBy, assignedTo, teamId, parentTicketId, tags, createdAt, updatedAt, dueDate, resolvedAt, closedAt
- **Indexes**: status, priority, assignedTo, teamId, parentTicketId
- **Relationships**: 
  - Many-to-one with Users (createdBy, assignedTo)
  - Many-to-one with Teams
  - Self-referential for sub-tickets

### Comment Collection
- **Fields**: id, ticketId, userId, content, attachments, createdAt, updatedAt
- **Indexes**: ticketId, userId
- **Relationships**: Many-to-one with Tickets and Users

### Notification Collection
- **Fields**: id, userId, type, content, relatedId, isRead, createdAt
- **Indexes**: userId, isRead
- **Relationships**: Many-to-one with Users

### SLA Collection
- **Fields**: id, priority, responseTime, resolutionTime, createdAt, updatedAt
- **Purpose**: Defines SLA parameters for different priority levels

### AuditLog Collection
- **Fields**: id, action, entityType, entityId, userId, changes, timestamp, ipAddress
- **Indexes**: entityType, entityId, userId
- **Purpose**: Immutable record of all system changes

## Data Flow

### Ticket Creation Flow
1. User creates ticket in UI
2. Data validated and stored in Ticket Collection
3. Notification created for support team
4. AuditLog entry created

### Ticket Assignment Flow
1. Team lead or system assigns ticket
2. Ticket Collection updated with assignedTo field
3. Notification created for assignee
4. AuditLog entry created

### SLA Monitoring Flow
1. Ticket created with priority
2. System calculates due dates based on SLA Collection
3. Background job monitors approaching deadlines
4. Notifications created at 75% of SLA time and breach

## Data Access Patterns

### Role-Based Access
- **Customers**: Own tickets only
- **Support Team**: All tickets, limited team data
- **Technical Team**: Assigned tickets, team data
- **Team Lead**: All team tickets, team management
- **Admin**: Full system access

### Common Queries
- Tickets by status (for Kanban board)
- Tickets by assignee (for workload view)
- Tickets approaching SLA breach
- Team performance metrics
- User activity logs

## Data Security

### Sensitive Data
- User passwords (hashed with bcrypt)
- Customer contact information
- Internal team communications

### Protection Measures
- Field-level encryption for sensitive data
- Role-based document filtering
- Audit logging of all data access
- Data validation before storage