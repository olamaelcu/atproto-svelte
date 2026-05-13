# @olamaelcu/atproto-svelte

An opinionated approach to [ATProto OAuth][1] client and identity resolution for
[SvelteKit][] with [Tanstack Query][] caching.

## Features

- **[OAuth 2.1][] with [PKCE][] and [DPoP][]** - Full ATProto OAuth flow via `@atproto/oauth-client-node`
- **Identity resolution** - Handle → DID via DNS TXT or well-known endpoint, DID document fetching from PLC directory
- **Bidirectional verification** - Verify handles against DID documents
- **Tanstack Query caching** - Stale-while-revalidate with configurable TTLs
- **Storage interfaces** - Consumers implement for [their own database (no ORM shipped)](#storage-interfaces)

## Installation

```bash
npm install @olamaelcu/atproto-svelte
yarn add @olamaelcu/atproto-svelte
```

Peer dependencies (must be installed separately):

```bash
npm install @tanstack/svelte-query @sveltejs/kit
yarn install @tanstack/svelte-query @sveltejs/kit
```

## Quick Start

### Server-side (OAuth + Session)

```typescript
import { createOAuthClient, createSessionManager } from '@olamaelcu/atproto-svelte/server';
import type { OAuthStateStore, OAuthSessionStore, UserSessionStore } from '@olamaelcu/atproto-svelte/server';

// Implement storage interfaces for your database
const myStateStore: OAuthStateStore = { get, set, del };
const mySessionStore: OAuthSessionStore = { get, set, del };
const myUserStore: UserSessionStore = { getByTokenHash, create, update, delete, deleteByDid };

// Create OAuth client
const { client, restore } = await createOAuthClient(
  { oauthDomain: 'example.com', oauthClientName: 'My App', oauthScopes: 'atproto transition:generic', pdsUrl: 'https://bsky.social', isDev: false },
  { stateStore: myStateStore, sessionStore: mySessionStore }
);

// Create session manager with cookie transport
const sessionManager = createSessionManager({
  oauthClient: client,
  userCodec: new TokenCodec(process.env.SESSION_SECRET!),
  tokenConfig: { secret: process.env.SESSION_SECRET!, expiryMs: 30 * DAY, renewalThresholdMs: 15 * DAY },
  cookieConfig: { name: 'session', httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
  userStore: myUserStore
});
```

### Client-side (Identity Queries)

```typescript
import {
  createIdentityQuery,
  identityClient,
} from "@olamaelcu/atproto-svelte/client";
import { QueryClientProvider } from "@tanstack/svelte-query";

function App() {
  return {
    QueryClientProvider,
    props: { client: identityClient, children: {} },
    setup() {
      const identity = createIdentityQuery("beats.olamaelcu.net");
      // identity.data?.did, identity.data?.handle, identity.data?.pdsUrl, identity.data?.isVerified
    },
  };
}
```

## Identity Resolution

Handles are resolved via DNS TXT (`_atproto.{domain}`) with fallback to HTTPS (`/.well-known/atproto-did`). DID documents are fetched from `plc.directory/{did}`.

Tanstack Query caching with stale-while-revalidate:

| Query      | Key                              | staleTime | gcTime |
| ---------- | -------------------------------- | --------- | ------ |
| Handle→DID | `['identity', 'handle', handle]` | 10 min    | 60 min |
| DID doc    | `['identity', 'did', did]`       | 15 min    | 2 hrs  |
| Profile    | `['identity', 'profile', did]`   | 5 min     | 30 min |

## SvelteKit Integration

In `hooks.server.ts`:

```typescript
import { sessionManager } from "$lib/server/session";

export const handle = async ({ event, resolve }) => {
  const session = await sessionManager.validateSession(event);
  event.locals.session = session;
  return resolve(event);
};
```

## Storage Interfaces

Consumers implement these interfaces for their own database:

```typescript
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

interface UserSessionStore {
  getByTokenHash(hash: string): Promise<UserSession | undefined>;
  create(session: UserSession): Promise<void>;
  update(hash: string, updates: Partial<UserSession>): Promise<void>;
  delete(hash: string): Promise<void>;
  deleteByDid(did: string): Promise<void>;
}
```

## License

MPL-2.0

[1]: https://atproto.com/specs/oauth
