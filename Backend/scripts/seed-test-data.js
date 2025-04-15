/**
 * Seed Test Data Script
 * 
 * This script creates test data for the SupportHub application:
 * - 1 organization
 * - 5 users with different roles (admin, team_lead, technical, support, customer)
 * - 2 teams (1 technical team and 1 support team)
 * 
 * Run with: node scripts/seed-test-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Import models
const Organization = require('../src/modules/organization/models/organization.model');
const User = require('../src/modules/auth/models/user.model');
const Team = require('../src/modules/team/models/team.model');

// Test data
const TEST_ORG = {
  name: 'Test Organization',
  description: 'Organization created for testing purposes',
  type: 'business',
};

const TEST_USERS = [
  {
    email: 'admin@testorg.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
  {
    email: 'teamlead@testorg.com',
    password: 'TeamLead123!',
    firstName: 'Team',
    lastName: 'Lead',
    role: 'team_lead',
  },
  {
    email: 'technical@testorg.com',
    password: 'Technical123!',
    firstName: 'Technical',
    lastName: 'User',
    role: 'technical',
  },
  {
    email: 'support@testorg.com',
    password: 'Support123!',
    firstName: 'Support',
    lastName: 'User',
    role: 'support',
  },
  {
    email: 'customer@testorg.com',
    password: 'Customer123!',
    firstName: 'Customer',
    lastName: 'User',
    role: 'customer',
  },
];

const TEST_TEAMS = [
  {
    name: 'Technical Team',
    description: 'Team for technical support and development',
    teamType: 'technical',
  },
  {
    name: 'Support Team',
    description: 'Team for customer support',
    teamType: 'support',
  },
];

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tech_support_crm', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Hash password
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Create organization
async function createOrganization() {
  try {
    // Check if organization already exists
    let organization = await Organization.findOne({ name: TEST_ORG.name });
    
    if (organization) {
      console.log('Organization already exists, deleting it');
      await Organization.deleteOne({ name: TEST_ORG.name });
    }
    
    // Generate a unique orgId
    const orgId = uuidv4().substring(0, 8);
    
    // Create new organization
    organization = await Organization.create({
      name: TEST_ORG.name,
      description: TEST_ORG.description,
      type: TEST_ORG.type,
      orgId: orgId,
    });
    
    console.log(`Organization created with ID: ${organization._id} and orgId: ${orgId}`);
    return organization;
  } catch (error) {
    console.error('Error creating organization:', error);
    throw error;
  }
}

// Create users
async function createUsers(organizationId) {
  const users = {};
  
  for (const userData of TEST_USERS) {
    try {
      // Check if user already exists
      let user = await User.findOne({ email: userData.email });
      
      if (user) {
        console.log(`User ${userData.email} already exists, deleting it`);
        await User.deleteOne({ email: userData.email });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create user
      user = await User.create({
        email: userData.email,
        profile: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: '+1234567890',
          timezone: 'America/New_York',
        },
        role: userData.role,
        organizationId: organizationId,
        status: {
          isActive: true,
          verifiedAt: new Date(),
        },
        security: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
          emailVerified: true,
          loginAttempts: 0,
          lastLogin: null,
        },
      });
      
      console.log(`User created: ${userData.email} with role ${userData.role}`);
      users[userData.role] = user;
    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error);
      throw error;
    }
  }
  
  return users;
}

// Create teams
async function createTeams(organizationId, users) {
  const teams = {};
  
  for (const teamData of TEST_TEAMS) {
    try {
      // Check if team already exists
      let team = await Team.findOne({ 
        name: teamData.name,
        organizationId: organizationId
      });
      
      if (team) {
        console.log(`Team ${teamData.name} already exists, deleting it`);
        await Team.deleteOne({ 
          name: teamData.name,
          organizationId: organizationId
        });
      }
      
      // Determine team lead based on team type
      let leadId;
      if (teamData.teamType === 'technical') {
        leadId = users.team_lead._id;
      } else {
        // For the support team, we'll use the admin as lead
        leadId = users.admin._id;
      }
      
      // Create team
      team = await Team.create({
        name: teamData.name,
        description: teamData.description,
        teamType: teamData.teamType,
        organizationId: organizationId,
        createdBy: users.admin._id,
        leadId: leadId,
        members: [
          {
            userId: leadId,
            role: 'lead',
            joinedAt: new Date(),
            invitedBy: users.admin._id,
          }
        ],
      });
      
      console.log(`Team created: ${teamData.name} with type ${teamData.teamType}`);
      teams[teamData.teamType] = team;
      
      // Update organization with team
      await Organization.findByIdAndUpdate(
        organizationId,
        { $push: { teams: team._id } }
      );
    } catch (error) {
      console.error(`Error creating team ${teamData.name}:`, error);
      throw error;
    }
  }
  
  return teams;
}

// Add members to teams
async function addMembersToTeams(teams, users) {
  try {
    // Add technical user to technical team
    await Team.findByIdAndUpdate(
      teams.technical._id,
      {
        $push: {
          members: {
            userId: users.technical._id,
            role: 'member',
            joinedAt: new Date(),
            invitedBy: users.team_lead._id,
          }
        }
      }
    );
    
    // Update technical user with team ID
    await User.findByIdAndUpdate(
      users.technical._id,
      { teamId: teams.technical._id }
    );
    
    console.log('Added technical user to technical team');
    
    // Add support user to support team
    await Team.findByIdAndUpdate(
      teams.support._id,
      {
        $push: {
          members: {
            userId: users.support._id,
            role: 'member',
            joinedAt: new Date(),
            invitedBy: users.admin._id,
          }
        }
      }
    );
    
    // Update support user with team ID
    await User.findByIdAndUpdate(
      users.support._id,
      { teamId: teams.support._id }
    );
    
    console.log('Added support user to support team');
    
    // Update team lead with team ID (technical team)
    await User.findByIdAndUpdate(
      users.team_lead._id,
      { teamId: teams.technical._id }
    );
    
  } catch (error) {
    console.error('Error adding members to teams:', error);
    throw error;
  }
}

// Update organization owner
async function updateOrganizationOwner(organizationId, adminId) {
  try {
    await Organization.findByIdAndUpdate(
      organizationId,
      { owner: adminId }
    );
    console.log('Updated organization owner to admin user');
  } catch (error) {
    console.error('Error updating organization owner:', error);
    throw error;
  }
}

// Add customer to organization
async function addCustomerToOrganization(organizationId, customerId) {
  try {
    await Organization.findByIdAndUpdate(
      organizationId,
      { $push: { customers: customerId } }
    );
    console.log('Added customer to organization');
  } catch (error) {
    console.error('Error adding customer to organization:', error);
    throw error;
  }
}

// Main function
async function seedTestData() {
  try {
    // Connect to database
    await connectDB();
    
    // Create organization
    const organization = await createOrganization();
    
    // Create users
    const users = await createUsers(organization._id);
    
    // Update organization owner
    await updateOrganizationOwner(organization._id, users.admin._id);
    
    // Add customer to organization
    await addCustomerToOrganization(organization._id, users.customer._id);
    
    // Create teams
    const teams = await createTeams(organization._id, users);
    
    // Add members to teams
    await addMembersToTeams(teams, users);
    
    console.log('\n=== Test Data Summary ===');
    console.log(`Organization: ${organization.name} (${organization._id})`);
    console.log('Users:');
    Object.entries(users).forEach(([role, user]) => {
      console.log(`- ${role}: ${user.email} (${user._id})`);
    });
    console.log('Teams:');
    Object.entries(teams).forEach(([type, team]) => {
      console.log(`- ${team.name} (${team._id})`);
    });
    
    console.log('\nTest data created successfully!');
    console.log('\nLogin credentials:');
    TEST_USERS.forEach(user => {
      console.log(`- ${user.role}: ${user.email} / ${user.password}`);
    });
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    
  } catch (error) {
    console.error('Error seeding test data:', error);
  }
}

// Run the script
seedTestData();
