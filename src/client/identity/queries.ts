import { createQuery } from '@tanstack/svelte-query';
import type { CreateQueryResult } from '@tanstack/svelte-query';
import type { Identity } from '../../types/index.js';
import {
	IDENTITY_STALE_TIME_MS,
	IDENTITY_GC_TIME_MS,
	DID_STALE_TIME_MS,
	DID_GC_TIME_MS
} from '../../constants.js';

export function createIdentityQuery(identifier: string, publicApiUrl?: string): CreateQueryResult<Identity, Error> {
	return createQuery(() => ({
		queryKey: ['identity', 'resolve', identifier],
		queryFn: async () => {
			const { resolveIdentity } = await import('./resolvers.js');
			return resolveIdentity(identifier, publicApiUrl);
		},
		staleTime: IDENTITY_STALE_TIME_MS,
		gcTime: IDENTITY_GC_TIME_MS
	}));
}

export function createResolveHandleQuery(handle: string, publicApiUrl?: string): CreateQueryResult<Identity, Error> {
	return createQuery(() => ({
		queryKey: ['identity', 'handle', handle],
		queryFn: async () => {
			const { resolveHandle } = await import('./resolvers.js');
			return resolveHandle(handle, publicApiUrl);
		},
		staleTime: IDENTITY_STALE_TIME_MS,
		gcTime: IDENTITY_GC_TIME_MS
	}));
}

export function createResolveDidQuery(did: string, publicApiUrl?: string): CreateQueryResult<Identity, Error> {
	return createQuery(() => ({
		queryKey: ['identity', 'did', did],
		queryFn: async () => {
			const { resolveDid } = await import('./resolvers.js');
			return resolveDid(did, publicApiUrl);
		},
		staleTime: DID_STALE_TIME_MS,
		gcTime: DID_GC_TIME_MS
	}));
}
