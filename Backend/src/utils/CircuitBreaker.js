const logger = require("./logger");

/**
 * Circuit breaker pattern implementation for protecting services
 */
class CircuitBreaker {
  /**
   * Create a new circuit breaker
   * @param {string} name - Name of the circuit breaker for logging
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening circuit
   * @param {number} options.resetTimeout - Time in ms to wait before trying half-open state
   * @param {number} options.monitorInterval - Time in ms between health checks
   */
  constructor(name, options = {}) {
    this.name = name;
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.threshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute default

    // Set up monitoring interval
    this.monitorInterval = setInterval(() => {
      this.checkHealth();
    }, options.monitorInterval || 30000); // 30 seconds default

    logger.debug(`Circuit breaker "${name}" initialized`);
  }

  /**
   * Check if the operation should be allowed
   * @returns {boolean} True if operation is allowed
   */
  isAllowed() {
    // If circuit is closed, always allow
    if (this.state === "CLOSED") {
      return true;
    }

    // If circuit is open, check if it's time to try half-open
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now >= this.lastFailureTime + this.resetTimeout) {
        this.state = "HALF_OPEN";
        logger.debug(`Circuit ${this.name} entering half-open state`);
        return true;
      }
      return false;
    }

    // If circuit is half-open, allow one test request
    return this.state === "HALF_OPEN";
  }

  /**
   * Record a successful operation
   */
  recordSuccess() {
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.failureCount = 0;
      logger.debug(`Circuit ${this.name} closed after successful operation`);
    } else if (this.state === "CLOSED" && this.failureCount > 0) {
      // Reset failure count if we had some failures but not enough to trip
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Record a failed operation
   * @returns {boolean} True if circuit is still allowing operations
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Immediate trip back to open on failure in half-open
      this.state = "OPEN";
      logger.warn(`Circuit ${this.name} reopened after half-open failure`);
      return false;
    } else if (this.state === "CLOSED" && this.failureCount >= this.threshold) {
      this.state = "OPEN";
      logger.warn(
        `Circuit ${this.name} opened after ${this.failureCount} failures`
      );
      return false;
    }

    return this.state === "CLOSED";
  }

  /**
   * Check circuit health and try to recover if possible
   */
  checkHealth() {
    const now = Date.now();

    // If circuit has been open for a while, try half-open
    if (
      this.state === "OPEN" &&
      now >= this.lastFailureTime + this.resetTimeout
    ) {
      this.state = "HALF_OPEN";
      logger.debug(
        `Circuit ${this.name} entering half-open state during health check`
      );
    }

    // If we've had failures but not enough to trip, and it's been a while, reset
    if (
      this.state === "CLOSED" &&
      this.failureCount > 0 &&
      now >= this.lastFailureTime + this.resetTimeout * 2
    ) {
      this.failureCount = 0;
      logger.debug(
        `Circuit ${this.name} reset failure count during health check`
      );
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    clearInterval(this.monitorInterval);
    logger.debug(`Circuit breaker "${this.name}" cleaned up`);
  }
}

module.exports = CircuitBreaker;
