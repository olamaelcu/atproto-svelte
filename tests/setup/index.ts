import { vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { MockUser } from './mock-http';

export { type MockUser };

export function createMockEvent(cookies: Record<string, string> = {}): RequestEvent {
	const cookieStore = { ...cookies };

	return {
		cookies: {
			get: (name: string) => cookieStore[name] ?? null,
			set: (name: string, value: string, _options?: Record<string, unknown>) => {
				if (value === '') {
					delete cookieStore[name];
				} else {
					cookieStore[name] = value;
				}
			},
			delete: (name: string) => {
				delete cookieStore[name];
			}
		},
		request: {
			headers: {
				get: (name: string) => {
					if (name === 'cookie') {
						return Object.entries(cookieStore)
							.map(([k, v]) => `${k}=${v}`)
							.join('; ');
					}
					if (name === 'x-forwarded-for') return null;
					if (name === 'x-real-ip') return null;
					return null;
				}
			},
			method: 'GET',
			url: new URL('http://localhost')
		},
		locals: {}
	} as unknown as RequestEvent;
}

export function createMockOAuthClient(mockUser?: MockUser | null): NodeOAuthClient {
	const resolvedMockUser = mockUser ?? {
		did: 'did:plc:test123',
		handle: 'test.bsky.social',
		displayName: 'Test User'
	};

	return {
		authorize: vi.fn().mockImplementation(async (handle: string) => {
			return `https://bsky.social/oauth/authorize?handle=${handle}`;
		}),
		callback: vi.fn().mockImplementation(async () => {
			return {
				session: {
					did: resolvedMockUser.did,
					handle: resolvedMockUser.handle,
					accessJwt: 'mock-access-jwt',
					refreshJwt: 'mock-refresh-jwt'
				}
			};
		}),
		restore: vi.fn().mockImplementation(async (did: string) => {
			if (!did) {
				throw new Error('No DID provided');
			}
			return {
				did,
				handle: resolvedMockUser.handle,
				accessJwt: 'mock-access-jwt',
				refreshJwt: 'mock-refresh-jwt'
			};
		}),
		revoke: vi.fn().mockResolvedValue(undefined)
	} as unknown as NodeOAuthClient;
}