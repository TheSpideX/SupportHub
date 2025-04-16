/**
 * Setup Test Data for Ticket SLA System Testing
 * This script creates a test organization, teams, and users directly in the MongoDB database
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// MongoDB connection string
const MONGODB_URI = 'mongodb://localhost:27017/tech_support_crm';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Define schemas
const OrganizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  orgId: {
    type: String,
    required: true,
    unique: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  type: {
    type: String,
    enum: ['business', 'educational', 'nonprofit', 'government', 'other'],
    default: 'business'
  },
  settings: {
    theme: {
      type: String,
      default: 'default'
    },
    features: {
      type: Map,
      of: Boolean,
      default: {}
    }
  },
  teams: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    }
  ],
  customers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ]
}, { timestamps: true });

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  teamType: {
    type: String,
    enum: ['technical', 'support'],
    required: true
  },
  members: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: {
        type: String,
        enum: ['lead', 'member'],
        default: 'member'
      },
      joinedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    avatar: String,
    phoneNumber: String,
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  security: {
    password: {
      type: String,
      required: true
    },
    passwordChangedAt: Date,
    tokenVersion: {
      type: Number,
      default: 0
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    activeSessions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session'
      }
    ]
  },
  role: {
    type: String,
    enum: ['customer', 'support', 'technical', 'team_lead', 'admin'],
    default: 'customer'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  teams: [
    {
      teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      },
      role: {
        type: String,
        enum: ['lead', 'member'],
        default: 'member'
      },
      joinedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  status: {
    isActive: {
      type: Boolean,
      default: true
    },
    lastActive: Date
  }
}, { timestamps: true });

// Create models
const Organization = mongoose.model('Organization', OrganizationSchema);
const Team = mongoose.model('Team', TeamSchema);
const User = mongoose.model('User', UserSchema);

// Function to hash password
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Function to generate a random organization ID
function generateOrgId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `ORG-${randomPart}`;
}

// Main function to create test data
async function createTestData() {
  try {
    console.log('Creating test data...');

    // Clear existing data
    await Organization.deleteMany({ name: /Test Organization/ });
    await Team.deleteMany({ name: /Test Team/ });
    await User.deleteMany({ email: /test.*@example\.com/ });

    // Create organization
    const organization = new Organization({
      name: 'Test Organization',
      description: 'Organization for testing ticket SLA system',
      orgId: generateOrgId(),
      status: 'active',
      type: 'business'
    });
    await organization.save();
    console.log('Created organization:', organization._id);

    // Create admin user
    const adminPassword = await hashPassword('Admin@123');
    const admin = new User({
      profile: {
        firstName: 'Admin',
        lastName: 'User',
        timezone: 'UTC'
      },
      email: 'admin@example.com',
      security: {
        password: adminPassword,
        passwordChangedAt: new Date()
      },
      role: 'admin',
      organizationId: organization._id,
      status: {
        isActive: true,
        lastActive: new Date()
      }
    });
    await admin.save();
    console.log('Created admin user:', admin._id);

    // Update organization with owner
    organization.owner = admin._id;
    await organization.save();

    // Create technical team
    const technicalTeam = new Team({
      name: 'Test Technical Team',
      description: 'Technical team for testing',
      organizationId: organization._id,
      teamType: 'technical',
      createdBy: admin._id
    });
    await technicalTeam.save();
    console.log('Created technical team:', technicalTeam._id);

    // Create support team
    const supportTeam = new Team({
      name: 'Test Support Team',
      description: 'Support team for testing',
      organizationId: organization._id,
      teamType: 'support',
      createdBy: admin._id
    });
    await supportTeam.save();
    console.log('Created support team:', supportTeam._id);

    // Add teams to organization
    organization.teams.push(technicalTeam._id, supportTeam._id);
    await organization.save();

    // Create team lead user
    const teamLeadPassword = await hashPassword('TeamLead@123');
    const teamLead = new User({
      profile: {
        firstName: 'Team',
        lastName: 'Lead',
        timezone: 'UTC'
      },
      email: 'teamlead@example.com',
      security: {
        password: teamLeadPassword,
        passwordChangedAt: new Date()
      },
      role: 'team_lead',
      organizationId: organization._id,
      teams: [
        {
          teamId: technicalTeam._id,
          role: 'lead',
          joinedAt: new Date()
        }
      ],
      status: {
        isActive: true,
        lastActive: new Date()
      }
    });
    await teamLead.save();
    console.log('Created team lead user:', teamLead._id);

    // Add team lead to technical team
    technicalTeam.members.push({
      userId: teamLead._id,
      role: 'lead',
      joinedAt: new Date()
    });
    await technicalTeam.save();

    // Create team member user
    const teamMemberPassword = await hashPassword('Member@123');
    const teamMember = new User({
      profile: {
        firstName: 'Team',
        lastName: 'Member',
        timezone: 'UTC'
      },
      email: 'teammember@example.com',
      security: {
        password: teamMemberPassword,
        passwordChangedAt: new Date()
      },
      role: 'technical',
      organizationId: organization._id,
      teams: [
        {
          teamId: technicalTeam._id,
          role: 'member',
          joinedAt: new Date()
        }
      ],
      status: {
        isActive: true,
        lastActive: new Date()
      }
    });
    await teamMember.save();
    console.log('Created team member user:', teamMember._id);

    // Add team member to technical team
    technicalTeam.members.push({
      userId: teamMember._id,
      role: 'member',
      joinedAt: new Date()
    });
    await technicalTeam.save();

    // Create customer user
    const customerPassword = await hashPassword('Customer@123');
    const customer = new User({
      profile: {
        firstName: 'Customer',
        lastName: 'User',
        timezone: 'UTC'
      },
      email: 'customer@example.com',
      security: {
        password: customerPassword,
        passwordChangedAt: new Date()
      },
      role: 'customer',
      organizationId: organization._id,
      status: {
        isActive: true,
        lastActive: new Date()
      }
    });
    await customer.save();
    console.log('Created customer user:', customer._id);

    // Add customer to organization
    organization.customers.push(customer._id);
    await organization.save();

    console.log('Test data created successfully!');
    console.log('Organization ID:', organization._id);
    console.log('Admin User ID:', admin._id);
    console.log('Team Lead User ID:', teamLead._id);
    console.log('Team Member User ID:', teamMember._id);
    console.log('Customer User ID:', customer._id);
    console.log('Technical Team ID:', technicalTeam._id);
    console.log('Support Team ID:', supportTeam._id);

    // Print login credentials
    console.log('\nLogin Credentials:');
    console.log('Admin: email=admin@example.com, password=Admin@123');
    console.log('Team Lead: email=teamlead@example.com, password=TeamLead@123');
    console.log('Team Member: email=teammember@example.com, password=Member@123');
    console.log('Customer: email=customer@example.com, password=Customer@123');

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error creating test data:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the function
createTestData();
