/**
 * SLA Check Job
 * Regularly checks for SLA breaches and sends notifications
 */

const slaService = require('../modules/ticket/services/sla.service');
const logger = require('../utils/logger');
const Queue = require('bull');
const config = require('../config');

// Create a Bull queue for SLA checks
const slaCheckQueue = new Queue('sla-check', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Process the SLA check job
slaCheckQueue.process(async (job) => {
  try {
    logger.info('Running SLA breach check job');
    
    // Get all organizations from the job data or check all
    const organizationId = job.data.organizationId || null;
    
    // Run the SLA breach check
    const results = await slaService.checkSLABreaches(organizationId);
    
    logger.info('SLA breach check completed', results);
    return results;
  } catch (error) {
    logger.error('Error in SLA breach check job:', error);
    throw error;
  }
});

// Schedule the job to run every 15 minutes
function scheduleJob() {
  slaCheckQueue.add(
    {},
    {
      repeat: {
        cron: '*/15 * * * *', // Every 15 minutes
      },
    }
  );
  
  logger.info('SLA breach check job scheduled to run every 15 minutes');
}

// Handle completed jobs
slaCheckQueue.on('completed', (job, result) => {
  logger.info(`SLA check job ${job.id} completed`, result);
});

// Handle failed jobs
slaCheckQueue.on('failed', (job, error) => {
  logger.error(`SLA check job ${job.id} failed:`, error);
});

module.exports = {
  scheduleJob,
  queue: slaCheckQueue,
};
