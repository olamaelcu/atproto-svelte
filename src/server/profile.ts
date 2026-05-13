import { Agent } from '@atproto/api';
import type { Profile } from '../types/index.js';

export async function fetchProfile(actor: string, agent?: Agent): Promise<Profile> {
  const profileAgent = agent ?? new Agent('https://public.api.bsky.app');

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
    followingCount: (response.data.followingCount as number) ?? 0,
  };
}
