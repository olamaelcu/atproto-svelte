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

export { Agent } from './client';
export { OAuthSession, TokenRefreshError, NodeOAuthClient, atprotoLoopbackClientMetadata } from './server';
export type { AtpSessionData, XRPCError } from './client';