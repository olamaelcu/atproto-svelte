# Contributing to @olamaelcu/atproto-svelte

Thanks for your interest in contributing.

## Development Environment

This project uses [mise](https://mise.jdx.dev) to pin tool versions. Install mise and run:

```bash
mise install
```

This will install the versions specified in `mise.toml`:
- Node.js 22
- Yarn 4
- Rust 1.85

## Testing

```bash
yarn test              # all tests
yarn run test:unit      # unit tests only
yarn run test:integration  # integration tests
yarn run test:coverage # with coverage report
```

## Build

```bash
yarn run build         # production build
yarn run typecheck     # TypeScript type checking
yarn run lint          # ESLint
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