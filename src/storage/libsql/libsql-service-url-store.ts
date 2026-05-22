import type { Client } from '@libsql/client';
import type { ServiceUrlStore } from '../../server/types.js';
import { SERVICE_URLS_DDL } from './tables.js';

export class LibsqlServiceUrlStore implements ServiceUrlStore {
	private readonly client: Client;
	private readonly tableName: string;
	private initialized = false;

	constructor(client: Client, tableName = 'service_urls') {
		this.client = client;
		this.tableName = tableName;
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;

		const ddl = SERVICE_URLS_DDL.replace(/%TABLE_NAME%/g, this.tableName);
		const statements = ddl
			.split(';')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const stmt of statements) {
			await this.client.execute(stmt);
		}

		this.initialized = true;
	}

	async getServiceUrl(key: string): Promise<string | undefined> {
		await this.ensureInitialized();

		const result = await this.client.execute({
			sql: `SELECT value FROM ${this.tableName} WHERE key = ? AND taken = 0`,
			args: [key]
		});

		if (result.rows.length === 0) {
			return undefined;
		}

		const row = result.rows[0];
		if (!row) {
			return undefined;
		}

		return row.value as string;
	}

	async setServiceUrl(key: string, url: string): Promise<void> {
		await this.ensureInitialized();

		await this.client.execute({
			sql: `INSERT OR REPLACE INTO ${this.tableName} (key, value, taken) VALUES (?, ?, 0)`,
			args: [key, url]
		});
	}

	async takeServiceUrl(key: string): Promise<string | undefined> {
		await this.ensureInitialized();

		const selectResult = await this.client.execute({
			sql: `SELECT value FROM ${this.tableName} WHERE key = ? AND taken = 0`,
			args: [key]
		});

		if (selectResult.rows.length === 0) {
			return undefined;
		}

		const urlRow = selectResult.rows[0];
		if (!urlRow) {
			return undefined;
		}

		const url = urlRow.value as string;

		await this.client.execute({
			sql: `UPDATE ${this.tableName} SET taken = 1 WHERE key = ?`,
			args: [key]
		});

		return url;
	}
}