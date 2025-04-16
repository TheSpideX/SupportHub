/**
 * Test Routes
 * Routes for testing API functionality
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Test route for JSON parsing
router.post('/json-test', (req, res) => {
  logger.info('JSON test route called', {
    body: req.body,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body),
    hasRawBody: !!req.rawBody,
    rawBodyType: typeof req.rawBody,
    rawBodyLength: req.rawBody ? req.rawBody.length : 0,
    contentType: req.headers['content-type'],
    method: req.method,
    url: req.url,
  });

  // Try to parse raw body if available
  let parsedRawBody = null;
  if (req.rawBody && typeof req.rawBody === 'string') {
    try {
      parsedRawBody = JSON.parse(req.rawBody);
      logger.info('Successfully parsed raw body', { parsedRawBody });
    } catch (e) {
      logger.error('Failed to parse raw body', e);
    }
  }

  return res.status(200).json({
    success: true,
    received: {
      body: req.body,
      bodyKeys: Object.keys(req.body),
      bodyEmpty: Object.keys(req.body).length === 0,
      hasRawBody: !!req.rawBody,
      rawBodyType: typeof req.rawBody,
      rawBodyLength: req.rawBody ? req.rawBody.length : 0,
      parsedRawBody,
      contentType: req.headers['content-type'],
    },
  });
});

// Test route for form data
router.post('/form-test', (req, res) => {
  logger.info('Form test route called', {
    body: req.body,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body),
    files: req.files,
    contentType: req.headers['content-type'],
  });

  return res.status(200).json({
    success: true,
    received: {
      body: req.body,
      bodyKeys: Object.keys(req.body),
      files: req.files,
      contentType: req.headers['content-type'],
    },
  });
});

// Test route for GET requests
router.get('/get-test', (req, res) => {
  logger.info('GET test route called', {
    query: req.query,
    headers: req.headers,
  });

  return res.status(200).json({
    success: true,
    received: {
      query: req.query,
      headers: req.headers,
    },
  });
});

module.exports = router;
