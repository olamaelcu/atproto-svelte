import { createHmac, createHash, randomBytes } from 'crypto';
import { encodeBase32UpperCaseNoPadding, decodeBase32IgnorePadding } from '@oslojs/encoding';
import type { Agent } from '@atproto/api';
import type { NodeOAuthClient, OAuthSession } from '@atproto/oauth-client-node';
import { TOKEN_RANDOM_BYTES_LENGTH } from './constants.js';

/**
 * Configuration for the OAuth client environment.
 *
 * @remarks
 * This interface defines all configuration needed to set up the OAuth client
 * for ATProto authentication. It includes domain configuration, client metadata,
 * and optional developer-specific settings.
 *
 * @example
 * ```ts
 * const config: OAuthEnvironmentConfig = {
 *   oauthDomain: 'bsky.app',
 *   oauthClientName: 'My App',
 *   oauthScopes: 'atproto email',
 *   pdsUrl: 'https://bsky.social',
 *   isDev: false
 * };
 * ```
 */
export interface OAuthEnvironmentConfig {
  /** The OAuth domain (e.g., 'bsky.app') used as the auth server. */
  oauthDomain: string;
  /** Human-readable name for the OAuth client. */
  oauthClientName: string;
  /** Space-separated list of OAuth scopes to request. */
  oauthScopes: string;
  /**
   * JWK or array of JWKs for confidential client authentication.
   * If undefined, the client runs in public mode (no client authentication).
   */
  oauthJwk?: string | string[];
  /** URI for the Terms of Service document. */
  oauthTosUri?: string;
  /** URI for the Privacy Policy document. */
  oauthPolicyUri?: string;
  /** URL of the Personal Data Server (PDS). */
  pdsUrl: string;
  /** Whether to run in development mode with localhost URLs. */
  isDev: boolean;
  /** Custom host for development OAuth callback (defaults to 127.0.0.1). */
  devHost?: string;
  /** Custom port for development OAuth callback (defaults to 5180). */
  devPort?: number;
  /** Fallback DID to use if resolution fails during development. */
  fallbackDid?: string;
  /** Fallback domain for development fallback resolution. */
  fallbackDomain?: string;
}

/**
 * Storage interface for OAuth authorization state.
 *
 * @remarks
 * Implement this interface to provide persistent storage for OAuth state
 * during the authorization flow. State is temporary and should be deleted
 * after the callback is processed.
 *
 * @example
 * ```ts
 * const stateStore: OAuthStateStore = {
 *   async get(key) { return await redis.get(`oauth:state:${key}`); },
 *   async set(key, value) { await redis.set(`oauth:state:${key}`, value); },
 *   async del(key) { await redis.del(`oauth:state:${key}`); }
 * };
 * ```
 */
export interface OAuthStateStore {
  /** Retrieve OAuth state by key. Returns undefined if not found. */
  get(key: string): Promise<Uint8Array | undefined>;
  /** Store OAuth state. Value should be persisted until deleted. */
  set(key: string, value: Uint8Array): Promise<void>;
  /** Delete OAuth state by key. */
  del(key: string): Promise<void>;
}

/**
 * Storage interface for OAuth sessions.
 *
 * @remarks
 * Implement this interface to provide persistent storage for OAuth sessions.
 * Sessions contain the authenticated user's tokens and should persist
 * across requests to enable session restoration.
 */
export interface OAuthSessionStore {
  /** Retrieve OAuth session by key. Returns undefined if not found or expired. */
  get(key: string): Promise<NodeSavedSession | undefined>;
  /** Store OAuth session. Should persist until explicitly deleted. */
  set(key: string, session: NodeSavedSession): Promise<void>;
  /** Delete OAuth session by key. */
  del(key: string): Promise<void>;
}

/**
 * Storage interface for PDS service URLs.
 *
 * @remarks
 * Implement this interface to cache PDS URLs per DID, reducing
 * PLC directory lookups for frequently accessed identities.
 */
