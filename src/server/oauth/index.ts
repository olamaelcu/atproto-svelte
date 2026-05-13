export {
  createOAuthClient,
  type CreateOAuthClientOptions,
  type CreateOAuthClientResult,
  type OAuthEnvironmentConfig,
  type OAuthStateStore,
  type OAuthSessionStore,
  type ServiceUrlStore
} from './client.js';
export { resolveHandle, resolveDid } from '../identity/resolve.js';