/**
 * Query caching constants for identity resolution.
 */
export const IDENTITY_STALE_TIME_MS = 1000 * 60 * 10;
export const IDENTITY_GC_TIME_MS = 1000 * 60 * 60;

/**
 * Query caching constants for DID resolution (longer stale time since DIDs are stable).
 */
export const DID_STALE_TIME_MS = 1000 * 60 * 15;
export const DID_GC_TIME_MS = 1000 * 60 * 60 * 2;

/**
 * Query caching constants for profile fetching.
 */
export const PROFILE_STALE_TIME_MS = 1000 * 60 * 5;
export const PROFILE_GC_TIME_MS = 1000 * 60 * 30;

/**
 * Token encoding constants.
 */
export const TOKEN_RANDOM_BYTES_LENGTH = 20;

/**
 * Retry configuration for query failures.
 */
export const IDENTITY_QUERY_RETRY_COUNT = 2;
export const IDENTITY_QUERY_RETRY_DELAY_MS = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000);

/**
 * Default PLC directory URL for DID document lookups.
 */
export const DEFAULT_PLC_DIRECTORY_URL = 'https://plc.directory';

/**
 * Default public Bluesky API URL for unauthenticated profile fetching.
 */
export const DEFAULT_PUBLIC_API_URL = 'https://public.api.bsky.app';