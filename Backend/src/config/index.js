// Main configuration file
const dotenv = require('dotenv');
dotenv.config();

// Import global configs
const cors = require('./cors.config');
const db = require('./db.config');
const redis = require('./redis.config');

// Import module configs
const auth = require('../modules/auth/config');

// Export consolidated configuration
module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  apiPrefix: process.env.API_PREFIX || '/api',
  
  // Global configs
  cors,
  db,
  redis,
  
  // Module configs
  auth
};
