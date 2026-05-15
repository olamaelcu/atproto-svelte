---
name: atproto-svelte
description: ATProto OAuth client and identity resolution for SvelteKit with Tanstack Query caching. Use when implementing Bluesky ATProto identity, OAuth flows, handle/DID resolution, or PDS operations in a SvelteKit project.
license: MIT
compatibility: SvelteKit 2.x, Tanstack Query 5.x, ATProto OAuth
allowed-tools: Read, Glob, Grep
---

# ATProto Svelte Integration

A SvelteKit library for ATProto OAuth authentication and identity resolution, with Tanstack Query caching built in.

## Entry Points

The library exports from two entry points:

- **`@olamaelcu/atproto-svelte`** - Client-side safe exports (identity queries, types)
- **`@olamaelcu/atproto-svelte/server`** - Server-only exports (OAuth, session management, identity resolution)

```typescript
// Client-side (safe for browser)
import { createIdentityQuery } from '@olamaelcu/atproto-svelte/client';

// Server-only (never import this on the client)
import { createOAuthClient, createSessionManager } from '@olamaelcu/atproto-svelte/server';
```

## Core Concepts

### DIDs (Decentralized Identifiers)

ATProto users are identified by DIDs, not usernames. The most common format is `did:plc:{random}` for PLC directory accounts hosted on Bluesky PDS. DIDs are the primary key for all repo operations.

### PDS (Personal Data Server)

The server hosting a user's data. Resolved from the DID document's `service` field under `#atproto_pds`.

### Handles

Human-readable identifiers like `user.bsky.social`. Must be verified bidirectionally: the handle resolves to a DID, and the DID document's `alsoKnownAs` field must contain the handle as an `at://` URI.

### XRPC API

ATProto's HTTP RPC mechanism. Two namespaces:
- `com.atproto.*` - Protocol operations (repo, identity, sync)
- `app.bsky.*` - Bluesky application-specific (feed, graph, notification)

### OAuth Flow

Authorization code flow with PKCE (Proof Key for Code Exchange). Steps:
1. Generate auth URL with `createOAuthClient().getAuthorizationUrl()`
2. Redirect user to authorization server
3. Handle callback with authorization code
4. Exchange code for tokens via `client.callback()`
5. Store session with tokens

## Installation

```bash
npm install @olamaelcu/atproto-svelte
```

Peer dependencies (must be installed separately):
```bash
npm install @tanstack/svelte-query @sveltejs/kit
```

## Storage Interfaces

Consumers implement storage interfaces for their own database. The library provides no ORM-specific code.

### OAuthStateStore

Stores OAuth authorization state during the PKCE flow. Must persist `Uint8Array` values.

```typescript
interface OAuthStateStore {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, value: Uint8Array): Promise<void>;
  del(key: string): Promise<void>;
}
```

### OAuthSessionStore

Stores OAuth sessions with refresh tokens.

```typescript
interface OAuthSessionStore {
  get(key: string): Promise<NodeSavedSession | undefined>;
  set(key: string, session: NodeSavedSession): Promise<void>;
  del(key: string): Promise<void>;
}
```

### ServiceUrlStore

Stores PDS URLs for resolved DIDs to avoid repeated PLC lookups. Supports atomic "take" operation for distributed scenarios.

```typescript
interface ServiceUrlStore {
  getServiceUrl(key: string): Promise<string | undefined>;
  setServiceUrl(key: string, url: string): Promise<void>;
  takeServiceUrl(key: string): Promise<string | undefined>;  // Atomically retrieves and deletes
}
```

### UserSessionStore

Application-level session storage for authenticated users.

```typescript
interface UserSessionStore {
  getByTokenHash(hash: string): Promise<UserSession | undefined>;
  create(session: UserSession): Promise<void>;
  update(hash: string, updates: Partial<UserSession>): Promise<void>;
  delete(hash: string): Promise<void>;
  deleteByDid(did: string): Promise<void>;
}

interface UserSession {
  id: string;
  did: string;
  handle: string;
  email: string | null;
  serviceUrl: string | null;
  createdAt: Date;
  expiresAt: Date;
}
```

## Configuration

### Environment Variables

```bash
# Required
OAUTH_DOMAIN=https://yourapp.com        # Your domain for OAuth
OAUTH_CLIENT_NAME=My App               # Display name
OAUTH_SCOPES=atproto transition:generic
PDS_URL=https://bsky.social            # PDS URL

# Optional
OAUTH_JWK=<base64>                     # Private key for signed requests
OAUTH_TOS_URI=https://yourapp.com/tos
OAUTH_POLICY_URI=https://yourapp.com/policy
FALLBACK_DID=did:plc:optional
PLC_DIRECTORY_URL=https://plc.directory
```

