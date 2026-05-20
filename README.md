# @olamaelcu/atproto-svelte

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@olamaelcu/atproto-svelte)](https://npmx.dev/package/@olamaelcu/atproto-svelte)
[![Open on npmx.dev](https://npmx.dev/api/registry/badge/license/@olamaelcu/atproto-svelte)](https://npmx.dev/package/@olamaelcu/atproto-svelte)
[![Open on npmx.dev](https://npmx.dev/api/registry/badge/size/@olamaelcu/atproto-svelte)](https://npmx.dev/package/@olamaelcu/atproto-svelte)
[![Open on npmx.dev](https://npmx.dev/api/registry/badge/downloads-month/@olamaelcu/atproto-svelte)](https://npmx.dev/package/@olamaelcu/atproto-svelte)

This library wraps ATProto OAuth functionality and identity resolution for use in SvelteKit applications. It handles the OAuth flow and provides cached queries for looking up handles, DIDs, and profiles through Tanstack Query.

## Features

The package supports OAuth 2.1 with PKCE and DPoP through `@atproto/oauth-client-node`, giving you the full ATProto authentication flow out of the box. Identity resolution works by converting handles to DIDs via DNS TXT records or the well-known endpoint, then fetching DID documents from the PLC directory. The library also performs bidirectional verification to ensure handles match their DID documents.

Tanstack Query integration provides stale-while-revalidate caching with configurable TTLs. Storage is handled through interfaces that you implement for your own database, so there's no ORM included.

## Installation

```bash
npm install @olamaelcu/atproto-svelte
yarn add @olamaelcu/atproto-svelte
```

You'll also need to install the peer dependencies separately:

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

```svelte
<script lang="ts">
  import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
  import { createIdentityQuery } from "@olamaelcu/atproto-svelte/client";

  let { children } = $props();

  const queryClient = new QueryClient();
  const identity = createIdentityQuery('handle.example.com');
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
```

Access the resolved identity data through `identity.data?.did`, `identity.data?.handle`, `identity.data?.pdsUrl`, and `identity.data?.isVerified`.

## Identity Resolution

Handles resolve to DIDs through a two-step process. First, the library queries for a DNS TXT record at `_atproto.{domain}`. If that fails, it falls back to fetching `/.well-known/atproto-did` over HTTPS. Once it has a DID, it fetches the DID document from `plc.directory/{did}`.

Tanstack Query caches these lookups using stale-while-revalidate semantics. Handle to DID lookups stay fresh for 10 minutes and are garbage collected after an hour. DID document lookups are fresh for 15 minutes and persist for 2 hours. Profile lookups are fresh for 5 minutes and kept for 30 minutes.

## SvelteKit Integration

In your `hooks.server.ts` file, you can use the session manager to validate requests:

```typescript
import { sessionManager } from "$lib/server/session";

export const handle = async ({ event, resolve }) => {
  const session = await sessionManager.validateSession(event);
  event.locals.session = session;
  return resolve(event);
};
```

## Storage Interfaces

You need to implement three storage interfaces for your own database. The `OAuthStateStore` handles temporary OAuth state with get, set, and delete operations for Uint8Array values. The `OAuthSessionStore` manages persisted session data with the same operations. The `UserSessionStore` handles user sessions indexed by token hash, with methods for retrieval, creation, updates, and deletion by DID or hash.

## License

MPL-2.0

[1]: https://atproto.com/specs/oauth