// Script to reset test user password directly using MongoDB driver
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB with fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tech_support_crm';

async function resetPassword() {
  try {
    // Connect to MongoDB and wait for connection
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find the test user
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'test@example.com' });
    
    if (!user) {
      console.error('Test user not found');
      process.exit(1);
    }
    
    console.log('Found user:', {
      id: user._id.toString(),
      email: user.email,
      hasPassword: user.security && user.security.password ? true : false
    });
    
    // Generate a new password hash
    const plainPassword = 'Test123!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    
    // Update the user's password directly in MongoDB
    const result = await mongoose.connection.db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          'security.password': hashedPassword,
          'security.passwordChangedAt': new Date()
        }
      }
    );
    
    console.log('Password update result:', result);
    console.log('New password hash:', hashedPassword);
    
    // Verify the password works
    const isValid = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('Password verification test:', isValid ? 'PASSED' : 'FAILED');
    
    // Get updated user
    const updatedUser = await mongoose.connection.db.collection('users').findOne({ _id: user._id });
    console.log('User security object structure:', JSON.stringify(updatedUser.security, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
resetPassword();