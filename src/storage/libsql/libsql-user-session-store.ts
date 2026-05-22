import type { Client } from '@libsql/client';
import type { UserSessionStore, UserSession } from '../../server/types.js';
import { USER_SESSIONS_DDL } from './tables.js';

export class LibsqlUserSessionStore implements UserSessionStore {
	private readonly client: Client;
	private readonly tableName: string;
	private initialized = false;

	constructor(client: Client, tableName = 'user_sessions') {
		this.client = client;
		this.tableName = tableName;
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;

		const ddl = USER_SESSIONS_DDL.replace(/%TABLE_NAME%/g, this.tableName);
		const statements = ddl
			.split(';')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const stmt of statements) {
			await this.client.execute(stmt);
		}

		this.initialized = true;
	}

	async getByTokenHash(hash: string): Promise<UserSession | undefined> {
		await this.ensureInitialized();

		const result = await this.client.execute({
			sql: `SELECT data FROM ${this.tableName} WHERE hash = ?`,
			args: [hash]
		});

		if (result.rows.length === 0) {
			return undefined;
		}

		const row = result.rows[0];
		if (!row) {
			return undefined;
		}

		const data = row.data as string;
		return JSON.parse(data) as UserSession;
	}

	async create(session: UserSession): Promise<void> {
		await this.ensureInitialized();

		const data = JSON.stringify(session);
		await this.client.execute({
			sql: `INSERT INTO ${this.tableName} (id, hash, did, handle, email, service_url, created_at, expires_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				session.id,
				this.hashFromSession(session),
				session.did,
				session.handle,
				session.email,
				session.serviceUrl,
				session.createdAt.toISOString(),
				session.expiresAt.toISOString(),
				data
			]
		});
	}

	async update(hash: string, updates: Partial<UserSession>): Promise<void> {
		await this.ensureInitialized();

		const existing = await this.getByTokenHash(hash);
		if (!existing) return;

		const updated = { ...existing, ...updates };
		const data = JSON.stringify(updated);

		await this.client.execute({
			sql: `UPDATE ${this.tableName} SET did = ?, handle = ?, email = ?, service_url = ?, expires_at = ?, data = ? WHERE hash = ?`,
			args: [
				updated.did,
				updated.handle,
				updated.email,
				updated.serviceUrl,
				updated.expiresAt.toISOString(),
				data,
				hash
			]
		});
	}

	async delete(hash: string): Promise<void> {
		await this.ensureInitialized();

		await this.client.execute({
			sql: `DELETE FROM ${this.tableName} WHERE hash = ?`,
			args: [hash]
		});
	}

	async deleteByDid(did: string): Promise<void> {
		await this.ensureInitialized();

		await this.client.execute({
			sql: `DELETE FROM ${this.tableName} WHERE did = ?`,
			args: [did]
		});
	}

	private hashFromSession(session: UserSession): string {
		return session.id;
	}
}