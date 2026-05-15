import { createQuery } from '@tanstack/svelte-query';
import { Agent } from '@atproto/api';
import type { Profile } from '../types/index.js';
import { PROFILE_STALE_TIME_MS, PROFILE_GC_TIME_MS, DEFAULT_PUBLIC_API_URL } from '../constants.js';

export function createProfileQuery(did: string, agent?: Agent, publicApiUrl?: string) {
	return createQuery({
		queryKey: ['identity', 'profile', did],
		queryFn: () => fetchProfile(did, agent, publicApiUrl),
		staleTime: PROFILE_STALE_TIME_MS,
		gcTime: PROFILE_GC_TIME_MS
	});
}

function fetchProfile(did: string, agent?: Agent, publicApiUrl?: string): Promise<Profile> {
	const profileAgent = agent ?? new Agent(publicApiUrl ?? DEFAULT_PUBLIC_API_URL);
	return profileAgent.getProfile({ actor: did }).then((res) => ({
		did: res.data.did,
		handle: res.data.handle,
		displayName: res.data.displayName ?? null,
		avatar: res.data.avatar ?? null,
		description: res.data.description ?? null,
		indexedAt: res.data.indexedAt ?? null,
		followsCount: res.data.followsCount ?? 0,
		followersCount: res.data.followersCount ?? 0,
		postsCount: res.data.postsCount ?? 0,
	}));
}