# Developer Agent Guide

## Project Overview

ATProto OAuth client and identity resolution library for SvelteKit with Tanstack Query caching.

## Package Structure

```
@olamaelcu/atproto-svelte/
├── src/
│   ├── index.ts           # Public exports
│   ├── types/index.ts     # Identity, Profile types
│   ├── client/            # Tanstack Query wrappers
│   │   ├── identity.ts
│   │   └── profile.ts
│   └── server/
│       ├── types.ts       # Storage interfaces + TokenCodec
│       ├── oauth/client.ts    # createOAuthClient
│       ├── session/manager.ts # SessionManager
│       └── identity/
│           ├── resolve.ts # resolveHandle/Did/Identity
│           └── plc.ts     # PLC directory fetching
├── tests/
│   ├── setup/             # Mock factories
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
└── skills/SKILL.md         # LLM integration docs
```

## Build/Test Commands

```bash
npm run build              # production build with tsup
npm run test                # all tests
npm run test:unit           # unit tests only
npm run test:integration    # integration tests
npm run typecheck           # TypeScript checking
npm run lint                # ESLint
```

## TokenCodec

HMAC-SHA256 signed tokens.

- `encode(randomBytes(20))` produces `base32.randomPart.base32.sigPart`
- `decode()` verifies the HMAC using constant-time comparison
- `hash()` returns SHA256 for session lookup

## Identity Resolution

1. Handle resolves via DNS TXT `_atproto.{domain}`
2. If that fails, falls back to HTTPS `/.well-known/atproto-did`
3. DID data fetched from `https://plc.directory/{did}`
4. Bidirectional verification through `alsoKnownAs`

## Tanstack Query Keys

- `['identity', 'handle', handle]`
- `['identity', 'did', did]`
- `['identity', 'resolve', identifier]`
- `['identity', 'profile', did]`

## Storage Interfaces

Implement these interfaces:

- `OAuthStateStore` - OAuth authorization state
- `OAuthSessionStore` - OAuth sessions with refresh tokens
- `UserSessionStore` - app-level user sessions

## Development Notes

- Server-only code lives in `src/server/`
- Client wrappers in `src/client/` dynamically import from server
- Tests use Vitest with MSW for HTTP mocking
- Token security uses constant-time comparison to prevent timing attacks