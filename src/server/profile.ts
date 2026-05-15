import { Agent } from '@atproto/api';
import type { Profile } from '../types/index.js';
import { DEFAULT_PUBLIC_API_URL } from './constants.js';

export async function fetchProfile(actor: string, agent?: Agent, publicApiUrl?: string): Promise<Profile> {
  const profileAgent = agent ?? new Agent(publicApiUrl ?? DEFAULT_PUBLIC_API_URL);

  const response = await profileAgent.getProfile({ actor });

return {
		did: response.data.did,
		handle: response.data.handle,
		displayName: response.data.displayName ?? null,
		avatar: response.data.avatar ?? null,
		description: response.data.description ?? null,
		indexedAt: response.data.indexedAt ?? null,
		followsCount: response.data.followsCount ?? 0,
		followersCount: response.data.followersCount ?? 0,
	};}