export interface ServiceUrlStore {
  /** Get cached service URL for a DID. */
  getServiceUrl(key: string): Promise<string | undefined>;
  /** Cache a service URL for a DID. */
  setServiceUrl(key: string, url: string): Promise<void>;
  /** Atomically get and delete a service URL (for cleanup). */
  takeServiceUrl(key: string): Promise<string | undefined>;
}

/**
 * Storage interface for application-level user sessions.
 *
 * @remarks
 * Implement this interface to provide persistent storage for user sessions.
 * These sessions are separate from OAuth sessions and contain app-specific
 * user data like email, handle, and session expiry information.
 *
 * @example
 * ```ts
 * const userStore: UserSessionStore = {
 *   async getByTokenHash(hash) { return await db.sessions.findOne({ hash }); },
 *   async create(session) { await db.sessions.insert(session); },
 *   async update(hash, updates) { await db.sessions.updateOne({ hash }, updates); },
 *   async delete(hash) { await db.sessions.deleteOne({ hash }); },
 *   async deleteByDid(did) { await db.sessions.deleteMany({ did }); }
 * };
 * ```
 */
export interface UserSessionStore {
  /** Look up session by token hash. Returns undefined if not found or expired. */
  getByTokenHash(hash: string): Promise<UserSession | undefined>;
  /** Create a new user session. */
  create(session: UserSession): Promise<void>;
  /** Update specific fields of an existing session. */
  update(hash: string, updates: Partial<UserSession>): Promise<void>;
  /** Delete a session by its token hash. */
  delete(hash: string): Promise<void>;
  /** Delete all sessions for a specific DID (e.g., on logout everywhere). */
  deleteByDid(did: string): Promise<void>;
}

/**
 * Application-level user session data.
 *
 * @remarks
 * This represents the local session associated with a user, stored
 * separately from the OAuth session. Contains user-identifying information
 * and session metadata like expiry times.
 */
export interface UserSession {
  /** Unique session ID (derived from token hash). */
  id: string;
  /** The user's DID. */
  did: string;
  /** The user's handle at time of session creation. */
  handle: string;
  /** The user's email, if collected. */
  email: string | null;
  /** Cached PDS URL, or null if should be fetched from PLC. */
  serviceUrl: string | null;
  /** When the session was created. */
  createdAt: Date;
  /** When the session expires. */
  expiresAt: Date;
}

/**
 * Result of session validation.
 *
 * @remarks
 * Returned by SessionManager.validateSession() containing the validated
 * session data or null values if validation failed.
 */
export interface ValidatedSession {
  /** ATProto Agent instance for API calls, or null if not authenticated. */
  atpAgent: Agent | null;
  /** User's DID, or null if not authenticated. */
  did: string | null;
  /** User's handle, or null if not authenticated. */
  handle: string | null;
  /** User's email, or null if not collected. */
  email: string | null;
  /** PDS URL for the user's server, or null if unknown. */
  serviceUrl: string | null;
}

/**
 * Configuration for session token encoding and validation.
 *
 * @remarks
 * Defines the secret key and timing parameters for HMAC-signed session tokens.
 */
export interface SessionTokenConfig {
  /** Secret key for HMAC-SHA256 signing. */
  secret: string;
  /** Token validity duration in milliseconds. */
  expiryMs: number;
  /** How long before expiry to trigger token renewal in milliseconds. */
  renewalThresholdMs: number;
}

/**
 * Configuration for session cookies.
 *
 * @remarks
 * Defines cookie settings for storing the session token in the browser.
 */
export interface CookieConfig {
  /** Cookie name. */
  name: string;
  /** Whether the cookie is HTTP-only (not accessible from JavaScript). */
  httpOnly: boolean;
  /** Whether the cookie requires HTTPS. */
  secure: boolean;
  /** SameSite attribute value. */
  sameSite: 'lax' | 'strict' | 'none';
  /** Cookie path. */
  path: string;
}

/**
 * Full configuration for SessionManager.
 *
 * @remarks
 * This interface aggregates all dependencies and configuration needed to
 * run the SessionManager, including the OAuth client, codec, and stores.
 */
