/**
 * Auth Routes Index
 * 
 * This file serves as the entry point for all authentication-related routes.
 * It organizes and exports routes for authentication, user management, 
 * security, and session handling.
 */

const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const sessionRoutes = require('./session.routes');
const securityRoutes = require('./security.routes');

const router = express.Router();

// Auth routes
router.use('/auth', authRoutes);

// User routes
router.use('/users', userRoutes);

// Session routes
router.use('/auth/session', sessionRoutes);

// Security routes
router.use('/security', securityRoutes);

// OPTIONS handler for endpoint checking
// This supports the frontend's checkEndpointExists functionality
router.options('*', (req, res) => {
  // Return 200 OK with allowed methods
  res.header('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
  res.status(200).send();
});

module.exports = router;
