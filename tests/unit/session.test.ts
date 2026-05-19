import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenRefreshError } from '@atproto/oauth-client-node';
import { HmacTokenCodec } from '../../src/server/session/token-codec.js';
import { createSessionManager, SessionManager } from '../../src/server/session/manager.js';

const MOCK_SECRET = 'test-secret-key-for-hmac';

class MockUserSessionStore {
  constructor(private sessions = new Map<string, any>()) {}

  async getByTokenHash(hash: string) {
    return this.sessions.get(hash);
  }

  async create(session: any) {
    this.sessions.set(session.id, session);
  }

  async update(hash: string, updates: Partial<any>) {
    const existing = this.sessions.get(hash);
    if (existing) {
      this.sessions.set(hash, { ...existing, ...updates });
    }
  }

  async delete(hash: string) {
    this.sessions.delete(hash);
  }

  async deleteByDid(did: string) {
    for (const [key, session] of this.sessions.entries()) {
      if (session.did === did) {
        this.sessions.delete(key);
      }
    }
  }
}

describe('TokenCodec', () => {
  let codec: HmacTokenCodec;

  beforeEach(() => {
    codec = new HmacTokenCodec(MOCK_SECRET);
  });

  describe('encode', () => {
    it('should return a token with two parts separated by dot', () => {
      const randomBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
      const token = codec.encode(randomBytes);
      expect(token.split('.').length).toBe(2);
    });

    it('should produce consistent output for same input', () => {
      const randomBytes = new Uint8Array(20);
      randomBytes.fill(1);
      const token1 = codec.encode(randomBytes);
      const token2 = codec.encode(randomBytes);
      expect(token1).toBe(token2);
    });

    it('should produce different output for different inputs', () => {
      const bytes1 = new Uint8Array(20);
      bytes1.fill(1);
      const bytes2 = new Uint8Array(20);
      bytes2.fill(2);
      const token1 = codec.encode(bytes1);
      const token2 = codec.encode(bytes2);
      expect(token1).not.toBe(token2);
    });
  });

  describe('decode', () => {
    it('should decode a valid token and return random and sig parts', () => {
      const randomBytes = new Uint8Array(20);
      crypto.getRandomValues(randomBytes);
      const token = codec.encode(randomBytes);
      const decoded = codec.decode(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.randomPart).toBeDefined();
      expect(decoded?.sigPart).toBeDefined();
    });

    it('should return null for invalid token format', () => {
      expect(codec.decode('invalid')).toBeNull();
      expect(codec.decode('no-dot-here')).toBeNull();
      expect(codec.decode('three.parts.here')).toBeNull();
    });

    it('should return null for tampered token', () => {
      const randomBytes = new Uint8Array(20);
      crypto.getRandomValues(randomBytes);
      const token = codec.encode(randomBytes);
      const [randomPart, sigPart] = token.split('.');
      const tamperedToken = `${randomPart}.${sigPart.slice(0, -1)}x`;
      expect(codec.decode(tamperedToken)).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const randomBytes = new Uint8Array(20);
      crypto.getRandomValues(randomBytes);
      const token = codec.encode(randomBytes);
      const otherCodec = new HmacTokenCodec('different-secret');
      const decoded = otherCodec.decode(token);
      expect(decoded).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(codec.decode('')).toBeNull();
    });
  });

  describe('hash', () => {
    it('should return a hex string', () => {
      const token = 'test.token.here';
      const hash = codec.hash(token);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should return consistent hash for same input', () => {
      const token = 'test.token.here';
      const hash1 = codec.hash(token);
      const hash2 = codec.hash(token);
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different input', () => {
      const hash1 = codec.hash('token1');
      const hash2 = codec.hash('token2');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64 character hex string (SHA256)', () => {
      const hash = codec.hash('any-token');
      expect(hash.length).toBe(64);
    });
  });
});

