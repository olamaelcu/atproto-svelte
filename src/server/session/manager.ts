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
import { TokenRefreshError } from '@atproto/oauth-client-node';
import type { RequestEvent } from '@sveltejs/kit';
import { TOKEN_RANDOM_BYTES_LENGTH } from '../constants.js';

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

export class SessionManager {
  private readonly oauthClient: NodeOAuthClient;
  private readonly userCodec: TokenCodec;
  private readonly tokenConfig: { secret: string; expiryMs: number; renewalThresholdMs: number };
  private readonly cookieConfig: CookieConfig;
  private readonly userStore: UserSessionStore;
  private readonly getServiceUrl?: (did: string) => Promise<string | undefined>;

  constructor(config: SessionManagerConfig) {
    this.oauthClient = config.oauthClient;
    this.userCodec = config.userCodec;
    this.tokenConfig = config.tokenConfig;
    this.cookieConfig = config.cookieConfig;
    this.userStore = config.userStore;
    this.getServiceUrl = config.getServiceUrl;
  }

  async validateSession(event: RequestEvent): Promise<ValidatedSession> {
    const token = event.cookies.get(this.cookieConfig.name);
    if (!token) return { ...NULL_SESSION };

    const decoded = this.userCodec.decode(token);
    if (!decoded) {
      event.cookies.set(this.cookieConfig.name, '', {
        httpOnly: this.cookieConfig.httpOnly,
        path: this.cookieConfig.path,
        secure: this.cookieConfig.secure,
        sameSite: 'strict',
        maxAge: 0
      });
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

