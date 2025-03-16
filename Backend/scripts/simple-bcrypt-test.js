const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Connect to MongoDB directly with the connection string
// Replace this with your actual MongoDB connection string
const MONGODB_URI = 'mongodb://localhost:27017/tech_support_crm';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Import User model
const User = require('../src/modules/auth/models/user.model');

async function testPasswordVerification() {
  try {
    // Find the user
    const user = await User.findOne({ email: 'test@example.com' }).select('+security.password');
    
    if (!user) {
      console.error('User not found');
      return;
    }
    
    console.log('User found:', {
      id: user._id.toString(),
      email: user.email,
      hasPassword: !!user.security?.password,
      passwordLength: user.security?.password?.length || 0
    });
    
    // Test password
    const testPassword = 'Test123!';
    
    // Update the password with a new hash
    const updatedHash = await bcrypt.hash(testPassword, 10);
    user.security.password = updatedHash;
    await user.save();
    
    console.log('Updated password hash:', updatedHash);
    
    // Test comparison with updated hash
    const isMatchAfterUpdate = await bcrypt.compare(testPassword, updatedHash);
    console.log('Comparison after update:', isMatchAfterUpdate);
    
  } catch (error) {
    console.error('Error testing password verification:', error);
  } finally {
    mongoose.disconnect();
  }
}

testPasswordVerification();