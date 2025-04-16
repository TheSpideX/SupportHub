# SLA Management System

This document provides an overview of the Service Level Agreement (SLA) management system in the Support Hub application.

## Overview

The SLA management system allows organizations to define and enforce response and resolution time targets for support tickets based on priority levels. The system automatically applies SLA policies to tickets, tracks deadlines, and sends notifications when deadlines are approaching or breached.

## SLA Policies

Each organization can have multiple SLA policies with different response and resolution time targets for different priority levels (low, medium, high, critical). 

### Default SLA Policies

The system comes with four default SLA policies:

1. **Low Priority SLA**
   - Response Time: 8 hours
   - Resolution Time: 48 hours

2. **Medium Priority SLA**
   - Response Time: 4 hours
   - Resolution Time: 24 hours

3. **High Priority SLA**
   - Response Time: 2 hours
   - Resolution Time: 12 hours

4. **Critical Priority SLA**
   - Response Time: 1 hour
   - Resolution Time: 4 hours

### Creating Default SLA Policies

To create default SLA policies for all organizations, run:

```
node src/scripts/create-default-sla-policies.js
```

## SLA Application

SLA policies can be applied to tickets in two ways:

1. **Automatic Application**: When a ticket is created, if no specific SLA policy is selected, the system automatically applies a default policy based on the ticket's priority:
   - Low priority tickets → Low Priority SLA
   - Medium priority tickets → Medium Priority SLA
   - High priority tickets → High Priority SLA
   - Critical priority tickets → Critical Priority SLA

2. **Manual Selection**: Users can manually select an SLA policy when creating or updating a ticket.

## SLA Tracking

The system tracks two types of SLA deadlines:

1. **Response Deadline**: The time by which the first response should be provided to the customer.
2. **Resolution Deadline**: The time by which the ticket should be resolved.

## SLA Breach Monitoring

The system automatically checks for SLA breaches and sends notifications when:

1. A deadline is approaching (75% of the time has elapsed)
2. A deadline has been breached

## SLA Management Features

The system provides the following SLA management features:

1. **Pause/Resume SLA**: SLA tracking can be paused and resumed with a reason (e.g., waiting for customer response).
2. **SLA Breach Notifications**: Automatic notifications are sent to relevant users when SLA deadlines are approaching or breached.
3. **SLA Statistics**: The system provides statistics on SLA compliance rates.

## API Endpoints

### SLA Policy Management

- `GET /api/sla/policies` - Get all SLA policies for the organization
- `GET /api/sla/policies/:id` - Get a specific SLA policy
- `POST /api/sla/policies` - Create a new SLA policy
- `PUT /api/sla/policies/:id` - Update an SLA policy
- `DELETE /api/sla/policies/:id` - Delete an SLA policy

### Ticket SLA Management

- `POST /api/sla/apply/:ticketId` - Apply an SLA policy to a ticket
- `POST /api/sla/pause/:ticketId` - Pause SLA tracking for a ticket
- `POST /api/sla/resume/:ticketId` - Resume SLA tracking for a ticket
- `POST /api/sla/check-breaches` - Check for SLA breaches (admin only)

## Frontend Integration

The frontend provides the following SLA-related features:

1. SLA policy selection when creating a ticket
2. SLA status display in ticket details
3. SLA management actions (apply, pause, resume) in ticket details
4. Visual indicators for approaching and breached SLAs

## Best Practices

1. Create appropriate SLA policies for different types of tickets and priorities
2. Regularly review SLA compliance rates and adjust policies if needed
3. Ensure that team members are aware of SLA deadlines and prioritize tickets accordingly
4. Use the pause feature when waiting for customer responses to avoid unfair SLA breaches
