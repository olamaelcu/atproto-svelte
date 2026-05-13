import { createQuery } from '@tanstack/svelte-query';
import type { Profile } from '../../types/index.js';

export function createProfileQuery(did: string) {
  return createQuery({
    queryKey: ['identity', 'profile', did],
    queryFn: () => fetchProfile(did),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30
  });
}

async function fetchProfile(did: string): Promise<Profile> {
  throw new Error('Not yet implemented');
}