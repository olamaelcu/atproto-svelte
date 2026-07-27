import type { Agent } from '@atproto/api';
import type { NodeOAuthClient, OAuthSession } from '@atproto/oauth-client-node';

/**
 * Configuration for the ATProto OAuth client.
 * Defines how your app authenticates with the AT Protocol network.
 */
export interface OAuthEnvironmentConfig {
  /** Your application's domain for OAuth callbacks (e.g. "example.com"). Used to construct redirect URIs and client metadata endpoints. */
  appDomain: string;
  /** Human-readable name for your OAuth client. Shown to users in authorization dialogs. */
  oauthClientName: string;
  /** Space-separated list of OAuth scopes to request (e.g. "atproto transition:generic"). */
  oauthScopes: string;
  /** Base64-encoded RSA/ECDSA private key for confidential clients. Required only for private_key_jwt authentication. */
  oauthJwk?: string | string[];
  /** URL to your Terms of Service page. Displayed in authorization dialogs if set. */
  oauthTosUri?: string;
  /** URL to your Privacy Policy page. Displayed in authorization dialogs if set. */
  oauthPolicyUri?: string;
  /** URL to your logo for display in authorization dialogs. */
  logoUri?: string;
  /** Set to true when running in development mode. Enables localhost callbacks and dev-specific behavior. */
  isDev: boolean;
  /** Override hostname for development callback URLs. Defaults to localhost. */
  devHost?: string;
  /** Override port for development callback URLs. Defaults to 3000. */
  devPort?: number;
  /** Fallback DID used when session resolution fails. Typically your own PDS service DID. */
  fallbackDid?: string;
  /** Fallback domain for handle resolution. Used when a handle cannot be resolved on-chain. */
  fallbackDomain?: string;
  /** Override the PLC directory URL for DID resolution. Defaults to plc.directory. */
  plcDirectoryUrl?: string;
  /** Override the public ATP API URL. Used to specify a custom PDS endpoint. */
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