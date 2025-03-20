/**
 * Service to manage token refresh queue
 * Prevents multiple simultaneous refresh attempts
 */
export class RefreshQueueService {
  private isRefreshing = false;
  private refreshQueue: Array<{
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  /**
   * Add a request to the refresh queue
   * @returns Promise that resolves when refresh completes
   */
  public enqueue(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.refreshQueue.push({ resolve, reject });
    });
  }

  /**
   * Process the refresh queue
   * @param success Whether the refresh was successful
   * @param error Optional error if refresh failed
   */
  public processQueue(success: boolean, error?: any): void {
    this.refreshQueue.forEach(promise => {
      if (success) {
        promise.resolve(true);
      } else {
        promise.reject(error);
      }
    });

    this.refreshQueue = [];
    this.isRefreshing = false;
  }

  /**
   * Check if a refresh is in progress
   */
  public isRefreshInProgress(): boolean {
    return this.isRefreshing;
  }

  /**
   * Set refresh in progress state
   */
  public setRefreshing(value: boolean): void {
    this.isRefreshing = value;
  }
}

// Export singleton instance
export const refreshQueueService = new RefreshQueueService();