export interface SessionManagerConfig {
  /** The OAuth client instance for session restoration. */
  oauthClient: NodeOAuthClient;
  /** The token codec for encoding/decoding session tokens. */
  userCodec: TokenCodec;
  /** Token timing and secret configuration. */
  tokenConfig: SessionTokenConfig;
  /** Cookie settings for the session token cookie. */
  cookieConfig: CookieConfig;
  /** The user session storage backend. */
  userStore: UserSessionStore;
  /**
   * Optional function to get service URL for a DID.
   * If not provided, serviceUrl must be stored with the session.
   */
  getServiceUrl?: (did: string) => Promise<string | undefined>;
}

/**
 * HMAC-SHA256 based session token codec.
 *
 * @remarks
 * This codec generates tokens with two parts:
 * - A random 20-byte component (base32 encoded)
 * - An HMAC-SHA256 signature of the random part
 *
 * The signature is verified using constant-time comparison to prevent timing attacks.
 *
 * @example
 * ```ts
 * const codec = new TokenCodec('your-secret-key');
 * const token = codec.encode(); // Generates new random token
 * const decoded = codec.decode(token); // Returns { randomPart, sigPart } or null if invalid
 * const hash = codec.hash(token); // For storing in database
 * ```
 */
export class TokenCodec {
  private readonly secret: string;

  /**
   * Create a new TokenCodec with the given secret.
   * @param secret - Secret key for HMAC signing
   */
  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Encode random bytes into a signed token string.
   *
   * @param randomBytes_ - Random bytes to encode (defaults to 20 random bytes)
   * @returns A token string in format "base32.randomPart.base32.sigPart"
   */
  encode(randomBytes_: Uint8Array = randomBytes(TOKEN_RANDOM_BYTES_LENGTH)): string {
    const randomPart = encodeBase32UpperCaseNoPadding(randomBytes_);
    const sig = createHmac('sha256', this.secret).update(randomBytes_).digest();
    const sigPart = encodeBase32UpperCaseNoPadding(sig);
    return `${randomPart}.${sigPart}`;
  }

  /**
   * Decode and verify a token string.
   *
   * @param token - The token string to decode
   * @returns The decoded parts if valid, null if invalid or tampered
   */
  decode(token: string): { randomPart: string; sigPart: string } | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [randomPart, sigPart] = parts;
    let randomBytes_: Uint8Array;
    let actualSig: Uint8Array;
    try {
      randomBytes_ = decodeBase32IgnorePadding(randomPart);
      actualSig = decodeBase32IgnorePadding(sigPart);
    } catch {
      return null;
    }

    const expectedSig = createHmac('sha256', this.secret).update(randomBytes_).digest();

    if (expectedSig.length !== actualSig.length) return null;

    let diff = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      diff |= expectedSig[i] ^ actualSig[i];
    }

    if (diff !== 0) return null;

    return { randomPart, sigPart };
  }

  /**
   * Hash a token for storage in database.
   *
   * @param token - The full token string
   * @returns SHA256 hash of the token as hex string
   */
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

/**
 * Options for creating an OAuth client.
 *
 * @remarks
 * Passed to createOAuthClient() to configure the OAuth client with
 * the necessary storage backends.
 */
export interface CreateOAuthClientOptions {
  /** Storage for OAuth authorization state during the flow. */
  stateStore: OAuthStateStore;
  /** Storage for OAuth sessions after authentication. */
  sessionStore: OAuthSessionStore;
  /** Optional storage for caching PDS URLs per DID. */
  serviceUrlStore?: ServiceUrlStore;
}

/**
 * Result of creating an OAuth client.
 *
 * @remarks
 * Contains the OAuth client instance and a restore function for
 * reestablishing sessions after server restart.
 */
export interface CreateOAuthClientResult {
  /** The configured OAuth client. */
  client: NodeOAuthClient;
  /**
   * Restore an OAuth session by DID.
   * @param did - The user's DID
   * @returns The restored OAuth session
   * @throws If the session cannot be restored
   */
  restore: (did: string) => Promise<OAuthSession>;
}

export type NodeSavedState = import('@atproto/oauth-client-node').NodeSavedState;
export type NodeSavedSession = import('@atproto/oauth-client-node').NodeSavedSession;