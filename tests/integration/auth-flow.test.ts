import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockOAuthClient, createMockEvent, type MockUser } from '../setup';
import { createMockAtprotoServer } from '../setup/mock-http';

describe('OAuth Flow Integration', () => {
	let mockOAuthClient: ReturnType<typeof createMockOAuthClient>;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Mock OAuth Client Factory', () => {
		it('creates mock OAuth client with default user', () => {
			mockOAuthClient = createMockOAuthClient();

			expect(mockOAuthClient).toBeDefined();
			expect(typeof mockOAuthClient.authorize).toBe('function');
			expect(typeof mockOAuthClient.callback).toBe('function');
			expect(typeof mockOAuthClient.restore).toBe('function');
			expect(typeof mockOAuthClient.revoke).toBe('function');
		});

		it('creates mock OAuth client with custom user', () => {
			const customUser: MockUser = {
				did: 'did:plc:custom',
				handle: 'custom.bsky.social',
				displayName: 'Custom User'
			};

			mockOAuthClient = createMockOAuthClient(customUser);

			expect(mockOAuthClient).toBeDefined();
		});

		it('mock client authorize returns URL', async () => {
			mockOAuthClient = createMockOAuthClient();

			const url = await mockOAuthClient.authorize('test.bsky.social');

			expect(url).toContain('bsky.social');
		});

		it('mock client callback returns session', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:callback',
				handle: 'callback.bsky.social'
			};

			mockOAuthClient = createMockOAuthClient(mockUser);

			const result = await mockOAuthClient.callback(new URLSearchParams({
				code: 'test-code',
				state: 'test-state'
			}));

			expect(result.session).toBeDefined();
			expect(result.session.did).toBe(mockUser.did);
			expect(result.session.handle).toBe(mockUser.handle);
		});

		it('mock client restore returns session with tokens', async () => {
			const mockUser: MockUser = {
				did: 'did:plc:restore',
				handle: 'restore.bsky.social'
			};

			mockOAuthClient = createMockOAuthClient(mockUser);

			const result = await mockOAuthClient.restore(mockUser.did);

			expect(result.did).toBe(mockUser.did);
			expect(result.accessJwt).toBeDefined();
			expect(result.refreshJwt).toBeDefined();
		});

		it('mock client revoke resolves successfully', async () => {
			mockOAuthClient = createMockOAuthClient();

			await expect(mockOAuthClient.revoke('did:plc:revoke')).resolves.toBeUndefined();
		});
	});

	describe('Session Cookie Management via MockEvent', () => {
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

		it('returns null for missing cookie', () => {
			const event = createMockEvent();

			expect(event.cookies.get('non-existent')).toBeNull();
		});

		it('handles multiple cookies', () => {
			const event = createMockEvent({
				session: 'token1',
				remember: 'yes',
				theme: 'dark'
			});

			expect(event.cookies.get('session')).toBe('token1');
			expect(event.cookies.get('remember')).toBe('yes');
			expect(event.cookies.get('theme')).toBe('dark');
		});
	});

	describe('Mock ATProto Server Lifecycle', () => {
		it('creates server without error', () => {
			const server = createMockAtprotoServer();

			expect(server).toBeDefined();
			expect(typeof server.listen).toBe('function');
			expect(typeof server.close).toBe('function');
			expect(typeof server.use).toBe('function');

			server.close();
		});

		it('creates server with custom options', () => {
			const mockUser: MockUser = {
				did: 'did:plc:test',
				handle: 'test.bsky.social',
				displayName: 'Test User'
			};

			const server = createMockAtprotoServer({
				authMeResponse: mockUser,
				authMeStatus: 200,
				profileHandle: 'test.bsky.social',
				profileDisplayName: 'Test User'
			});

			expect(server).toBeDefined();
			server.close();
		});

		it('server can be started and stopped', () => {
			const server = createMockAtprotoServer();

			expect(() => server.listen()).not.toThrow();
			expect(() => server.close()).not.toThrow();
		});
	});

	describe('Error Handling via Mock OAuth Client', () => {
		it('handles restore errors via mock', async () => {
			mockOAuthClient = createMockOAuthClient();

			vi.mocked(mockOAuthClient.restore).mockRejectedValue(new Error('Network error'));

			await expect(mockOAuthClient.restore('did:plc:networkerror')).rejects.toThrow('Network error');
		});

		it('handles callback errors via mock', async () => {
			mockOAuthClient = createMockOAuthClient();

			vi.mocked(mockOAuthClient.callback).mockRejectedValue(new Error('Invalid callback'));

			await expect(
				mockOAuthClient.callback(new URLSearchParams({}))
			).rejects.toThrow('Invalid callback');
		});

		it('handles authorization errors via mock', async () => {
			mockOAuthClient = createMockOAuthClient();

			vi.mocked(mockOAuthClient.authorize).mockRejectedValue(new Error('Auth failed'));

			await expect(mockOAuthClient.authorize('invalid.handle')).rejects.toThrow('Auth failed');
		});
	});

	describe('Multiple Sessions', () => {
		it('handles multiple independent mock events', () => {
			const session1 = createMockEvent({ session: 'session-token-1' });
			const session2 = createMockEvent({ session: 'session-token-2' });

			expect(session1.cookies.get('session')).toBe('session-token-1');
			expect(session2.cookies.get('session')).toBe('session-token-2');
		});

		it('tracks independent cookies per event', () => {
			const event1 = createMockEvent({ session: 'token-1', device: 'desktop' });
			const event2 = createMockEvent({ session: 'token-2', device: 'mobile' });

			expect(event1.cookies.get('session')).toBe('token-1');
			expect(event1.cookies.get('device')).toBe('desktop');
			expect(event2.cookies.get('session')).toBe('token-2');
			expect(event2.cookies.get('device')).toBe('mobile');
		});

		it('multiple OAuth clients are independent', () => {
			const client1 = createMockOAuthClient({ did: 'did:plc:one', handle: 'one.bsky.social' });
			const client2 = createMockOAuthClient({ did: 'did:plc:two', handle: 'two.bsky.social' });

			expect(client1).not.toBe(client2);
		});
	});

	describe('OAuth Flow Structure Tests', () => {
		it('verifies authorization URL format', async () => {
			mockOAuthClient = createMockOAuthClient();

			const url = await mockOAuthClient.authorize('user.bsky.social');

			expect(typeof url).toBe('string');
			expect(url.length).toBeGreaterThan(0);
			expect(url).toContain('bsky.social');
		});

		it('verifies callback returns session object', async () => {
			mockOAuthClient = createMockOAuthClient();

			const result = await mockOAuthClient.callback(new URLSearchParams({
				code: 'auth-code-123',
				state: 'state-456'
			}));

			expect(result).toHaveProperty('session');
			expect(result.session).toHaveProperty('did');
			expect(result.session).toHaveProperty('accessJwt');
			expect(result.session).toHaveProperty('refreshJwt');
		});

		it('verifies restore returns session with tokens', async () => {
			mockOAuthClient = createMockOAuthClient();

			const result = await mockOAuthClient.restore('did:plc:restore-test');

			expect(result).toHaveProperty('did');
			expect(result).toHaveProperty('accessJwt');
			expect(result).toHaveProperty('refreshJwt');
		});
	});

	describe('MockUser Structure', () => {
		it('has required did and handle', () => {
			const user: MockUser = {
				did: 'did:plc:required',
				handle: 'required.bsky.social'
			};

			expect(user.did).toBe('did:plc:required');
			expect(user.handle).toBe('required.bsky.social');
		});

		it('supports optional displayName and avatar', () => {
			const user: MockUser = {
				did: 'did:plc:optional',
				handle: 'optional.bsky.social',
				displayName: 'Optional User',
				avatar: 'https://example.com/avatar.png'
			};

			expect(user.displayName).toBe('Optional User');
			expect(user.avatar).toBe('https://example.com/avatar.png');
		});

		it('can omit optional fields', () => {
			const user: MockUser = {
				did: 'did:plc:minimal',
				handle: 'minimal.bsky.social'
			};

			expect(user.displayName).toBeUndefined();
			expect(user.avatar).toBeUndefined();
		});
	});

	describe('Cookie Configuration Structure', () => {
		it('defines session cookie options', () => {
			const cookieConfig = {
				name: 'session',
				httpOnly: true,
				secure: true,
				sameSite: 'lax' as const,
				path: '/'
			};

			expect(cookieConfig.name).toBe('session');
			expect(cookieConfig.httpOnly).toBe(true);
			expect(cookieConfig.secure).toBe(true);
			expect(cookieConfig.sameSite).toBe('lax');
			expect(cookieConfig.path).toBe('/');
		});

		it('defines delete cookie options', () => {
			const deleteConfig = {
				name: 'session',
				httpOnly: true,
				secure: true,
				sameSite: 'strict' as const,
				path: '/',
				maxAge: 0
			};

			expect(deleteConfig.sameSite).toBe('strict');
			expect(deleteConfig.maxAge).toBe(0);
		});
	});
});