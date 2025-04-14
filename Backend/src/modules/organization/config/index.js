/**
 * Organization Module Configuration
 */

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // Organization settings
  organization: {
    // Default organization settings
    defaultSettings: {
      theme: 'default',
      features: {
        analytics: true,
        teamManagement: true,
        customerManagement: true
      }
    },
    
    // Organization ID format
    idFormat: 'ORG-XXXXX', // X is alphanumeric
    
    // Limits
    limits: {
      maxTeams: process.env.MAX_TEAMS_PER_ORG || 10,
      maxMembers: process.env.MAX_MEMBERS_PER_ORG || 50,
      maxCustomers: process.env.MAX_CUSTOMERS_PER_ORG || 100
    },
    
    // Rate limits
    rateLimits: {
      create: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5 // 5 organizations per hour
      },
      update: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20 // 20 updates per 15 minutes
      }
    }
  }
};
