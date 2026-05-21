import { createQuery } from '@tanstack/svelte-query';
import type { Agent } from '@atproto/api';
import { PROFILE_STALE_TIME_MS, PROFILE_GC_TIME_MS } from '../../constants.js';

export function createProfileQuery(did: string, agent?: Agent, publicApiUrl?: string) {
	return createQuery(() => ({
		queryKey: ['identity', 'profile', did],
		queryFn: async () => {
			const { fetchProfile } = await import('./resolvers.js');
			return fetchProfile(did, agent, publicApiUrl);
		},
		staleTime: PROFILE_STALE_TIME_MS,
		gcTime: PROFILE_GC_TIME_MS
	}));
}
