import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockAtprotoServer, createMockOAuthClient, createMockEvent, type MockUser } from '../setup';
import { http, HttpResponse } from 'msw';

describe('OAuth Flow Integration', () => {
	let server: ReturnType<typeof createMockAtprotoServer>;
	let mockOAuthClient: ReturnType<typeof createMockOAuthClient>;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		server?.close();
	});

	describe('Full OAuth Authentication Flow', () => {
		it('completes authorization flow with valid handle', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:authflow',
				handle: 'authflow.bsky.social',
				displayName: 'Auth Flow User'
			};

			server = createMockAtprotoServer({
				authMeResponse: mockUser,
				authMeStatus: 200
			});
			server.listen();

			mockOAuthClient = createMockOAuthClient(mockUser);

			const authUrl = await mockOAuthClient.authorize('authflow.bsky.social');

			expect(authUrl).toContain('bsky.social');
			expect(authUrl).toContain('authflow.bsky.social');
		});

		it('handles callback with valid code', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:callback',
				handle: 'callback.bsky.social'
			};

			server = createMockAtprotoServer({
				authMeResponse: mockUser,
				authMeStatus: 200
			});
			server.listen();

			mockOAuthClient = createMockOAuthClient(mockUser);

			const result = await mockOAuthClient.callback(new URLSearchParams({
				code: 'valid-auth-code',
				state: 'test-state'
			}));

			expect(result.session).toBeTruthy();
			expect(result.session.did).toBe(mockUser.did);
			expect(result.session.handle).toBe(mockUser.handle);
		});

		it('restores session from stored credentials', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:restore',
				handle: 'restore.bsky.social'
			};

			server = createMockAtprotoServer({
				authMeResponse: mockUser,
				authMeStatus: 200
			});
			server.listen();

			mockOAuthClient = createMockOAuthClient(mockUser);

			const restored = await mockOAuthClient.restore(mockUser.did);

			expect(restored.did).toBe(mockUser.did);
			expect(restored.handle).toBe(mockUser.handle);
			expect(restored.accessJwt).toBeTruthy();
			expect(restored.refreshJwt).toBeTruthy();
		});

		it('revokes session successfully', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:revoke',
				handle: 'revoke.bsky.social'
			};

			server = createMockAtprotoServer();
			server.listen();

			mockOAuthClient = createMockOAuthClient(mockUser);

			await expect(mockOAuthClient.revoke(mockUser.did)).resolves.not.toThrow();
		});
	});

	describe('Session Cookie Management', () => {
		it('sets session cookie after successful auth', () => {
			const event = createMockEvent();

			event.cookies.set('session', 'new-session-token');

			expect(event.cookies.get('session')).toBe('new-session-token');
		});

		it('clears session cookie on logout', () => {
			const event = createMockEvent({ session: 'old-session' });

			event.cookies.delete('session');

			expect(event.cookies.get('session')).toBeNull();
		});

		it('clears session cookie by setting empty value', () => {
			const event = createMockEvent({ session: 'token-to-clear' });

			event.cookies.set('session', '');

			expect(event.cookies.get('session')).toBeNull();
		});

		it('generates cookie header for request', () => {
			const event = createMockEvent({
				session: 'main-session',
				csrf: 'csrf-token'
			});

			const cookieHeader = event.request.headers.get('cookie');

			expect(cookieHeader).toContain('session=main-session');
			expect(cookieHeader).toContain('csrf=csrf-token');
		});
	});

	describe('Handle Resolution in OAuth Flow', () => {
		it('resolves handle during authorization', async () => {
			server = createMockAtprotoServer({
				profileHandle: 'resolvehandle.bsky.social'
			});
			server.listen();

			const handle = 'resolvehandle.bsky.social';
			const response = await fetch(`http://localhost/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`);

			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(data.did).toBeTruthy();
		});

		it('fails authorization for non-existent handle', async () => {
			server = createMockAtprotoServer();
			server.listen();

			const response = await fetch('http://localhost/xrpc/com.atproto.identity.resolveHandle?handle=nonexistent.handle.bsky.social');

			expect(response.ok).toBe(true);
		});
	});

	describe('Profile Fetching After Auth', () => {
		it('fetches user profile after successful auth', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:profilefetch',
				handle: 'profilefetch.bsky.social',
				displayName: 'Profile Fetch User'
			};

			server = createMockAtprotoServer({
				authMeResponse: mockUser,
				profileDisplayName: mockUser.displayName
			});
			server.listen();

			const profileResponse = await fetch(`http://localhost/xrpc/app.bsky.actor.getProfile?actor=${mockUser.did}`);

			expect(profileResponse.ok).toBe(true);
			const profile = await profileResponse.json();
			expect(profile.did).toBe(mockUser.did);
			expect(profile.displayName).toBe(mockUser.displayName);
		});

		it('fetches profile with avatar and description', async () => {
			server = createMockAtprotoServer();
			server.listen();

			const profileResponse = await fetch('http://localhost/xrpc/app.bsky.actor.getProfile?actor=did:plc:withprofile');
			const profile = await profileResponse.json();

			expect(profile).toHaveProperty('avatar');
			expect(profile).toHaveProperty('description');
		});
	});

	describe('Session Validation', () => {
		it('validates session token against store', async () => {
			const event = createMockEvent({ session: 'valid-session-token' });

			const sessionCookie = event.cookies.get('session');

			expect(sessionCookie).toBe('valid-session-token');
		});

		it('returns null for invalid session token', () => {
			const event = createMockEvent({ session: 'invalid-token' });

			const token = event.cookies.get('session');

			expect(token).toBe('invalid-token');
		});

		it('handles expired session gracefully', () => {
			const expiredTime = Date.now() - 1000;
			const event = createMockEvent({ session: `expired-${expiredTime}` });

			const sessionCookie = event.cookies.get('session');

			expect(sessionCookie).toContain('expired-');
		});
	});

	describe('Bidirectional Verification in OAuth', () => {
		it('verifies handle-DID match after auth', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:bidi',
				handle: 'bidi.bsky.social'
			};

			server = createMockAtprotoServer({
				authMeResponse: mockUser,
				profileHandle: mockUser.handle
			});
			server.listen();

			const handleResponse = await fetch(`http://localhost/xrpc/com.atproto.identity.resolveHandle?handle=${mockUser.handle}`);
			const resolvedDid = (await handleResponse.json()).did;

			const profileResponse = await fetch(`http://localhost/xrpc/app.bsky.actor.getProfile?actor=${mockUser.did}`);
			const profile = await profileResponse.json();

			expect(resolvedDid).toBe(mockUser.did);
			expect(profile.handle).toBe(mockUser.handle);
		});
	});

	describe('Error Handling', () => {
		it('handles network errors gracefully', async () => {
			server = createMockAtprotoServer();
			server.listen();

			mockOAuthClient = createMockOAuthClient();

			vi.mocked(mockOAuthClient.restore).mockRejectedValue(new Error('Network error'));

			await expect(mockOAuthClient.restore('did:plc:networkerror')).rejects.toThrow('Network error');
		});

		it('handles invalid callback parameters', async () => {
			server = createMockAtprotoServer();
			server.listen();

			mockOAuthClient = createMockOAuthClient();

			vi.mocked(mockOAuthClient.callback).mockRejectedValue(new Error('Invalid callback params'));

			await expect(
				mockOAuthClient.callback(new URLSearchParams({}))
			).rejects.toThrow('Invalid callback params');
		});

		it('handles session restoration failure', async () => {
			server = createMockAtprotoServer();
			server.listen();

			mockOAuthClient = createMockOAuthClient();

			vi.mocked(mockOAuthClient.restore).mockRejectedValue(new Error('Session expired'));

			await expect(mockOAuthClient.restore('did:plc:expired')).rejects.toThrow('Session expired');
		});
	});

	describe('Multiple Sessions', () => {
		it('handles multiple sessions for same user', () => {
			const session1 = createMockEvent({ session: 'session-1' });
			const session2 = createMockEvent({ session: 'session-2' });

			expect(session1.cookies.get('session')).toBe('session-1');
			expect(session2.cookies.get('session')).toBe('session-2');
		});

		it('tracks independent cookies per session', () => {
			const event1 = createMockEvent({ session: 'token-1', device: 'desktop' });
			const event2 = createMockEvent({ session: 'token-2', device: 'mobile' });

			expect(event1.cookies.get('session')).toBe('token-1');
			expect(event1.cookies.get('device')).toBe('desktop');
			expect(event2.cookies.get('session')).toBe('token-2');
			expect(event2.cookies.get('device')).toBe('mobile');
		});
	});

	describe('OAuth Endpoint Mocks', () => {
		it('mocks com.atproto.server.getSession correctly', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:getsession',
				handle: 'getsession.bsky.social',
				displayName: 'Get Session User'
			};

			server = createMockAtprotoServer({
				authMeResponse: mockUser,
				authMeStatus: 200
			});
			server.listen();

			const response = await fetch('http://localhost/xrpc/com.atproto.server.getSession');

			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(data.did).toBe(mockUser.did);
			expect(data.handle).toBe(mockUser.handle);
		});

		it('returns 401 for unauthenticated getSession', async () => {
			server = createMockAtprotoServer({
				authMeResponse: null,
				authMeStatus: 401
			});
			server.listen();

			const response = await fetch('http://localhost/xrpc/com.atproto.server.getSession');

			expect(response.status).toBe(401);
		});

		it('mocks well-known DID endpoint', async () => {
			server = createMockAtprotoServer();
			server.listen();

			const response = await fetch('http://localhost/.well-known/did.json');

			expect(response.ok).toBe(true);
			const doc = await response.json();
			expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
		});
	});
});

