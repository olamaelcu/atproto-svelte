import { createQuery, QueryClient } from '@tanstack/svelte-query';
import { Agent } from '@atproto/api';
import type { Identity } from '../types/index.js';
import {
	IDENTITY_STALE_TIME_MS,
	IDENTITY_GC_TIME_MS,
	DID_STALE_TIME_MS,
	DID_GC_TIME_MS,
	IDENTITY_QUERY_RETRY_COUNT,
	IDENTITY_QUERY_RETRY_DELAY_MS,
	DEFAULT_PUBLIC_API_URL
} from '../server/constants.js';

export const identityClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: IDENTITY_STALE_TIME_MS,
			gcTime: IDENTITY_GC_TIME_MS,
			refetchOnWindowFocus: false,
			retry: IDENTITY_QUERY_RETRY_COUNT,
			retryDelay: IDENTITY_QUERY_RETRY_DELAY_MS
		}
	}
});

export function createIdentityQuery(identifier: string, publicApiUrl?: string): ReturnType<typeof createQuery<Identity>> {
	return createQuery({
		queryKey: ['identity', 'resolve', identifier],
		queryFn: () => resolveIdentity(identifier, publicApiUrl),
		staleTime: IDENTITY_STALE_TIME_MS,
		gcTime: IDENTITY_GC_TIME_MS
	});
}

export function createResolveHandleQuery(handle: string, publicApiUrl?: string): ReturnType<typeof createQuery<Identity>> {
	return createQuery({
		queryKey: ['identity', 'handle', handle],
		queryFn: () => resolveHandle(handle, publicApiUrl),
		staleTime: IDENTITY_STALE_TIME_MS,
		gcTime: IDENTITY_GC_TIME_MS
	});
}

export function createResolveDidQuery(did: string, publicApiUrl?: string): ReturnType<typeof createQuery<Identity>> {
	return createQuery({
		queryKey: ['identity', 'did', did],
		queryFn: () => resolveDid(did, publicApiUrl),
		staleTime: DID_STALE_TIME_MS,
		gcTime: DID_GC_TIME_MS
	});
}

function resolveHandle(handle: string, publicApiUrl?: string): Promise<Identity> {
	const agent = new Agent(publicApiUrl ?? DEFAULT_PUBLIC_API_URL);
	return agent.resolveHandle({ handle }).then((res) => ({
		did: res.data.did,
		handle,
		pdsUrl: null,
		signingKey: null,
		isVerified: false
	}));
}

function resolveDid(did: string, publicApiUrl?: string): Promise<Identity> {
	const agent = new Agent(publicApiUrl ?? DEFAULT_PUBLIC_API_URL);
	return agent.getProfile({ actor: did }).then((res) => ({
		did: res.data.did,
		handle: res.data.handle,
		pdsUrl: null,
		signingKey: null,
		isVerified: false
	}));
}

function resolveIdentity(identifier: string, publicApiUrl?: string): Promise<Identity> {
	if (identifier.startsWith('did:')) {
		return resolveDid(identifier, publicApiUrl);
	}
	return resolveHandle(identifier, publicApiUrl);
}

export { identityClient as default };