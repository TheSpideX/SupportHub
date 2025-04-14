// Main configuration file
const dotenv = require("dotenv");
dotenv.config();

// Import global configs
const cors = require("./cors.config");
const db = require("./db"); // Changed from './db.config' to './db'
const redis = require("./redis"); // Changed from './redis.config' to './redis'

// Import module configs
const auth = require("../modules/auth/config");

// Export consolidated configuration
module.exports = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 3000,
  apiPrefix: process.env.API_PREFIX || "/api",
  serviceName: process.env.SERVICE_NAME || "support-hub-backend",

  // Global configs
  cors,
  db,
  redis,

  // Module configs
  auth,
};
