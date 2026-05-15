import { createQuery, QueryClient } from '@tanstack/svelte-query';
import type { CreateQueryResult, QueryClientConfig } from '@tanstack/svelte-query';
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
} from '../constants.js';

const defaultOptions = {
	queries: {
		staleTime: IDENTITY_STALE_TIME_MS,
		gcTime: IDENTITY_GC_TIME_MS,
		refetchOnWindowFocus: false,
		retry: IDENTITY_QUERY_RETRY_COUNT,
		retryDelay: IDENTITY_QUERY_RETRY_DELAY_MS
	}
};

/**
 * Default singleton QueryClient for identity resolution.
 * Uses sensible defaults suitable for most use cases.
 *
 * For consumers who need to customize Tanstack Query behavior (e.g., different cache times,
 * custom query callbacks, or who use Tanstack Query for other purposes in the same app),
 * use `createIdentityClient()` to create a customized instance.
 *
 * @example
 * // Using the default singleton
 * const query = createIdentityQuery('handle.example.com');
 *
 * @example
 * // Creating a custom client with different config
 * const customClient = createIdentityClient({
 *   defaultOptions: {
 *     queries: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 }
 *   }
 * });
 */
export const identityClient = new QueryClient({ defaultOptions });

/**
 * Factory function to create a customized QueryClient for identity resolution.
 *
 * Use this when you need to customize Tanstack Query options (e.g., different cache times,
 * custom query callbacks) or when your application uses Tanstack Query for multiple purposes
 * and needs separate configuration from the default singleton.
 *
 * @param options - Optional QueryClientConfig to override default settings.
 *                  When provided, these options are merged with sensible defaults.
 *                  Pass `undefined` to get a client with all defaults.
 *
 * @returns A new QueryClient instance configured for identity resolution
 *
 * @example
 * // Create a client with custom staleTime
 * const client = createIdentityClient({
 *   defaultOptions: {
 *     queries: { staleTime: 60 * 1000 }
 *   }
 * });
 *
 * @example
 * // Create a client for SSR with disabled caching
 * const ssrClient = createIdentityClient({
 *   defaultOptions: {
 *     queries: { gcTime: 0, staleTime: Infinity }
 *   }
 * });
 */
export function createIdentityClient(options?: QueryClientConfig): QueryClient {
	return new QueryClient({
		defaultOptions: {
			...defaultOptions,
			...options?.defaultOptions,
			queries: {
				...defaultOptions.queries,
				...options?.defaultOptions?.queries
			}
		}
	});
}

export function createIdentityQuery(identifier: string, publicApiUrl?: string): CreateQueryResult<Identity, Error> {
	return createQuery({
		queryKey: ['identity', 'resolve', identifier],
		queryFn: () => resolveIdentity(identifier, publicApiUrl),
		staleTime: IDENTITY_STALE_TIME_MS,
		gcTime: IDENTITY_GC_TIME_MS
	});
}

export function createResolveHandleQuery(handle: string, publicApiUrl?: string): CreateQueryResult<Identity, Error> {
	return createQuery({
		queryKey: ['identity', 'handle', handle],
		queryFn: () => resolveHandle(handle, publicApiUrl),
		staleTime: IDENTITY_STALE_TIME_MS,
		gcTime: IDENTITY_GC_TIME_MS
	});
}

export function createResolveDidQuery(did: string, publicApiUrl?: string): CreateQueryResult<Identity, Error> {
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
		signingKey: null
	}));
}

function resolveDid(did: string, publicApiUrl?: string): Promise<Identity> {
	const agent = new Agent(publicApiUrl ?? DEFAULT_PUBLIC_API_URL);
	return agent.getProfile({ actor: did }).then((res) => ({
		did: res.data.did,
		handle: res.data.handle,
		pdsUrl: null,
		signingKey: null
	}));
}

function resolveIdentity(identifier: string, publicApiUrl?: string): Promise<Identity> {
	if (identifier.startsWith('did:')) {
		return resolveDid(identifier, publicApiUrl);
	}
	return resolveHandle(identifier, publicApiUrl);
}

export { identityClient as default };