describe('SessionManager', () => {
  let mockStore: MockUserSessionStore;
  let codec: HmacTokenCodec;
  let manager: SessionManager;
  let mockEvent: any;

  const cookieConfig = {
    name: 'session',
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/'
  };

  const tokenConfig = {
    secret: MOCK_SECRET,
    expiryMs: 30 * 24 * 60 * 60 * 1000,
    renewalThresholdMs: 15 * 24 * 60 * 60 * 1000
  };

  beforeEach(() => {
    mockStore = new MockUserSessionStore();
    codec = new HmacTokenCodec(MOCK_SECRET);
    mockEvent = {
      cookies: {
        get: vi.fn(),
        set: vi.fn()
      }
    };
  });

  describe('validateSession', () => {
    it('should return null session when no cookie present', async () => {
      mockEvent.cookies.get.mockReturnValue(undefined);
      const mockClient = { restore: vi.fn() } as any;
      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      const result = await manager.validateSession(mockEvent);
      expect(result.did).toBeNull();
      expect(result.handle).toBeNull();
    });

    it('should return null session when token is invalid', async () => {
      mockEvent.cookies.get.mockReturnValue('invalid-token');
      const mockClient = { restore: vi.fn() } as any;
      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      const result = await manager.validateSession(mockEvent);
      expect(result.did).toBeNull();
    });

    it('should return null session when session not found in store', async () => {
      mockEvent.cookies.get.mockReturnValue('token-not-in-store');
      const mockClient = { restore: vi.fn() } as any;
      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      const result = await manager.validateSession(mockEvent);
      expect(result.did).toBeNull();
    });

    it('should return authenticated agent when restore succeeds', async () => {
      const mockOAuthSession = {
        did: 'did:plc:test123',
        serviceUrl: 'https://pds.example.com'
      };
      const mockClient = {
        restore: vi.fn().mockResolvedValue(mockOAuthSession)
      };

      const token = codec.encode(new Uint8Array(20).fill(1));
      const tokenHash = codec.hash(token);
      mockStore.sessions.set(tokenHash, {
        id: tokenHash,
        did: 'did:plc:test123',
        handle: 'test.handle',
        email: 'test@example.com',
        serviceUrl: 'https://pds.example.com',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000)
      });
      mockEvent.cookies.get.mockReturnValue(token);

      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      const result = await manager.validateSession(mockEvent);
      expect(result.atpAgent).not.toBeNull();
      expect(result.did).toBe('did:plc:test123');
      expect(result.handle).toBe('test.handle');
    });

    it('should clear session when TokenRefreshError is thrown', async () => {
      const refreshErr = Object.setPrototypeOf(new Error('token refresh'), TokenRefreshError.prototype);
      const mockClient = {
        restore: vi.fn().mockRejectedValue(refreshErr)
      };

      const token = codec.encode(new Uint8Array(20).fill(2));
      const tokenHash = codec.hash(token);
      mockStore.sessions.set(tokenHash, {
        id: tokenHash,
        did: 'did:plc:refresh',
        handle: 'refresh.handle',
        email: 'refresh@example.com',
        serviceUrl: 'https://pds.example.com',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000)
      });
      mockEvent.cookies.get.mockReturnValue(token);

      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      const result = await manager.validateSession(mockEvent);
      expect(result.atpAgent).toBeNull();
      expect(result.did).toBeNull();
      expect(mockStore.sessions.has(tokenHash)).toBe(false);
    });

    it('should return atpAgent: null but preserve session data on non-TokenRefreshError', async () => {
      const mockClient = {
        restore: vi.fn().mockRejectedValue(new Error('Some other error'))
      };

      const token = codec.encode(new Uint8Array(20).fill(3));
      const tokenHash = codec.hash(token);
      mockStore.sessions.set(tokenHash, {
        id: tokenHash,
        did: 'did:plc:other',
        handle: 'other.handle',
        email: 'other@example.com',
        serviceUrl: 'https://pds.example.com',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000)
      });
      mockEvent.cookies.get.mockReturnValue(token);

      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      const result = await manager.validateSession(mockEvent);
      expect(result.atpAgent).toBeNull();
      expect(result.did).toBe('did:plc:other');
      expect(result.handle).toBe('other.handle');
      expect(result.email).toBe('other@example.com');
    });
  });

  describe('createAndSetSession', () => {
    it('should create session and set cookie', async () => {
      const mockClient = { restore: vi.fn() } as any;
      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      await manager.createAndSetSession(
        mockEvent,
        'did:plc:test123',
        'test.handle',
        'test@example.com',
        'https://pds.example.com'
      );

      expect(mockEvent.cookies.set).toHaveBeenCalledWith(
        'session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          path: '/',
          secure: true,
          sameSite: 'lax'
        })
      );
    });

    it('should store session with correct data', async () => {
      const mockClient = { restore: vi.fn() } as any;
      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      const session = await manager.createAndSetSession(
        mockEvent,
        'did:plc:test123',
        'test.handle',
        'test@example.com',
        'https://pds.example.com'
      );

      expect(session.did).toBe('did:plc:test123');
      expect(session.handle).toBe('test.handle');
      expect(session.email).toBe('test@example.com');
      expect(session.serviceUrl).toBe('https://pds.example.com');
    });
  });

  describe('deleteSession', () => {
    it('should delete cookie when no token present', async () => {
      mockEvent.cookies.get.mockReturnValue(undefined);
      const mockClient = { restore: vi.fn() } as any;
      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      await manager.deleteSession(mockEvent);

      expect(mockEvent.cookies.set).toHaveBeenCalledWith(
        'session',
        '',
        expect.objectContaining({ maxAge: 0 })
      );
    });

    it('should delete session from store and cookie', async () => {
      const randomBytes = new Uint8Array(20);
      crypto.getRandomValues(randomBytes);
      const token = codec.encode(randomBytes);
      const tokenHash = codec.hash(token);

      mockStore.sessions.set(tokenHash, {
        id: tokenHash,
        did: 'did:plc:test',
        handle: 'test.handle',
        email: 'test@example.com',
        serviceUrl: 'https://pds.example.com',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000)
      });

      mockEvent.cookies.get.mockReturnValue(token);
      const mockClient = { restore: vi.fn() } as any;
      manager = new SessionManager({
        oauthClient: mockClient,
        userCodec: codec,
        tokenConfig,
        cookieConfig,
        userStore: mockStore
      });

      await manager.deleteSession(mockEvent);

      expect(mockStore.sessions.has(tokenHash)).toBe(false);
    });
  });
});
