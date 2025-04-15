const express = require('express');
const app = express();
const customerModule = require('./src/modules/customer/index');

// Initialize the customer module
try {
  customerModule.initialize(app);
  console.log('Customer module initialized successfully');
} catch (error) {
  console.error('Error initializing customer module:', error);
}

// Start the server
const PORT = 4291;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
