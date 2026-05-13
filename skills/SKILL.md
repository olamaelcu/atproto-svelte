---
name: atproto-svelte
description: ATProto OAuth client and identity resolution for SvelteKit with Tanstack Query caching. Use when implementing Bluesky ATProto identity, OAuth flows, handle/DID resolution, or PDS operations in a SvelteKit project.
license: MIT
compatibility: SvelteKit 2.x, Tanstack Query 5.x, ATProto OAuth
allowed-tools: Read, Glob, Grep
---

# ATProto Svelte Integration

A SvelteKit library for ATProto OAuth authentication and identity resolution, with Tanstack Query caching built in.

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

## Configuration

Consumers implement storage interfaces for their own database. The library provides no ORM-specific code.

```typescript
// Your session store implementation
interface UserSessionStore {
  getByTokenHash(hash: string): Promise<UserSession | undefined>;
  create(session: UserSession): Promise<void>;
  update(hash: string, updates: Partial<UserSession>): Promise<void>;
  delete(hash: string): Promise<void>;
  deleteByDid(did: string): Promise<void>;
}

interface OAuthStateStore {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, value: Uint8Array): Promise<void>;
  del(key: string): Promise<void>;
}

interface OAuthSessionStore {
  get(key: string): Promise<NodeSavedSession | undefined>;
  set(key: string, session: NodeSavedSession): Promise<void>;
  del(key: string): Promise<void>;
}
```

## Identity Resolution

Identity resolution uses Tanstack Query with stale-while-revalidate caching:

```typescript
import { createIdentityQuery, identityClient } from '@olamaelcu/atproto-svelte/client';
import { QueryClientProvider } from '@tanstack/svelte-query';

function App() {
  return {
    QueryClientProvider,
    props: { children: {} },
    setup() {
      const query = createIdentityQuery('user.bsky.social');
      // query.data?.did, query.data?.handle, query.data?.pdsUrl, query.data?.isVerified
    }
  };
}
```

Query keys and stale times:
| Query | Key | staleTime | gcTime |
|-------|-----|-----------|--------|
| Handle→DID | `['identity', 'handle', handle]` | 10 min | 60 min |
| DID doc | `['identity', 'did', did]` | 15 min | 2 hrs |
| Profile | `['identity', 'profile', did]` | 5 min | 30 min |

## OAuth Setup

```typescript
import { createOAuthClient } from '@olamaelcu/atproto-svelte/server';
import type { OAuthStateStore, OAuthSessionStore } from '@olamaelcu/atproto-svelte/server';

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
    sessionStore: mySessionStore
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
  }
});
```

## Error Handling

Common failure modes:
- Handle resolution fails → user may not exist or DNS not configured
- PLC resolution fails → PLC directory may be unavailable
- Token exchange fails → code expired (10 min window) or client_id mismatch
- Session restoration fails → tokens expired, need re-authentication

## SvelteKit Integration

In `hooks.server.ts`:

```typescript
import { sessionManager } from '$lib/server/session';

export const handle = async ({ event, resolve }) => {
  const session = await sessionManager.validateSession(event);
  event.locals.session = session;
  return resolve(event);
};
```

In `+page.server.ts`:

```typescript
export const load = async ({ locals }) => {
  return {
    session: locals.session
  };
};
```