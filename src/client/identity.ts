import { createQuery, QueryClient } from '@tanstack/svelte-query';
import type { Identity } from '../types/index.js';
import {
  IDENTITY_STALE_TIME_MS,
  IDENTITY_GC_TIME_MS,
  DID_STALE_TIME_MS,
  DID_GC_TIME_MS,
  IDENTITY_QUERY_RETRY_COUNT,
  IDENTITY_QUERY_RETRY_DELAY_MS
} from '../server/constants.js';

/**
 * Pre-configured Tanstack Query client for identity operations.
 *
 * @remarks
 * This client is pre-configured with sensible defaults for identity queries:
 * - 10 minute stale time for handle resolution
 * - 1 hour garbage collection time
 * - 2 retries with exponential backoff
 *
 * @example
 * ```ts
 * import { identityClient } from '@olamaelcu/atproto-svelte';
 *
 * // Use with QueryClientProvider
 * ```
 */
export const identityClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: IDENTITY_STALE_TIME_MS,
      gcTime: IDENTITY_GC_TIME_MS,
      refetchOnWindowFocus: false,
      retry: IDENTITY_QUERY_RETRY_COUNT,
      retryDelay: IDENTITY_QUERY_RETRY_DELAY_MS
    }
  }
});

/**
 * Create a query for resolving any identifier (handle or DID).
 *
 * @param identifier - Either a handle (e.g., 'alice.bsky.social') or DID
 * @returns A Tanstack Query for the resolved Identity
 *
 * @remarks
 * Automatically detects whether the identifier is a DID or handle
 * and resolves it accordingly. Results are cached for 10 minutes.
 *
 * @example
 * ```ts
 * const query = createIdentityQuery('alice.bsky.social');
 * const { data } = query;
 * ```
 */
export function createIdentityQuery(identifier: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'resolve', identifier],
    queryFn: () => resolveIdentity(identifier),
    staleTime: IDENTITY_STALE_TIME_MS,
    gcTime: IDENTITY_GC_TIME_MS
  });
}

/**
 * Create a query for resolving a handle to an Identity.
 *
 * @param handle - The handle to resolve (e.g., 'alice.bsky.social')
 * @returns A Tanstack Query for the resolved Identity
 *
 * @remarks
 * Resolves the handle via DNS TXT record or .well-known endpoint.
 * Results are cached for 10 minutes.
 *
 * @example
 * ```ts
 * const query = createResolveHandleQuery('alice.bsky.social');
 * const { data, isLoading } = query;
 * ```
 */
export function createResolveHandleQuery(handle: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'handle', handle],
    queryFn: () => resolveHandle(handle),
    staleTime: IDENTITY_STALE_TIME_MS,
    gcTime: IDENTITY_GC_TIME_MS
  });
}

/**
 * Create a query for resolving a DID to an Identity.
 *
 * @param did - The DID to resolve (e.g., 'did:plc:abc123')
 * @returns A Tanstack Query for the resolved Identity
 *
 * @remarks
 * Resolves the DID via the PLC directory. Results are cached for 15 minutes
 * since DIDs are more stable than handles.
 *
 * @example
 * ```ts
 * const query = createResolveDidQuery('did:plc:abc123');
 * const { data } = query;
 * ```
 */
export function createResolveDidQuery(did: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'did', did],
    queryFn: () => resolveDid(did),
    staleTime: DID_STALE_TIME_MS,
    gcTime: DID_GC_TIME_MS
  });
}

async function resolveHandle(handle: string): Promise<Identity> {
  const { resolveHandle: fn } = await import('../server/index.js');
  return fn(handle);
}

async function resolveDid(did: string): Promise<Identity> {
  const { resolveDid: fn } = await import('../server/index.js');
  return fn(did);
}

async function resolveIdentity(identifier: string): Promise<Identity> {
  const { resolveIdentity: fn } = await import('../server/index.js');
  return fn(identifier);
}

export { identityClient as default };