Load and validate configuration:

```typescript
import { loadEnvConfig } from '@olamaelcu/atproto-svelte/server';

const config = loadEnvConfig();  // Throws if validation fails in production
```

## OAuth Setup

```typescript
import { createOAuthClient } from '@olamaelcu/atproto-svelte/server';
import type { OAuthStateStore, OAuthSessionStore, ServiceUrlStore } from '@olamaelcu/atproto-svelte/server';

const { client, restore } = await createOAuthClient(
  {
    oauthDomain: 'example.com',
    oauthClientName: 'My App',
    oauthScopes: 'atproto transition:generic',
    pdsUrl: 'https://bsky.social',
    isDev: false,
    fallbackDid: 'did:plc:optional-fallback'
  },
  {
    stateStore: myStateStore,
    sessionStore: mySessionStore,
    serviceUrlStore: myServiceUrlStore  // optional
  }
);
```

## Session Management

```typescript
import { createSessionManager } from '@olamaelcu/atproto-svelte/server';

const sessionManager = createSessionManager({
  oauthClient: client,
  userCodec: new TokenCodec(process.env.SESSION_SECRET),
  tokenConfig: {
    secret: process.env.SESSION_SECRET,
    expiryMs: 30 * 24 * 60 * 60 * 1000,
    renewalThresholdMs: 15 * 24 * 60 * 60 * 1000
  },
  cookieConfig: {
    name: 'session',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  },
  userStore: myUserStore
});
```

### Session Validation

```typescript
// In hooks.server.ts
import { sessionManager } from '$lib/server/session';

export const handle = async ({ event, resolve }) => {
  const session = await sessionManager.validateSession(event);
  event.locals.session = session;
  return resolve(event);
};
```

### OAuth Callback Route

Handle the OAuth callback in your SvelteKit route:

```typescript
// src/routes/oauth/callback/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { oauthClient } from '$lib/server/oauth';
import { sessionManager } from '$lib/server/session';

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    throw redirect(302, '/login?error=missing_params');
  }

  try {
    const { session } = await oauthClient.callback(url, { state });
    await sessionManager.createAndSetSession(
      event,
      session.did,
      session.handle,
      session.email,
      session.serviceUrl
    );
  } catch (err) {
    console.error('OAuth callback failed:', err);
    throw redirect(302, '/login?error=callback_failed');
  }

  throw redirect(302, '/');
};
```

### Programmatic Login (for testing)

```typescript
// Generate authorization URL and store state
const url = await oauthClient.getAuthorizationUrl(state, 'S256');
// Redirect user to url
```

### Session Restoration

Restore a session from stored credentials (e.g., after server restart):

```typescript
const session = await restore(did);  // Uses sessionStore to reload tokens
```

## Identity Resolution

Identity resolution uses Tanstack Query with stale-while-revalidate caching:

```svelte
<script lang="ts">
  import { createIdentityQuery } from '@olamaelcu/atproto-svelte/client';

  const identityQuery = createIdentityQuery('user.bsky.social');
  const identity = $derived($identityQuery.data);
</script>

<p>DID: {identity?.did}</p>
<p>Handle: {identity?.handle}</p>
<p>Verified: {identity?.isVerified ? 'Yes' : 'No'}</p>
```

Query keys and stale times:
| Query | Key | staleTime | gcTime |
|-------|-----|-----------|--------|
| Handle→DID | `['identity', 'handle', handle]` | 10 min | 60 min |
| DID doc | `['identity', 'did', did]` | 15 min | 2 hrs |
| Profile | `['identity', 'profile', did]` | 5 min | 30 min |

## Error Handling

Common failure modes:
- Handle resolution fails → user may not exist or DNS not configured
- PLC resolution fails → PLC directory may be unavailable
- Token exchange fails → code expired (10 min window) or client_id mismatch
- Session restoration fails → tokens expired, need re-authentication

## SvelteKit Integration

### Server Hooks

```typescript
// hooks.server.ts
import { sessionManager } from '$lib/server/session';

export const handle = async ({ event, resolve }) => {
  const session = await sessionManager.validateSession(event);
  event.locals.session = session;
  return resolve(event);
};
```

### Page Load

```typescript
// +page.server.ts
export const load = async ({ locals }) => {
  return {
    session: locals.session
  };
};
```