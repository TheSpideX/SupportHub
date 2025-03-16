const authRoutes = require('./routes/auth.routes');
const authController = require('./controllers/auth.controller');
const securityController = require('./controllers/security.controller');
const authMiddleware = require('./middleware/auth.middleware');
const csrfMiddleware = require('./middleware/csrf.middleware');
const securityMiddleware = require('./middleware/security.middleware');
const rateLimitMiddleware = require('./middleware/rateLimit.middleware');
const config = require('./config');
const { AuthError } = require('./errors');

/**
 * Initialize auth module
 * @param {Express} app - Express application instance
 */
const initialize = (app) => {
  console.log('Initializing auth module...');
  
  // Register routes - make sure we're using the router, not an object
  app.use('/api/auth', authRoutes);
  
  console.log('Auth routes registered:');
  console.log('- POST /api/auth/login');
  console.log('- POST /api/auth/register');
  console.log('- POST /api/auth/logout');
  console.log('- GET /api/auth/csrf-token');
  // List other routes...
  
  return app;
};

module.exports = {
    initialize,
    authMiddleware,
    csrfMiddleware,
    securityMiddleware,
    rateLimitMiddleware,
    authController,
    securityController,
    config,
    AuthError
};
