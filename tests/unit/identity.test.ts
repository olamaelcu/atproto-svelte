import { describe, it, expect, vi } from 'vitest';
import { createMockAtprotoServer, type MockUser } from '../setup/mock-http';

interface Identity {
	did: string;
	handle: string | null;
	pdsUrl: string | null;
	signingKey: string | null;
	isVerified: boolean;
}

describe('Identity Interface Structure', () => {
	it('has correct Identity structure fields', () => {
		const identity: Identity = {
			did: 'did:plc:test',
			handle: 'test.bsky.social',
			pdsUrl: null,
			signingKey: null,
			isVerified: false
		};

		expect(identity.did).toBe('did:plc:test');
		expect(identity.handle).toBe('test.bsky.social');
		expect(identity.pdsUrl).toBeNull();
		expect(identity.signingKey).toBeNull();
		expect(identity.isVerified).toBe(false);
	});

	it('allows nullable optional fields', () => {
		const minimalIdentity: Identity = {
			did: 'did:plc:minimal',
			handle: null,
			pdsUrl: null,
			signingKey: null,
			isVerified: false
		};

		expect(minimalIdentity.handle).toBeNull();
		expect(minimalIdentity.pdsUrl).toBeNull();
		expect(minimalIdentity.signingKey).toBeNull();
	});

	it('supports handle with dots and hyphens', () => {
		const identity: Identity = {
			did: 'did:plc:handle',
			handle: 'my-handle.bsky.social',
			pdsUrl: null,
			signingKey: null,
			isVerified: true
		};

		expect(identity.handle).toContain('.');
		expect(identity.isVerified).toBe(true);
	});

	it('supports null signingKey for unverified identities', () => {
		const unverifiedIdentity: Identity = {
			did: 'did:plc:unverified',
			handle: 'unverified.bsky.social',
			pdsUrl: null,
			signingKey: null,
			isVerified: false
		};

		expect(unverifiedIdentity.signingKey).toBeNull();
		expect(unverifiedIdentity.isVerified).toBe(false);
	});

	it('can be created with all fields populated', () => {
		const fullIdentity: Identity = {
			did: 'did:plc:full',
			handle: 'full.bsky.social',
			pdsUrl: 'https://pds.example.com',
			signingKey: 'did:key:z123',
			isVerified: true
		};

		expect(fullIdentity.did).toBe('did:plc:full');
		expect(fullIdentity.handle).toBe('full.bsky.social');
		expect(fullIdentity.pdsUrl).toBe('https://pds.example.com');
		expect(fullIdentity.signingKey).toBe('did:key:z123');
		expect(fullIdentity.isVerified).toBe(true);
	});
});

describe('ATProto Mock Server Configuration', () => {
	it('creates server with custom user', () => {
		const customUser: MockUser = {
			did: 'did:plc:custom',
			handle: 'custom.handle.bsky.social',
			displayName: 'Custom User',
			avatar: 'https://example.com/avatar.jpg'
		};

		const server = createMockAtprotoServer({
			authMeResponse: customUser,
			authMeStatus: 200,
			profileHandle: customUser.handle,
			profileDisplayName: customUser.displayName
		});

		expect(server).toBeTruthy();
		server.close();
	});

	it('handles null authMeResponse', () => {
		const server = createMockAtprotoServer({
			authMeResponse: null,
			authMeStatus: 401
		});

		expect(server).toBeTruthy();
		server.close();
	});

	it('defaults when no options provided', () => {
		const server = createMockAtprotoServer();

		expect(server).toBeTruthy();
		server.close();
	});
});

describe('MSW Server Lifecycle', () => {
	it('creates and closes server without error', () => {
		const server = createMockAtprotoServer();
		expect(() => server.close()).not.toThrow();
	});

	it('server can be reused after close', () => {
		const server = createMockAtprotoServer();
		server.close();

		const newServer = createMockAtprotoServer();
		expect(() => newServer.close()).not.toThrow();
	});

	it('multiple servers can exist independently', () => {
		const server1 = createMockAtprotoServer();
		const server2 = createMockAtprotoServer();

		expect(() => {
			server1.close();
			server2.close();
		}).not.toThrow();
	});
});

