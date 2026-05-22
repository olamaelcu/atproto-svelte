import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import type { LibsqlClientConfig } from '../types.js';

export function createLibsqlClient(config: LibsqlClientConfig): Client {
	return createClient({
		url: config.url,
		authToken: config.authToken,
		syncUrl: config.syncUrl,
		syncInterval: config.syncInterval,
		encryptionKey: config.encryptionKey
	});
}