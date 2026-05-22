import type { Client } from '@libsql/client';
import type { LibsqlStorageConfig, LibsqlStores } from '../types.js';
import { getTableNames } from './tables.js';
import { createLibsqlClient } from './client.js';
import { LibsqlOAuthStateStore } from './libsql-oauth-state-store.js';
import { LibsqlOAuthSessionStore } from './libsql-oauth-session-store.js';
import { LibsqlServiceUrlStore } from './libsql-service-url-store.js';
import { LibsqlUserSessionStore } from './libsql-user-session-store.js';

export function createLibsqlStores(config: LibsqlStorageConfig): LibsqlStores {
	let client: Client;
	let shouldClose = false;

	if (typeof config.client === 'string') {
		client = createLibsqlClient({ url: config.client });
		shouldClose = true;
	} else if ('url' in config.client) {
		client = createLibsqlClient(config.client);
		shouldClose = true;
	} else {
		client = config.client as Client;
		shouldClose = false;
	}

	const tables = getTableNames(config.tables?.tablePrefix, config.tables?.tableNames);

	const oauthState = new LibsqlOAuthStateStore(client, tables.oauthStates);
	const oauthSession = new LibsqlOAuthSessionStore(client, tables.oauthSessions);
	const serviceUrl = new LibsqlServiceUrlStore(client, tables.serviceUrls);
	const userSession = new LibsqlUserSessionStore(client, tables.userSessions);

	return {
		oauthState,
		oauthSession,
		serviceUrl,
		userSession,
		close: async () => {
			if (shouldClose) {
				client.close();
			}
		}
	};
}