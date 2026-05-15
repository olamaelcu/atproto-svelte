export type { Identity, Profile } from './types';
export type {
	OAuthEnvironmentConfig,
	UserSessionStore,
	ValidatedSession,
	OAuthStateStore,
	OAuthSessionStore
} from './server/types';

export { createOAuthClient } from './server/oauth/client';
export { createSessionManager } from './server/session/manager';

export { createIdentityQuery, createResolveDidQuery, createResolveHandleQuery } from './client/identity';
export { createProfileQuery } from './client/profile';

export { QueryClient } from '@tanstack/svelte-query';