# Security Guidelines

This document outlines security practices for consuming the `@olamaelcu/atproto-svelte` library.

## Rate Limiting

The library provides an in-memory token bucket rate limiter via `rateLimiter()`.

### Consumer Responsibility

Apply rate limiting to external operations:

| Operation | Recommended Threshold |
|-----------|----------------------|
| Handle resolution (DNS) | 30 requests/minute |
| DID document fetching (PLC) | 60 requests/minute |
| OAuth authorization endpoints | 10 requests/minute |

*Thresholds based on OWASP API Security Guidelines.*

### Implementation

```typescript
import { rateLimiter } from '@olamaelcu/atproto-svelte/server';

const limiter = rateLimiter({ maxTokens: 30, intervalMs: 60_000 });
```

## Brute Force Protection

Use `FailedAttemptsTracker` to defend against credential stuffing and session enumeration.

### Lockout Scaling

| Failed Attempts | Lockout Duration |
|----------------|-----------------|
| 3 | 15 seconds |
| 5 | 1 minute |
| 10 | 15 minutes |
| 20+ | 1 hour |

### Usage

```typescript
import { FailedAttemptsTracker } from '@olamaelcu/atproto-svelte/server';

const tracker = new FailedAttemptsTracker({
  maxAttempts: 5,
  lockoutMs: 60_000,
  windowMs: 300_000,
});

if (!tracker.record(failure)) {
  throw new Error('Account temporarily locked');
}
```

## Input Validation

All handles and DIDs are validated per ATProto specifications.

### Rejected Values (Production)

- `localhost`, `127.0.0.1`, `0.0.0.0`
- `.local`, `.internal`, `.test` TLDs
- Private IP ranges (RFC 1918)

### Validation Functions

```typescript
import { validateHandle, validateDid } from '@olamaelcu/atproto-svelte/server';

// Throws on invalid input
const did = await validateDid(input);
const handle = await validateHandle(input);
```

## OAuth State

State management is delegated to `@atproto/oauth-client-node`, which handles CSRF protection internally.

### Consumer Requirements

- Use a cryptographically secure session store (e.g., encrypted cookies, secure session backend)
- Never expose raw OAuth tokens to client code
- Rotate session identifiers on privilege escalation

## Token Security

### Hashing

Session tokens are hashed with SHA-256 before storage:

```typescript
import { hashToken } from '@olamaelcu/atproto-svelte/server';
const storedHash = hashToken(rawToken);
```

### Signing

Tokens use HMAC-SHA256 with constant-time comparison to prevent timing attacks:

```typescript
import { TokenCodec } from '@olamaelcu/atproto-svelte/server';
const codec = new TokenCodec(secretKey);
```

### Randomness

Session tokens use `crypto.getRandomValues` (CSPRNG) for generation.

## Cookie Security

Configure cookie flags based on your deployment context:

| Flag | Production | Development |
|------|-------------|-------------|
| `httpOnly` | `true` | `true` |
| `secure` | `true` | `false` |
| `sameSite` | `'strict'` | `'lax'` |

### SvelteKit Implementation

```typescript
// hooks.server.ts
cookieOptions: {
  httpOnly: true,
  secure: !dev,
  sameSite: dev ? 'lax' : 'strict',
}
```

## Environment Configuration

Use `validateEnvConfig()` to enforce production safety checks at startup.

### Required Variables

```bash
# Production
ATPROTO_CLIENT_ID=https://yourapp.com
ATPROTO_CLIENT_SECRET=<32+ byte secret>
ATPROTO_SESSION_SECRET=<32+ byte secret>
```

### Validation Rules

When `isDev=false`:
- Rejects `localhost` in `ATPROTO_CLIENT_ID`
- Requires HTTPS endpoints
- Enforces non-empty secrets

### Usage

```typescript
import { validateEnvConfig } from '@olamaelcu/atproto-svelte/server';

validateEnvConfig({
  isDev: process.env.NODE_ENV === 'development',
});
```