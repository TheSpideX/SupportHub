import { logger } from "@/utils/logger";
import { tokenService } from "./TokenService";

/**
 * Service to manage token refresh queue
 * This service coordinates token refreshes across multiple requests
 * to prevent race conditions and duplicate refresh attempts
 *
 * It works with the TokenService and respects the leader tab election
 * from the WebSocket service
 */
class RefreshQueueService {
  private refreshing: boolean = false;
  private queue: Array<{
    resolve: (value: unknown) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor() {
    // Check if TokenService is already refreshing
    if (
      tokenService &&
      typeof tokenService.getRefreshingStatus === "function"
    ) {
      this.refreshing = tokenService.getRefreshingStatus();
    }

    logger.debug("RefreshQueueService initialized");
  }

  /**
   * Check if a token refresh is currently in progress
   */
  public isRefreshInProgress(): boolean {
    // First check TokenService if available
    if (
      tokenService &&
      typeof tokenService.getRefreshingStatus === "function"
    ) {
      return tokenService.getRefreshingStatus() || this.refreshing;
    }
    return this.refreshing;
  }

  /**
   * Add a request to the refresh queue
   * Returns a promise that resolves when the refresh completes
   */
  public enqueue(): Promise<unknown> {
    logger.debug("Adding request to refresh queue");

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  /**
   * Set the refreshing flag
   * @param value New value for refreshing flag
   */
  public setRefreshing(value: boolean): void {
    this.refreshing = value;
  }

  /**
   * Process the queue after a refresh attempt
   * @param success Whether the refresh was successful
   * @param error Optional error if refresh failed
   */
  public processQueue(success: boolean, error?: any): void {
    logger.debug(
      `Processing refresh queue (${this.queue.length} items) with success=${success}`
    );

    // Reset refreshing flag
    this.refreshing = false;

    // Process all queued requests
    if (success) {
      // Resolve all promises in the queue
      this.queue.forEach(({ resolve }) => resolve(true));
    } else {
      // Reject all promises in the queue
      this.queue.forEach(({ reject }) =>
        reject(error || new Error("Token refresh failed"))
      );
    }

    // Clear the queue
    this.queue = [];
  }
}

// Create singleton instance
export const refreshQueueService = new RefreshQueueService();
