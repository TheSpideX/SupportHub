const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const { authMiddleware } = require('../middleware/auth.middleware');

// Public routes
router.use('/', authRoutes);

module.exports = router;
