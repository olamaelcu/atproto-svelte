import { createQuery } from '@tanstack/svelte-query';
import { Agent } from '@atproto/api';
import { PROFILE_STALE_TIME_MS, PROFILE_GC_TIME_MS, DEFAULT_PUBLIC_API_URL } from '../server/constants.js';

export function createProfileQuery(did: string, agent?: Agent, publicApiUrl?: string) {
  return createQuery({
    queryKey: ['identity', 'profile', did],
    queryFn: async () => {
      const profileAgent = agent ?? new Agent(publicApiUrl ?? DEFAULT_PUBLIC_API_URL);
      const response = await profileAgent.getProfile({ actor: did });
      return {
        did: response.data.did,
        handle: response.data.handle,
        displayName: response.data.displayName ?? null,
        avatar: response.data.avatar ?? null,
        description: response.data.description ?? null,
        indexedAt: response.data.indexedAt ?? null,
        followsCount: response.data.followsCount ?? 0,
        followersCount: response.data.followersCount ?? 0,
        followingCount: (response.data.followingCount as number) ?? 0,
      };
    },
    staleTime: PROFILE_STALE_TIME_MS,
    gcTime: PROFILE_GC_TIME_MS
  });
}