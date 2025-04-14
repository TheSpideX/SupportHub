const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// User management routes
router.get('/users', auth, userController.getUsers);
router.post('/users/by-ids', auth, userController.getUsersByIds);

module.exports = router;
