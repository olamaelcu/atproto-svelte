export class TokenBucketRateLimiter {
	private readonly maxRequests: number;
	private readonly windowMs: number;
	private tokens: number;
	private lastRefill: number;
	private mutex: Promise<void>;

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

	async acquire(): Promise<void> {
		return this.acquireMutex(async () => {
			this.refill();
			if (this.tokens >= 1) {
				this.tokens -= 1;
				return;
			}

			const waitMs = this.calculateWaitTime();
			await this.sleep(waitMs);

			this.refill();
			this.tokens -= 1;
		});
	}

	private refill(): void {
		const now = Date.now();
		const elapsed = now - this.lastRefill;

		if (elapsed >= this.windowMs) {
			this.tokens = this.maxRequests;
			this.lastRefill = now;
		} else if (elapsed > 0) {
			const tokensToAdd = (elapsed / this.windowMs) * this.maxRequests;
			this.tokens = Math.min(this.maxRequests, this.tokens + tokensToAdd);
			this.lastRefill = now - (elapsed % this.windowMs);
		}
	}

	private calculateWaitTime(): number {
		const tokensNeeded = 1 - this.tokens;
		return Math.ceil((tokensNeeded / this.maxRequests) * this.windowMs);
	}

	private async acquireMutex<T>(fn: () => T | Promise<T>): Promise<T> {
		const release = await this.getMutex();
		try {
			return await fn();
		} finally {
			release();
		}
	}

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

interface AttemptRecord {
	count: number;
	firstAttempt: number;
}

export class FailedAttemptsTracker {
	private readonly maxAttempts: number;
	private readonly lockoutMs: number;
	private attempts: Map<string, AttemptRecord>;

	constructor(maxAttempts: number, lockoutMs: number) {
		if (maxAttempts <= 0 || lockoutMs <= 0) {
			throw new Error('maxAttempts and lockoutMs must be positive');
		}
		this.maxAttempts = maxAttempts;
		this.lockoutMs = lockoutMs;
		this.attempts = new Map();
	}

	recordFailure(key: string): void {
		const now = Date.now();
		const record = this.attempts.get(key);

		if (!record) {
			this.attempts.set(key, { count: 1, firstAttempt: now });
		} else {
			if (now - record.firstAttempt > this.lockoutMs) {
				this.attempts.set(key, { count: 1, firstAttempt: now });
			} else {
				record.count += 1;
			}
		}

		this.cleanup();
	}

	recordSuccess(key: string): void {
		this.attempts.delete(key);
	}

	isLockedOut(key: string): boolean {
		const record = this.attempts.get(key);
		if (!record) {
			return false;
		}

		const now = Date.now();
		const windowExpired = now - record.firstAttempt > this.lockoutMs;

		if (windowExpired) {
			this.attempts.delete(key);
			return false;
		}

		return record.count >= this.maxAttempts;
	}

	private cleanup(): void {
		const now = Date.now();
		for (const [key, record] of this.attempts.entries()) {
			if (now - record.firstAttempt > this.lockoutMs) {
				this.attempts.delete(key);
			}
		}
	}
}