import type { Client } from '@libsql/client';

export interface LibsqlClientConfig {
	url: string;
	authToken?: string;
	syncUrl?: string;
	syncInterval?: number;
	encryptionKey?: string;
}

export interface LibsqlTableConfig {
	tablePrefix?: string;
	tableNames?: {
		oauthStates?: string;
		oauthSessions?: string;
		serviceUrls?: string;
		userSessions?: string;
	};
}

export interface LibsqlStorageConfig {
	client: LibsqlClientConfig | Client;
	tables?: LibsqlTableConfig;
}

export interface LibsqlStores {
	oauthState: import('../server/types.js').OAuthStateStore;
	oauthSession: import('../server/types.js').OAuthSessionStore;
	serviceUrl: import('../server/types.js').ServiceUrlStore;
	userSession: import('../server/types.js').UserSessionStore;
	close: () => Promise<void>;
}

export type { Client };