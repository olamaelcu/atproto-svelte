export const IDENTITY_STALE_TIME_MS = 1000 * 60 * 10;
export const IDENTITY_GC_TIME_MS = 1000 * 60 * 60;

export const DID_STALE_TIME_MS = 1000 * 60 * 15;
export const DID_GC_TIME_MS = 1000 * 60 * 60 * 2;

export const PROFILE_STALE_TIME_MS = 1000 * 60 * 5;
export const PROFILE_GC_TIME_MS = 1000 * 60 * 30;

export const IDENTITY_QUERY_RETRY_COUNT = 2;
export const IDENTITY_QUERY_RETRY_DELAY_MS = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000);

export const DEFAULT_PUBLIC_API_URL = 'https://public.api.bsky.app';
