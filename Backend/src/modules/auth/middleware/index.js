const authMiddleware = require('./auth.middleware');
const validate = require('./validate');
const securityMiddleware = require('./security.middleware');
const rateLimitMiddleware = require('./rateLimit.middleware');
const csrfMiddleware = require('./csrf.middleware');

module.exports = {
  authMiddleware,
  validateMiddleware: validate,
  securityMiddleware,
  rateLimitMiddleware,
  csrfMiddleware
};
