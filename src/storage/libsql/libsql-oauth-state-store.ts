import type { Client } from '@libsql/client';
import type { OAuthStateStore } from '../../server/types.js';
import { OAUTH_STATES_DDL } from './tables.js';

export class LibsqlOAuthStateStore implements OAuthStateStore {
	private readonly client: Client;
	private readonly tableName: string;
	private initialized = false;

	constructor(client: Client, tableName = 'oauth_states') {
		this.client = client;
		this.tableName = tableName;
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;

		const ddl = OAUTH_STATES_DDL.replace(/%TABLE_NAME%/g, this.tableName);
		const statements = ddl
			.split(';')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const stmt of statements) {
			await this.client.execute(stmt);
		}

		this.initialized = true;
	}

	async get(key: string): Promise<Uint8Array | undefined> {
		await this.ensureInitialized();

		const result = await this.client.execute({
			sql: `SELECT value FROM ${this.tableName} WHERE key = ?`,
			args: [key]
		});

		if (result.rows.length === 0) {
			return undefined;
		}

		const row = result.rows[0];
		if (!row) {
			return undefined;
		}

		const value = row.value as string;
		return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
	}

	async set(key: string, value: Uint8Array): Promise<void> {
		await this.ensureInitialized();

		const encoded = btoa(String.fromCharCode(...value));
		await this.client.execute({
			sql: `INSERT OR REPLACE INTO ${this.tableName} (key, value) VALUES (?, ?)`,
			args: [key, encoded]
		});
	}

	async del(key: string): Promise<void> {
		await this.ensureInitialized();

		await this.client.execute({
			sql: `DELETE FROM ${this.tableName} WHERE key = ?`,
			args: [key]
		});
	}
}