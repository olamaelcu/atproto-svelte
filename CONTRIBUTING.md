# Contributing to @olamaelcu/atproto-svelte

Thanks for your interest in contributing.

## Development Environment

This project uses [mise](https://mise.jdx.dev) to pin tool versions and [hk](https://hk.jdx.dev) for git hooks.

```bash
mise install
```

This installs versions from `mise.toml`:

- Node.js 22.14.0
- Yarn 4.14.1

## Setup

```bash
mise exec -- yarn install
```

## Testing

```bash
mise exec -- yarn test              # all tests
mise exec -- yarn run test:unit     # unit tests only
mise exec -- yarn run test:integration  # integration tests
```

## Build

```bash
mise exec -- yarn run build    # production build
mise exec -- yarn run typecheck   # TypeScript type checking
mise exec -- yarn run lint    # ESLint + Oxlint
```

## Git Hooks (hk)

hk runs formatting, linting, and tests on commits automatically.

```bash
hk init
```

This installs hooks via mise. Tools run through mise so versions are consistent:

- `oxfmt` / `prettier` - formatting
- `oxlint` / `eslint` - linting
- `tsc` - type checking
- `yarn test` - tests

To check without committing:

```bash
hk check
```

To auto-fix:

```bash
hk fix
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

## Contributions

All contributions must include a DCO sign-off. See `DCO.md` for details.