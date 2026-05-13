import { createQuery } from '@tanstack/svelte-query';
import type { Profile } from '../types/index.js';
import type { Agent } from '@atproto/api';
import { PROFILE_STALE_TIME_MS, PROFILE_GC_TIME_MS } from '../server/constants.js';

/**
 * Create a query for fetching a user's profile.
 *
 * @param did - The user's DID
 * @param agent - Optional ATProto Agent for authenticated requests
 * @returns A Tanstack Query for the Profile
 *
 * @remarks
 * Fetches the public profile data for a user. Results are cached for 5 minutes.
 * If an authenticated agent is provided, the query may return additional private
 * data depending on the server's access controls.
 *
 * @example
 * ```ts
 * const query = createProfileQuery('did:plc:abc123');
 * const { data, isLoading } = query;
 * ```
 */
export function createProfileQuery(did: string, agent?: Agent) {
  return createQuery({
    queryKey: ['identity', 'profile', did],
    queryFn: () => fetchProfile(did, agent),
    staleTime: PROFILE_STALE_TIME_MS,
    gcTime: PROFILE_GC_TIME_MS
  });
}

async function fetchProfile(did: string, agent?: Agent): Promise<Profile> {
  const { fetchProfile: fn } = await import('../server/profile.js');
  return fn(did, agent);
}