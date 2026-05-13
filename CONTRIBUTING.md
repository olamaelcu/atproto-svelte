# Contributing to @olamaelcu/atproto-svelte

Thanks for your interest in contributing.

## Development Setup

```bash
npm install
```

## Testing

```bash
npm test              # all tests
npm run test:unit      # unit tests only
npm run test:integration  # integration tests
npm run test:coverage # with coverage report
```

## Build

```bash
npm run build         # production build
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
```

## Code Style

- 2-space indentation, LF line endings
- TypeScript strict mode
- Follow existing patterns in the codebase

## Architecture

The library is organized as:

- `src/index.ts` - Public exports (universal)
- `src/server/` - Server-only: OAuth client, session manager, identity resolution
- `src/client/` - Tanstack Query wrappers for browser
- `src/types/` - Shared types

## Storage Interfaces

This library ships interface-only. Consumers implement `OAuthStateStore`, `OAuthSessionStore`, and `UserSessionStore` for their own database. See README for interface definitions.

##提交代码

All contributions must include a DCO sign-off. See `DCO.md` for details.