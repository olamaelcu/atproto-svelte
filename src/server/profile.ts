import { Agent } from '@atproto/api';
import type { Profile } from '../types/index.js';
import { DEFAULT_PUBLIC_API_URL } from './constants.js';

/**
 * Fetch a user's profile from the ATProto API.
 *
 * @param actor - The actor's handle or DID (e.g., 'alice.bsky.social' or 'did:plc:abc123')
 * @param agent - Optional ATProto Agent for authenticated requests. If not provided, uses the public API.
 * @param publicApiUrl - Optional public API URL (defaults to 'https://public.api.bsky.app')
 * @returns The user's profile data
 *
 * @remarks
 * Fetches profile information for the specified actor. When an authenticated
 * agent is provided, the request uses that agent's credentials. Otherwise,
 * it falls back to the public unauthenticated API endpoint.
 *
 * @example
 * ```ts
 * // Public profile fetch
 * const profile = await fetchProfile('alice.bsky.social');
 *
 * // Authenticated fetch
 * const agent = new Agent('https://bsky.social');
 * await agent.login({ identifier: 'alice', password: '...' });
 * const profile = await fetchProfile('alice.bsky.social', agent);
 * ```
 */
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
    followingCount: (response.data.followingCount as number) ?? 0,
  };
}