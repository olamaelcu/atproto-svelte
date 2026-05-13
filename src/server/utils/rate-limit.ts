/**
 * In-memory token bucket rate limiter implementing OWASP best practices.
 * Thread-safe implementation using a simple mutex pattern.
 */
export class TokenBucketRateLimiter {
	private readonly maxRequests: number;
	private readonly windowMs: number;
	private tokens: number;
	private lastRefill: number;
	private mutex: Promise<void>;

	/**
	 * @param maxRequests - Number of requests allowed per window
	 * @param windowMs - Window size in milliseconds
	 */
	constructor(maxRequests: number, windowMs: number) {
		if (maxRequests <= 0 || windowMs <= 0) {
			throw new Error('maxRequests and windowMs must be positive');
		}
		this.maxRequests = maxRequests;
		this.windowMs = windowMs;
		this.tokens = maxRequests;
		this.lastRefill = Date.now();
		this.mutex = Promise.resolve();
	}

	/**
	 * Attempts to acquire a token without blocking.
	 * @returns Promise<boolean> - true if token acquired, false otherwise
	 */
	async tryAcquire(): Promise<boolean> {
		return this.acquireMutex(() => {
			this.refill();
			if (this.tokens >= 1) {
				this.tokens -= 1;
				return true;
			}
			return false;
		});
	}

	/**
	 * Waits until a token is available, then acquires it.
	 * @returns Promise<void>
	 */
	async acquire(): Promise<void> {
		return this.acquireMutex(async () => {
			this.refill();
			if (this.tokens >= 1) {
				this.tokens -= 1;
				return;
			}

			// Calculate wait time until next token
			const waitMs = this.calculateWaitTime();
			await this.sleep(waitMs);

			// Refill and acquire after waiting
			this.refill();
			this.tokens -= 1;
		});
	}

	/**
	 * Refills tokens based on elapsed time since last refill.
	 * Implements proper token refill logic as per OWASP recommendations.
	 */
	private refill(): void {
		const now = Date.now();
		const elapsed = now - this.lastRefill;

		if (elapsed >= this.windowMs) {
			// Full window elapsed - reset to max
			this.tokens = this.maxRequests;
			this.lastRefill = now;
		} else if (elapsed > 0) {
			// Partial refill - add proportional tokens
			const tokensToAdd = (elapsed / this.windowMs) * this.maxRequests;
			this.tokens = Math.min(this.maxRequests, this.tokens + tokensToAdd);
			this.lastRefill = now - (elapsed % this.windowMs);
		}
	}

	/**
	 * Calculates time to wait for next available token.
	 */
	private calculateWaitTime(): number {
		const tokensNeeded = 1 - this.tokens;
		return Math.ceil((tokensNeeded / this.maxRequests) * this.windowMs);
	}

	/**
	 * Executes a function with mutex protection for thread-safety.
	 */
	private async acquireMutex<T>(fn: () => T | Promise<T>): Promise<T> {
		const release = await this.getMutex();
		try {
			return await fn();
		} finally {
			release();
		}
	}

	/**
	 * Gets mutex lock using a promise-based approach.
	 */
	private getMutex(): Promise<() => void> {
		return new Promise((resolve) => {
			let released = false;
			const prev = this.mutex;

			this.mutex = new Promise<void>((res) => {
				prev.then(() => {
					if (!released) {
						resolve(() => {
							released = true;
							res();
						});
					} else {
						res();
					}
				});
			});
		});
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Tracks failed authentication attempts to prevent brute force attacks.
 * Simple in-memory implementation with automatic lockout detection.
 */
interface AttemptRecord {
	count: number;
	firstAttempt: number;
}

export class FailedAttemptsTracker {
	private readonly maxAttempts: number;
	private readonly lockoutMs: number;
	private attempts: Map<string, AttemptRecord>;

	/**
	 * @param maxAttempts - Number of failed attempts before lockout
	 * @param lockoutMs - Duration of lockout in milliseconds
	 */
	constructor(maxAttempts: number, lockoutMs: number) {
		if (maxAttempts <= 0 || lockoutMs <= 0) {
			throw new Error('maxAttempts and lockoutMs must be positive');
		}
		this.maxAttempts = maxAttempts;
		this.lockoutMs = lockoutMs;
		this.attempts = new Map();
	}

	/**
	 * Records a failed attempt for the given key.
	 * @param key - Unique identifier (e.g., username, IP address)
	 */
	recordFailure(key: string): void {
		const now = Date.now();
		const record = this.attempts.get(key);

		if (!record) {
			this.attempts.set(key, { count: 1, firstAttempt: now });
		} else {
			// Reset if previous attempts have expired
			if (now - record.firstAttempt > this.lockoutMs) {
				this.attempts.set(key, { count: 1, firstAttempt: now });
			} else {
				record.count += 1;
			}
		}

		this.cleanup();
	}

	/**
	 * Records a successful attempt and resets the counter for the given key.
	 * @param key - Unique identifier (e.g., username, IP address)
	 */
	recordSuccess(key: string): void {
		this.attempts.delete(key);
	}

	/**
	 * Checks if the given key is currently locked out.
	 * @param key - Unique identifier (e.g., username, IP address)
	 * @returns true if locked out, false otherwise
	 */
	isLockedOut(key: string): boolean {
		const record = this.attempts.get(key);
		if (!record) {
			return false;
		}

		const now = Date.now();
		const windowExpired = now - record.firstAttempt > this.lockoutMs;

		if (windowExpired) {
			// Auto-cleanup expired record
			this.attempts.delete(key);
			return false;
		}

		return record.count >= this.maxAttempts;
	}

	/**
	 * Removes expired entries to prevent memory leaks.
	 */
	private cleanup(): void {
		const now = Date.now();
		for (const [key, record] of this.attempts.entries()) {
			if (now - record.firstAttempt > this.lockoutMs) {
				this.attempts.delete(key);
			}
		}
	}
}