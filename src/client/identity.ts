import { createQuery, QueryClient } from '@tanstack/svelte-query';
import type { Identity } from '../types/index.js';

export const identityClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
    }
  }
});

export function createIdentityQuery(identifier: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'resolve', identifier],
    queryFn: () => resolveIdentity(identifier),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60
  });
}

export function createResolveHandleQuery(handle: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'handle', handle],
    queryFn: () => resolveHandle(handle),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60
  });
}

export function createResolveDidQuery(did: string): ReturnType<typeof createQuery<Identity>> {
  return createQuery({
    queryKey: ['identity', 'did', did],
    queryFn: () => resolveDid(did),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 2
  });
}

async function resolveHandle(handle: string): Promise<Identity> {
  const { resolveHandle: fn } = await import('../server/index.js');
  return fn(handle);
}

async function resolveDid(did: string): Promise<Identity> {
  const { resolveDid: fn } = await import('../server/index.js');
  return fn(did);
}

async function resolveIdentity(identifier: string): Promise<Identity> {
  const { resolveIdentity: fn } = await import('../server/index.js');
  return fn(identifier);
}

export { identityClient as default };