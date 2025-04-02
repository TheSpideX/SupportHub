/**
 * User Routes
 * Handles user profile and password management
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authenticate');
const rateLimitMiddleware = require('../middleware/rate-limit');
const validate = require('../../../middleware/validate');
const userValidation = require('../validation/user.validation');
const userController = require('../controllers/user.controller');

// // User profile routes
// router.get('/profile', 
//   authMiddleware.authenticateToken, 
//   rateLimitMiddleware.apiRateLimit(),
//   userController.getUserProfile
// );

// router.put('/profile', 
//   authMiddleware.authenticateToken, 
//   rateLimitMiddleware.apiRateLimit(), 
//   validate(userValidation.updateProfile),
//   userController.updateUserProfile
// );

// // Password management
// router.put('/password', 
//   authMiddleware.authenticateToken, 
//   rateLimitMiddleware.apiRateLimit(), 
//   validate(userValidation.changePassword),
//   userController.changePassword
// );

// // User preferences
// router.get('/preferences', 
//   authMiddleware.authenticateToken, 
//   rateLimitMiddleware.apiRateLimit(), 
//   userController.getUserPreferences
// );

// router.put('/preferences', 
//   authMiddleware.authenticateToken, 
//   rateLimitMiddleware.apiRateLimit(), 
//   validate(userValidation.updatePreferences),
//   userController.updateUserPreferences
// );

module.exports = router;