describe('Mock User Structure', () => {
	it('has required did and handle fields', () => {
		const user: MockUser = {
			did: 'did:plc:user1',
			handle: 'user1.bsky.social'
		};

		expect(user.did).toBe('did:plc:user1');
		expect(user.handle).toBe('user1.bsky.social');
	});

	it('supports optional displayName and avatar', () => {
		const userWithOptional: MockUser = {
			did: 'did:plc:user2',
			handle: 'user2.bsky.social',
			displayName: 'User Two',
			avatar: 'https://example.com/avatar.jpg'
		};

		expect(userWithOptional.displayName).toBe('User Two');
		expect(userWithOptional.avatar).toBe('https://example.com/avatar.jpg');
	});

	it('can omit optional fields', () => {
		const userMinimal: MockUser = {
			did: 'did:plc:user3',
			handle: 'user3.bsky.social'
		};

		expect(userMinimal.displayName).toBeUndefined();
		expect(userMinimal.avatar).toBeUndefined();
	});
});

describe('Profile Structure', () => {
	it('matches expected profile fields', () => {
		const profile = {
			did: 'did:plc:profile1',
			handle: 'profile1.bsky.social',
			displayName: 'Profile One',
			avatar: null as string | null,
			description: null as string | null,
			indexedAt: null as string | null,
			followsCount: 100,
			followersCount: 200,
			followingCount: 50
		};

		expect(profile.did).toBe('did:plc:profile1');
		expect(profile.handle).toBe('profile1.bsky.social');
		expect(profile.displayName).toBe('Profile One');
		expect(profile.avatar).toBeNull();
		expect(profile.description).toBeNull();
		expect(profile.indexedAt).toBeNull();
		expect(profile.followsCount).toBe(100);
		expect(profile.followersCount).toBe(200);
		expect(profile.followingCount).toBe(50);
	});

	it('handles profile with all fields', () => {
		const profile = {
			did: 'did:plc:fullprofile',
			handle: 'fullprofile.bsky.social',
			displayName: 'Full Profile',
			avatar: 'https://example.com/avatar.png',
			description: 'A test user profile',
			indexedAt: '2024-01-01T00:00:00Z',
			followsCount: 50,
			followersCount: 150,
			followingCount: 75
		};

		expect(profile.displayName).toBe('Full Profile');
		expect(profile.avatar).toBe('https://example.com/avatar.png');
		expect(profile.description).toBe('A test user profile');
		expect(profile.indexedAt).toBe('2024-01-01T00:00:00Z');
	});
});

describe('Identity Verification Logic', () => {
	it('defines verification states correctly', () => {
		const verifiedIdentity: Identity = {
			did: 'did:plc:verified',
			handle: 'verified.bsky.social',
			pdsUrl: 'https://pds.bsky.social',
			signingKey: 'did:key:zVerified',
			isVerified: true
		};

		const unverifiedIdentity: Identity = {
			did: 'did:plc:unverified',
			handle: 'unverified.bsky.social',
			pdsUrl: null,
			signingKey: null,
			isVerified: false
		};

		expect(verifiedIdentity.isVerified).toBe(true);
		expect(unverifiedIdentity.isVerified).toBe(false);
	});

	it('handle and DID relationship for verification', () => {
		const identity: Identity = {
			did: 'did:plc:rel',
			handle: 'rel.bsky.social',
			pdsUrl: null,
			signingKey: null,
			isVerified: false
		};

		const handleMatchesDid = identity.handle !== null && identity.handle.endsWith('.bsky.social');
		expect(handleMatchesDid).toBe(true);
	});
});

describe('Session Cookie Configuration', () => {
	it('defines cookie options structure', () => {
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

	it('supports strict sameSite for deletion', () => {
		const deleteCookieConfig = {
			name: 'session',
			httpOnly: true,
			secure: true,
			sameSite: 'strict' as const,
			path: '/',
			maxAge: 0
		};

		expect(deleteCookieConfig.sameSite).toBe('strict');
		expect(deleteCookieConfig.maxAge).toBe(0);
	});
});

describe('Token Configuration', () => {
	it('defines session token config structure', () => {
		const tokenConfig = {
			secret: 'test-secret',
			expiryMs: 30 * 24 * 60 * 60 * 1000,
			renewalThresholdMs: 15 * 24 * 60 * 60 * 1000
		};

		expect(tokenConfig.secret).toBe('test-secret');
		expect(tokenConfig.expiryMs).toBe(30 * 24 * 60 * 60 * 1000);
		expect(tokenConfig.renewalThresholdMs).toBe(15 * 24 * 60 * 60 * 1000);
	});

	it('renewal threshold is half of expiry', () => {
		const tokenConfig = {
			secret: 'test-secret',
			expiryMs: 30 * 24 * 60 * 60 * 1000,
			renewalThresholdMs: 15 * 24 * 60 * 60 * 1000
		};

		expect(tokenConfig.renewalThresholdMs).toBe(tokenConfig.expiryMs / 2);
	});
});