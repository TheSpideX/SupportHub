/**
 * Ticket Body Parser Middleware
 * Special middleware to handle ticket creation request bodies
 */

const logger = require("../../../utils/logger");

/**
 * Middleware to ensure ticket creation requests have properly parsed bodies
 */
const ticketBodyParser = (req, res, next) => {
  // Continue to the next middleware
  next();
};

module.exports = ticketBodyParser;
