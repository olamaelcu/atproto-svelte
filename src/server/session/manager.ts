import type {
  SessionManagerConfig,
  ValidatedSession,
  TokenCodec,
  UserSessionStore,
  UserSession,
  CookieConfig
} from '../types.js';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import { TokenRefreshError } from '@atproto/oauth-client';
import type { RequestEvent } from '@sveltejs/kit';
import { TOKEN_RANDOM_BYTES_LENGTH } from '../constants.js';

/**
 * Create a new SessionManager instance.
 *
 * @param config - Configuration for the session manager
 * @returns A new SessionManager instance
 *
 * @example
 * ```ts
 * const manager = createSessionManager({
 *   oauthClient,
 *   userCodec: new TokenCodec(secret),
 *   tokenConfig: { secret, expiryMs: 86400000, renewalThresholdMs: 3600000 },
 *   cookieConfig: { name: 'session', httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
 *   userStore
 * });
 * ```
 */
export function createSessionManager(config: SessionManagerConfig) {
  return new SessionManager(config);
}

const NULL_SESSION: ValidatedSession = {
  atpAgent: null,
  did: null,
  handle: null,
  email: null,
  serviceUrl: null
};

/**
 * Manages user sessions with cookie-based token storage.
 *
 * @remarks
 * SessionManager handles the full lifecycle of user sessions:
 * - Validates existing session tokens from cookies
 * - Creates new sessions after OAuth flow completes
 * - Deletes sessions (logout)
 * - Restores OAuth sessions for API calls
 *
 * Tokens are HMAC-signed and stored in cookies. The SessionManager
 * delegates OAuth operations to the NodeOAuthClient and uses a
 * UserSessionStore for persistence.
 *
 * @example
 * ```ts
 * const manager = createSessionManager(config);
 *
 * // Validate on each request
 * const session = await manager.validateSession(event);
 * if (!session.did) {
 *   // Not authenticated
 * }
 *
 * // Create session after OAuth callback
 * await manager.createAndSetSession(event, did, handle, email, serviceUrl);
 *
 * // Logout
 * await manager.deleteSession(event);
 * ```
 */
export class SessionManager {
  private readonly oauthClient: NodeOAuthClient;
  private readonly userCodec: TokenCodec;
  private readonly tokenConfig: { secret: string; expiryMs: number; renewalThresholdMs: number };
  private readonly cookieConfig: CookieConfig;
  private readonly userStore: UserSessionStore;
  private readonly getServiceUrl?: (did: string) => Promise<string | undefined>;

  /**
   * Create a new SessionManager.
   * @param config - Configuration with OAuth client, codec, stores, and cookie settings
   */
  constructor(config: SessionManagerConfig) {
    this.oauthClient = config.oauthClient;
    this.userCodec = config.userCodec;
    this.tokenConfig = config.tokenConfig;
    this.cookieConfig = config.cookieConfig;
    this.userStore = config.userStore;
    this.getServiceUrl = config.getServiceUrl;
  }

  /**
   * Validate the session from the request cookie.
   *
   * @param event - The SvelteKit request event
   * @returns Validated session data, or null values if invalid/missing
   *
   * @remarks
   * This method:
   * 1. Extracts token from cookie
   * 2. Verifies HMAC signature
   * 3. Looks up session by token hash
   * 4. Checks expiry
   * 5. Attempts OAuth session restoration (may fail due to revocation)
   *
   * If validation fails at any step, returns null values. Token refresh
   * errors cause session deletion.
   */
  async validateSession(event: RequestEvent): Promise<ValidatedSession> {
    const token = event.cookies.get(this.cookieConfig.name);
    if (!token) return { ...NULL_SESSION };

    const decoded = this.userCodec.decode(token);
    if (!decoded) {
      await this.deleteSession(event);
      return { ...NULL_SESSION };
    }

    const tokenHash = this.userCodec.hash(token);
    const session = await this.userStore.getByTokenHash(tokenHash);
    if (!session) return { ...NULL_SESSION };

    if (Date.now() >= session.expiresAt.getTime()) {
      await this.userStore.delete(tokenHash);
      return { ...NULL_SESSION };
    }

    let serviceUrl: string | null = session.serviceUrl;
    if (!serviceUrl && this.getServiceUrl) {
      serviceUrl = (await this.getServiceUrl(session.did)) ?? null;
    }

    try {
      // Session restoration validates the session is still valid
      await this.oauthClient.restore(session.did);
      const pdsUrl = serviceUrl ?? session.serviceUrl;
      if (!pdsUrl) {
        return { ...NULL_SESSION };
      }
      const agent = new Agent(pdsUrl);
      return {
        atpAgent: agent,
        did: session.did,
        handle: session.handle,
        email: session.email,
        serviceUrl
      };
    } catch (err) {
      if (err instanceof TokenRefreshError) {
        await this.userStore.deleteByDid(session.did);
        return { ...NULL_SESSION };
      }
      return {
        atpAgent: null,
        did: session.did,
        handle: session.handle,
        email: session.email,
        serviceUrl
      };
    }
  }

  /**
   * Create a new session and set the cookie.
   *
   * @param event - The SvelteKit request event
   * @param did - User's DID
   * @param handle - User's handle
   * @param email - User's email (or null)
   * @param serviceUrl - PDS URL (or null to fetch later)
   * @returns The created UserSession
   *
   * @remarks
   * Generates a new random token, stores the session, and sets the cookie.
   * The token is valid for the configured duration.
   */
  async createAndSetSession(
    event: RequestEvent,
    did: string,
    handle: string,
    email: string | null,
    serviceUrl: string | null
  ): Promise<UserSession> {
    const randomBytes_ = new Uint8Array(TOKEN_RANDOM_BYTES_LENGTH);
    crypto.getRandomValues(randomBytes_);
    const token = this.userCodec.encode(randomBytes_);
    const tokenHash = this.userCodec.hash(token);
    const expiresAt = new Date(Date.now() + this.tokenConfig.expiryMs);

    const session: UserSession = {
      id: tokenHash,
      did,
      handle,
      email,
      serviceUrl,
      createdAt: new Date(),
      expiresAt
    };

    await this.userStore.create(session);

    event.cookies.set(this.cookieConfig.name, token, {
      httpOnly: this.cookieConfig.httpOnly,
      path: this.cookieConfig.path,
      secure: this.cookieConfig.secure,
      sameSite: this.cookieConfig.sameSite,
      expires: expiresAt
    });

    return session;
  }

  /**
   * Delete the session and clear the cookie.
   *
   * @param event - The SvelteKit request event
   *
   * @remarks
   * Removes the session from the store and deletes the cookie.
   * Uses maxAge: 0 to clear the cookie across browsers.
   */
  async deleteSession(event: RequestEvent): Promise<void> {
    const token = event.cookies.get(this.cookieConfig.name);
    if (token) {
      const tokenHash = this.userCodec.hash(token);
      await this.userStore.delete(tokenHash);
    }

    event.cookies.set(this.cookieConfig.name, '', {
      httpOnly: this.cookieConfig.httpOnly,
      path: this.cookieConfig.path,
      secure: this.cookieConfig.secure,
      sameSite: 'strict',
      maxAge: 0
    });
  }
}

/**
 * @deprecated Import from '../types.js' instead
 */
export type { SessionManagerConfig };