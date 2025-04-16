/**
 * Script to create default SLA policies
 * Run with: node src/scripts/create-default-sla-policies.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SLAPolicy = require('../modules/ticket/models/sla-policy.model');
const Organization = require('../modules/organization/models/organization.model');
const User = require('../modules/user/models/user.model');
const logger = require('../utils/logger');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Default business hours (9 AM to 5 PM, Monday to Friday)
const defaultBusinessHours = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: { start: '', end: '' },
  sunday: { start: '', end: '' }
};

// Create default SLA policies for each organization
async function createDefaultSLAPolicies() {
  try {
    // Get all organizations
    const organizations = await Organization.find({});
    
    if (organizations.length === 0) {
      console.log('No organizations found. Please create at least one organization first.');
      process.exit(0);
    }
    
    console.log(`Found ${organizations.length} organizations. Creating default SLA policies...`);
    
    for (const org of organizations) {
      // Find an admin user for this organization to set as creator
      const adminUser = await User.findOne({ 
        organizationId: org._id,
        role: 'admin'
      });
      
      if (!adminUser) {
        console.log(`No admin user found for organization ${org.name}. Skipping...`);
        continue;
      }
      
      // Check if default policies already exist for this organization
      const existingPolicies = await SLAPolicy.find({ organizationId: org._id });
      
      if (existingPolicies.length > 0) {
        console.log(`Organization ${org.name} already has ${existingPolicies.length} SLA policies. Skipping...`);
        continue;
      }
      
      // Create default policies for different priority levels
      const slaPolicies = [
        {
          name: 'Low Priority SLA',
          description: 'Default SLA policy for low priority tickets',
          organizationId: org._id,
          responseTime: {
            low: 480, // 8 hours in minutes
            medium: 240,
            high: 120,
            critical: 60
          },
          resolutionTime: {
            low: 2880, // 48 hours in minutes
            medium: 1440,
            high: 720,
            critical: 360
          },
          businessHours: defaultBusinessHours,
          isActive: true,
          createdBy: adminUser._id
        },
        {
          name: 'Medium Priority SLA',
          description: 'Default SLA policy for medium priority tickets',
          organizationId: org._id,
          responseTime: {
            low: 240, // 4 hours in minutes
            medium: 120,
            high: 60,
            critical: 30
          },
          resolutionTime: {
            low: 1440, // 24 hours in minutes
            medium: 720,
            high: 360,
            critical: 180
          },
          businessHours: defaultBusinessHours,
          isActive: true,
          createdBy: adminUser._id
        },
        {
          name: 'High Priority SLA',
          description: 'Default SLA policy for high priority tickets',
          organizationId: org._id,
          responseTime: {
            low: 120, // 2 hours in minutes
            medium: 60,
            high: 30,
            critical: 15
          },
          resolutionTime: {
            low: 720, // 12 hours in minutes
            medium: 360,
            high: 180,
            critical: 90
          },
          businessHours: defaultBusinessHours,
          isActive: true,
          createdBy: adminUser._id
        },
        {
          name: 'Critical Priority SLA',
          description: 'Default SLA policy for critical priority tickets',
          organizationId: org._id,
          responseTime: {
            low: 60, // 1 hour in minutes
            medium: 30,
            high: 15,
            critical: 5
          },
          resolutionTime: {
            low: 360, // 6 hours in minutes
            medium: 180,
            high: 90,
            critical: 45
          },
          businessHours: defaultBusinessHours,
          isActive: true,
          createdBy: adminUser._id
        }
      ];
      
      // Save the policies
      for (const policy of slaPolicies) {
        const newPolicy = new SLAPolicy(policy);
        await newPolicy.save();
        console.log(`Created SLA policy: ${policy.name} for organization ${org.name}`);
      }
    }
    
    console.log('Default SLA policies created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating default SLA policies:', error);
    process.exit(1);
  }
}

// Run the function
createDefaultSLAPolicies();
