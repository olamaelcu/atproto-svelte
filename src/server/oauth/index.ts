export {
  createOAuthClient
} from './client.js';
export type { CreateOAuthClientOptions, CreateOAuthClientResult } from '../types.js';
export type { OAuthEnvironmentConfig, OAuthStateStore, OAuthSessionStore, ServiceUrlStore } from '../types.js';
export { resolveHandle, resolveDid } from '../identity/resolve.js';