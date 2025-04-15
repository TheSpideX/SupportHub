/**
 * Fix Test User Passwords Script
 * 
 * This script fixes the passwords for test users created by the seed-test-data.js script.
 * The issue is that the passwords were hashed directly in the script, but the User model
 * has a pre-save hook that hashes passwords again, resulting in double-hashed passwords.
 * 
 * Run with: node scripts/fix-test-user-passwords.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import User model
const User = require('../src/modules/auth/models/user.model');

// Test user credentials
const TEST_USERS = [
  {
    email: 'admin@testorg.com',
    password: 'Admin123!',
  },
  {
    email: 'teamlead@testorg.com',
    password: 'TeamLead123!',
  },
  {
    email: 'technical@testorg.com',
    password: 'Technical123!',
  },
  {
    email: 'support@testorg.com',
    password: 'Support123!',
  },
  {
    email: 'customer@testorg.com',
    password: 'Customer123!',
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

// Fix user passwords
async function fixUserPasswords() {
  try {
    for (const userData of TEST_USERS) {
      // Find user by email
      const user = await User.findOne({ email: userData.email });
      
      if (!user) {
        console.log(`User ${userData.email} not found, skipping`);
        continue;
      }
      
      console.log(`Fixing password for user: ${userData.email}`);
      
      // Set the password directly (bypassing the pre-save hook)
      // We need to use findOneAndUpdate to avoid triggering the pre-save hook
      await User.findOneAndUpdate(
        { email: userData.email },
        { 
          $set: { 
            'security.password': userData.password 
          } 
        }
      );
      
      console.log(`Password fixed for user: ${userData.email}`);
    }
    
    console.log('\nAll user passwords have been fixed!');
    console.log('\nLogin credentials:');
    TEST_USERS.forEach(user => {
      console.log(`- ${user.email} / ${user.password}`);
    });
    
  } catch (error) {
    console.error('Error fixing user passwords:', error);
  }
}

// Main function
async function main() {
  try {
    // Connect to database
    await connectDB();
    
    // Fix user passwords
    await fixUserPasswords();
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();
