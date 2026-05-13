import { createQuery } from '@tanstack/svelte-query';
import type { Profile } from '../types/index.js';
import type { Agent } from '@atproto/api';

export function createProfileQuery(did: string, agent?: Agent) {
  return createQuery({
    queryKey: ['identity', 'profile', did],
    queryFn: () => fetchProfile(did, agent),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30
  });
}

async function fetchProfile(did: string, agent?: Agent): Promise<Profile> {
  const { fetchProfile: fn } = await import('../server/profile.js');
  return fn(did, agent);
}