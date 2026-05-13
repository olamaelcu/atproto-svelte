# Security Guidelines

## Rate Limiting

The library includes an in-memory token bucket rate limiter via `rateLimiter()`. Apply it to external operations with these thresholds:

- Handle resolution (DNS): 30 requests per minute
- DID document fetching (PLC): 60 requests per minute
- OAuth authorization endpoints: 10 requests per minute

These thresholds follow the OWASP API Security Guidelines.

```typescript
import { rateLimiter } from '@olamaelcu/atproto-svelte/server';

const limiter = rateLimiter({ maxTokens: 30, intervalMs: 60_000 });
```

## Brute Force Protection

Use `FailedAttemptsTracker` to defend against credential stuffing and session enumeration. Lockout duration scales with failed attempts:

- 3 failed attempts: 15 second lockout
- 5 failed attempts: 1 minute lockout
- 10 failed attempts: 15 minute lockout
- 20+ failed attempts: 1 hour lockout

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

Handles and DIDs are validated per ATProto specifications. The following values are rejected in production:

- localhost, 127.0.0.1, 0.0.0.0
- .local, .internal, .test TLDs
- Private IP ranges (RFC 1918)

```typescript
import { validateHandle, validateDid } from '@olamaelcu/atproto-svelte/server';

// Throws on invalid input
const did = await validateDid(input);
const handle = await validateHandle(input);
```

## OAuth State

State management delegates to `@atproto/oauth-client-node`, which handles CSRF protection internally. Consumer requirements:

- Use a cryptographically secure session store (encrypted cookies or a secure session backend)
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

Configure cookie flags based on your deployment context. In production, set `httpOnly: true`, `secure: true`, and `sameSite: 'strict'`. In development, `httpOnly: true` and `sameSite: 'lax'` are still appropriate but `secure` should be false to work over HTTP.

```typescript
// hooks.server.ts
cookieOptions: {
  httpOnly: true,
  secure: !dev,
  sameSite: dev ? 'lax' : 'strict',
}
```

## Environment Configuration

Use `validateEnvConfig()` to enforce production safety checks at startup. Required variables for production:

```bash
ATPROTO_CLIENT_ID=https://yourapp.com
ATPROTO_CLIENT_SECRET=<32+ byte secret>
ATPROTO_SESSION_SECRET=<32+ byte secret>
```

When `isDev=false`, the validator rejects localhost in `ATPROTO_CLIENT_ID`, requires HTTPS endpoints, and enforces non-empty secrets.

```typescript
import { validateEnvConfig } from '@olamaelcu/atproto-svelte/server';

validateEnvConfig({
  isDev: process.env.NODE_ENV === 'development',
});
```