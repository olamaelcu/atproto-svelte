export { NodeOAuthClient } from '@atproto/oauth-client-node';
export { OAuthSession, TokenRefreshError } from '@atproto/oauth-client-node';
export { atprotoLoopbackClientMetadata } from '@atproto/oauth-client-node';

export type { AtpSessionData, XRPCError } from '@atproto/api';

export { createOAuthClient } from './oauth/client';
export { createSessionManager } from './session/manager';
export { resolveHandle, resolveDid, resolveIdentity, verifyBidirectional } from './identity/resolve';
export { validateHandle, validateDid, validateIdentity } from './identity/validate.js';
export { loadEnvConfig, validateEnvConfig } from './config/env.js';
export { fetchProfile } from './profile.js';

export type {
  OAuthEnvironmentConfig,
  OAuthStateStore,
  OAuthSessionStore,
  ServiceUrlStore,
  UserSessionStore,
  UserSession,
  ValidatedSession,
  SessionManagerConfig,
  CookieConfig,
  SessionTokenConfig
} from './types.js';