export {
  createOAuthClient,
  type CreateOAuthClientOptions,
  type CreateOAuthClientResult
} from './client.js';
export type { OAuthEnvironmentConfig, OAuthStateStore, OAuthSessionStore, ServiceUrlStore } from '../types.js';
export { resolveHandle, resolveDid } from '../identity/resolve.js';