import { createHmac, createHash, randomBytes } from 'crypto';
import { encodeBase32UpperCaseNoPadding, decodeBase32IgnorePadding } from '@oslojs/encoding';
import type { Agent } from '@atproto/api';
import type { NodeOAuthClient, OAuthSession } from '@atproto/oauth-client-node';
import { TOKEN_RANDOM_BYTES_LENGTH } from './constants.js';

export interface OAuthEnvironmentConfig {
  oauthDomain: string;
  oauthClientName: string;
  oauthScopes: string;
  oauthJwk?: string | string[];
  oauthTosUri?: string;
  oauthPolicyUri?: string;
  pdsUrl: string;
  isDev: boolean;
  devHost?: string;
  devPort?: number;
  fallbackDid?: string;
  fallbackDomain?: string;
  plcDirectoryUrl?: string;
  publicApiUrl?: string;
}

export interface OAuthStateStore {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, value: Uint8Array): Promise<void>;
  del(key: string): Promise<void>;
}

export interface OAuthSessionStore {
  get(key: string): Promise<NodeSavedSession | undefined>;
  set(key: string, session: NodeSavedSession): Promise<void>;
  del(key: string): Promise<void>;
}

export interface ServiceUrlStore {
  getServiceUrl(key: string): Promise<string | undefined>;
  setServiceUrl(key: string, url: string): Promise<void>;
  takeServiceUrl(key: string): Promise<string | undefined>;
}

export interface UserSessionStore {
  getByTokenHash(hash: string): Promise<UserSession | undefined>;
  create(session: UserSession): Promise<void>;
  update(hash: string, updates: Partial<UserSession>): Promise<void>;
  delete(hash: string): Promise<void>;
  deleteByDid(did: string): Promise<void>;
}

export interface UserSession {
  id: string;
  did: string;
  handle: string;
  email: string | null;
  serviceUrl: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface ValidatedSession {
  atpAgent: Agent | null;
  did: string | null;
  handle: string | null;
  email: string | null;
  serviceUrl: string | null;
}

export interface SessionTokenConfig {
  secret: string;
  expiryMs: number;
}

export interface CookieConfig {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
}

export interface SessionManagerConfig {
  oauthClient: NodeOAuthClient;
  userCodec: TokenCodec;
  tokenConfig: SessionTokenConfig;
  cookieConfig: CookieConfig;
  userStore: UserSessionStore;
  getServiceUrl?: (did: string) => Promise<string | undefined>;
}

export class TokenCodec {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  encode(randomBytes_: Uint8Array = randomBytes(TOKEN_RANDOM_BYTES_LENGTH)): string {
    const randomPart = encodeBase32UpperCaseNoPadding(randomBytes_);
    const sig = createHmac('sha256', this.secret).update(randomBytes_).digest();
    const sigPart = encodeBase32UpperCaseNoPadding(sig);
    return `${randomPart}.${sigPart}`;
  }

  decode(token: string): { randomPart: string; sigPart: string } | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [randomPart, sigPart] = parts as [string, string];
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
      diff |= expectedSig[i]! ^ actualSig[i]!;
    }

    if (diff !== 0) return null;

    return { randomPart: randomPart!, sigPart: sigPart! };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export interface CreateOAuthClientOptions {
  stateStore: OAuthStateStore;
  sessionStore: OAuthSessionStore;
  serviceUrlStore?: ServiceUrlStore;
}

export interface CreateOAuthClientResult {
  client: NodeOAuthClient;
  restore: (did: string) => Promise<OAuthSession>;
}

export type NodeSavedState = import('@atproto/oauth-client-node').NodeSavedState;
export type NodeSavedSession = import('@atproto/oauth-client-node').NodeSavedSession;