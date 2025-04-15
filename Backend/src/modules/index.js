/**
 * Modules Index
 *
 * This file exports all application modules and provides initialization functions
 * for setting up the entire application with proper module dependencies.
 */

const auth = require("./auth");
const team = require("./team");
const admin = require("./admin");
const user = require("./user");
const customer = require("./customer");
const system = require("./system");
const logger = require("../utils/logger");

/**
 * Initialize all application modules
 * @param {Object} app - Express application
 * @param {Object} io - Socket.IO server instance
 * @param {Object} config - Configuration object
 */
const initializeModules = async (app, io, config = {}) => {
  logger.info("Initializing application modules");

  try {
    // Initialize auth module with WebSocket support
    await auth.init(app, io, config.auth);

    // Initialize team module
    team.initialize(app);

    // Initialize admin module
    admin.initialize(app);

    // Initialize user module
    user.initialize(app);

    // Initialize customer module
    customer.initialize(app);

    // Initialize system module
    app.use("/api/system", system.routes);

    logger.info("All modules initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize modules:", error);
    throw error;
  }
};

/**
 * Shutdown all application modules
 */
const shutdownModules = async () => {
  logger.info("Shutting down application modules");

  try {
    // Shutdown auth module
    await auth.shutdown(); // Use the correct exported function name

    // Shutdown other modules here as needed
    // await otherModule.shutdown();

    logger.info("All modules shut down successfully");
  } catch (error) {
    logger.error("Error during modules shutdown:", error);
    throw error;
  }
};

module.exports = {
  auth,
  team,
  admin,
  user,
  customer,
  system,
  // Add other modules here as they are created

  // Module lifecycle functions
  initializeModules,
  shutdownModules,
};
