interface RateLimiterOptions {
    maxRequests: number;
    perWindow: number;
    blacklistDuration: number;
}

interface RateLimit {
    count: number;
    firstRequest: number;
    blacklistedUntil?: number;
}

export class RateLimiter {
    private limits: Map<string, RateLimit>;
    private options: RateLimiterOptions;

    constructor(options: RateLimiterOptions) {
        this.limits = new Map();
        this.options = options;
        this.startCleanupInterval();
    }

    async checkLimit(key: string): Promise<boolean> {
        const now = Date.now();
        const limit = this.limits.get(key) || { count: 0, firstRequest: now };

        // Check if blacklisted
        if (limit.blacklistedUntil && limit.blacklistedUntil > now) {
            return false;
        }

        // Reset window if needed
        if (now - limit.firstRequest > this.options.perWindow) {
            limit.count = 0;
            limit.firstRequest = now;
        }

        // Increment counter
        limit.count++;

        // Check if limit exceeded
        if (limit.count > this.options.maxRequests) {
            limit.blacklistedUntil = now + this.options.blacklistDuration;
            this.limits.set(key, limit);
            return false;
        }

        this.limits.set(key, limit);
        return true;
    }

    private startCleanupInterval(): void {
        setInterval(() => {
            const now = Date.now();
            for (const [key, limit] of this.limits.entries()) {
                if (now - limit.firstRequest > this.options.perWindow * 2) {
                    this.limits.delete(key);
                }
            }
        }, this.options.perWindow);
    }

    clear(): void {
        this.limits.clear();
    }
}