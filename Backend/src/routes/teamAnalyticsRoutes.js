const express = require('express');
const router = express.Router();
const teamAnalyticsController = require('../controllers/teamAnalyticsController');
const auth = require('../middleware/auth');

// Team analytics routes
router.get('/teams/:id/analytics', auth, teamAnalyticsController.getTeamAnalytics);
router.get('/teams/:id/members/:memberId/activity', auth, teamAnalyticsController.getMemberActivity);

module.exports = router;
