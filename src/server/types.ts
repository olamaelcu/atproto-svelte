import type { Agent } from '@atproto/api';
import type { NodeOAuthClient, OAuthSession } from '@atproto/oauth-client-node';

export interface OAuthEnvironmentConfig {
  oauthDomain: string;
  oauthClientName: string;
  oauthScopes: string;
  oauthJwk?: string | string[];
  oauthTosUri?: string;
  oauthPolicyUri?: string;
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

export interface TokenCodec {
  encode(randomBytes?: Uint8Array): string;
  decode(token: string): { randomPart: string; sigPart: string } | null;
  hash(token: string): string;
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