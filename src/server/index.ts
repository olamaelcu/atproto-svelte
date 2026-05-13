export { createOAuthClient } from './oauth/client';
export { createSessionManager } from './session/manager';
export { resolveHandle, resolveDid, resolveIdentity } from './identity/resolve';
export { loadEnvConfig, validateEnvConfig } from './config/env.js';

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