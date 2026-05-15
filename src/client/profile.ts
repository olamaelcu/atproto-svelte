import { createQuery } from '@tanstack/svelte-query';
import type { Profile } from '../types/index.js';
import type { Agent } from '@atproto/api';
import { PROFILE_STALE_TIME_MS, PROFILE_GC_TIME_MS } from '../server/constants.js';

export function createProfileQuery(did: string, agent?: Agent, publicApiUrl?: string) {
  return createQuery({
    queryKey: ['identity', 'profile', did],
    queryFn: () => fetchProfile(did, agent, publicApiUrl),
    staleTime: PROFILE_STALE_TIME_MS,
    gcTime: PROFILE_GC_TIME_MS
  });
}

async function fetchProfile(did: string, agent?: Agent, publicApiUrl?: string): Promise<Profile> {
  const { fetchProfile: fn } = await import('../server/profile.js');
  return fn(did, agent, publicApiUrl);
}