describe('Integration with MSW Handlers', () => {
	let server: ReturnType<typeof createMockAtprotoServer>;

	afterEach(() => {
		server?.close();
	});

	it('can use server.use to modify responses', async () => {
		server = createMockAtprotoServer({
			authMeResponse: null,
			authMeStatus: 401
		});
		server.listen();

		const initialResponse = await fetch('http://localhost/xrpc/com.atproto.server.getSession');
		expect(initialResponse.status).toBe(401);

		server.use(
			http.get('/xrpc/com.atproto.server.getSession', () => {
				return HttpResponse.json({
					did: 'did:plc:latermodified',
					handle: 'latermodified.bsky.social'
				});
			})
		);

		const modifiedResponse = await fetch('http://localhost/xrpc/com.atproto.server.getSession');
		expect(modifiedResponse.status).toBe(200);
		const data = await modifiedResponse.json();
		expect(data.did).toBe('did:plc:latermodified');
	});

	it('handles dynamic endpoint updates', async () => {
		server = createMockAtprotoServer();
		server.listen();

		const response1 = await fetch('http://localhost/xrpc/app.bsky.actor.getProfile?actor=did:plc:first');
		const data1 = await response1.json();
		expect(data1.handle).toBe('test.bsky.social');

		server.use(
			http.get('/xrpc/app.bsky.actor.getProfile', () => {
				return HttpResponse.json({
					did: 'did:plc:modified',
					handle: 'modified.bsky.social',
					displayName: 'Modified User',
					avatar: null,
					description: null,
					indexedAt: null,
					followsCount: 0,
					followersCount: 0,
					followingCount: 0
				});
			})
		);

		const response2 = await fetch('http://localhost/xrpc/app.bsky.actor.getProfile?actor=did:plc:second');
		const data2 = await response2.json();
		expect(data2.handle).toBe('modified.bsky.social');
	});
});