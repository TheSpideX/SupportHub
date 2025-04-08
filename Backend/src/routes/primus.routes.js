/**
 * Primus routes
 * Serves the Primus client library
 */

const express = require('express');
const router = express.Router();
const primusService = require('../services/primus.service');
const logger = require('../utils/logger');

/**
 * GET /primus/client.js
 * Serves the Primus client library
 */
router.get('/client.js', (req, res) => {
  try {
    // Get client library
    const clientLibrary = primusService.getClientLibrary();
    
    // Set headers
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    
    // Send client library
    res.send(clientLibrary);
  } catch (error) {
    logger.error('Failed to serve Primus client library', error);
    res.status(500).send('Failed to serve Primus client library');
  }
});

/**
 * GET /primus/stats
 * Returns Primus statistics
 */
router.get('/stats', (req, res) => {
  try {
    // Get statistics
    const stats = {
      connectedClients: primusService.getConnectedCount(),
      timestamp: Date.now()
    };
    
    // Send statistics
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get Primus statistics', error);
    res.status(500).json({ error: 'Failed to get Primus statistics' });
  }
});

module.exports = router;
