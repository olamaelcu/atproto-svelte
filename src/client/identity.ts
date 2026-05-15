import { createQuery, QueryClient } from '@tanstack/svelte-query';
import type { Identity } from '../types/index.js';
import { Agent } from '@atproto/api';
import {
  IDENTITY_STALE_TIME_MS,
  IDENTITY_GC_TIME_MS,
  DID_STALE_TIME_MS,
  DID_GC_TIME_MS,
  IDENTITY_QUERY_RETRY_COUNT,
  IDENTITY_QUERY_RETRY_DELAY_MS,
  DEFAULT_PUBLIC_API_URL
} from '../server/constants.js';

const identityClient = new QueryClient({
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

export { identityClient };

async function resolveIdentityViaAgent(identifier: string): Promise<Identity> {
  const agent = new Agent(DEFAULT_PUBLIC_API_URL);

  let did: string;
  let handle: string | null = null;

  if (identifier.startsWith('did:')) {
    did = identifier;
    const docResponse = await fetch(`https://plc.directory/${did}`, {
      headers: { Accept: 'application/json' }
    });

    if (docResponse.ok) {
      const doc = await docResponse.json();
      const alsoKnownAs: string[] = doc.alsoKnownAs ?? [];
      handle = alsoKnownAs.find((ak) => ak.startsWith('at://'))?.replace('at://', '') ?? null;
      const pdsService = doc.service?.find(
        (s: { type: string; id: string }) => s.type === '#atproto_pds' || s.id.endsWith('#atproto_pds')
      );
      const pdsUrl = pdsService?.endpoint ?? null;
      return {
        did,
        handle,
        pdsUrl,
        signingKey: null,
        isVerified: false
      };
    }
  } else {
    handle = identifier;
    const handleResponse = await agent.com.atproto.identity.resolveHandle({ handle });
    did = handleResponse.data.did;
  }

  return {
    did,
    handle,
    pdsUrl: null,
    signingKey: null,
    isVerified: false
  };
}

export function createIdentityQuery(identifier: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'resolve', identifier],
    queryFn: () => resolveIdentityViaAgent(identifier),
    staleTime: IDENTITY_STALE_TIME_MS,
    gcTime: IDENTITY_GC_TIME_MS
  });
}

export function createResolveHandleQuery(handle: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'handle', handle],
    queryFn: () => resolveIdentityViaAgent(handle),
    staleTime: IDENTITY_STALE_TIME_MS,
    gcTime: IDENTITY_GC_TIME_MS
  });
}

export function createResolveDidQuery(did: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'did', did],
    queryFn: () => resolveIdentityViaAgent(did),
    staleTime: DID_STALE_TIME_MS,
    gcTime: DID_GC_TIME_MS
  });
}