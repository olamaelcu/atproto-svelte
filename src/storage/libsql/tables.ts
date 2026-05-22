export interface TableNames {
	oauthStates: string;
	oauthSessions: string;
	serviceUrls: string;
	userSessions: string;
}

const DEFAULT_TABLES: TableNames = {
	oauthStates: 'oauth_states',
	oauthSessions: 'oauth_sessions',
	serviceUrls: 'service_urls',
	userSessions: 'user_sessions'
};

export function getTableNames(prefix?: string, overrides?: Partial<TableNames>): TableNames {
	const tables: TableNames = { ...DEFAULT_TABLES };

	if (prefix) {
		tables.oauthStates = `${prefix}_${DEFAULT_TABLES.oauthStates}`;
		tables.oauthSessions = `${prefix}_${DEFAULT_TABLES.oauthSessions}`;
		tables.serviceUrls = `${prefix}_${DEFAULT_TABLES.serviceUrls}`;
		tables.userSessions = `${prefix}_${DEFAULT_TABLES.userSessions}`;
	}

	if (overrides) {
		if (overrides.oauthStates) tables.oauthStates = overrides.oauthStates;
		if (overrides.oauthSessions) tables.oauthSessions = overrides.oauthSessions;
		if (overrides.serviceUrls) tables.serviceUrls = overrides.serviceUrls;
		if (overrides.userSessions) tables.userSessions = overrides.userSessions;
	}

	return tables;
}

export const USER_SESSIONS_DDL = `
CREATE TABLE IF NOT EXISTS %TABLE_NAME% (
    id TEXT PRIMARY KEY,
    hash TEXT UNIQUE NOT NULL,
    did TEXT NOT NULL,
    handle TEXT NOT NULL,
    email TEXT,
    service_url TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_hash ON %TABLE_NAME%(hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_did ON %TABLE_NAME%(did);
`;

export const OAUTH_STATES_DDL = `
CREATE TABLE IF NOT EXISTS %TABLE_NAME% (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

export const OAUTH_SESSIONS_DDL = `
CREATE TABLE IF NOT EXISTS %TABLE_NAME% (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

export const SERVICE_URLS_DDL = `
CREATE TABLE IF NOT EXISTS %TABLE_NAME% (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    taken INTEGER DEFAULT 0
);
`;