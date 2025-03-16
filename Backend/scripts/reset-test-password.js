// Script to reset test user password and verify it works
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB with fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tech_support_crm';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Get the User model
const User = mongoose.model('User', require('../src/modules/auth/models/user.model').schema);

async function resetPassword() {
  try {
    // Find the test user
    const user = await User.findOne({ email: 'test@example.com' });
    
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
    
    // Update the user's password
    if (!user.security) {
      user.security = {};
    }
    
    user.security.password = hashedPassword;
    await user.save();
    
    console.log('Password updated successfully');
    console.log('New password hash:', hashedPassword);
    
    // Verify the password works
    const isValid = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('Password verification test:', isValid ? 'PASSED' : 'FAILED');
    
    // Check if the user document structure is correct
    console.log('User security object structure:', JSON.stringify(user.security, null, 2));
    
    // Close the connection
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetPassword();