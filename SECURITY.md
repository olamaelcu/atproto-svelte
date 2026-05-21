# Security Guidelines

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
import { TokenCodec } from '@olamaelcu/atproto-svelte/server';
const codec = new TokenCodec(secretKey);
const storedHash = codec.hash(token);
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

Use `validateEnvConfig()` to enforce production safety checks at startup. Required variables:

### Required

```bash
OAUTH_DOMAIN=https://yourapp.com        # Your domain for OAuth (e.g., bsky.app)
OAUTH_CLIENT_NAME=My App               # Display name for the OAuth client
OAUTH_SCOPES=atproto transition:generic # OAuth scopes
```

### Optional

```bash
OAUTH_JWK=<base64 encoded JWK>          # Private key for signed requests
OAUTH_TOS_URI=https://yourapp.com/tos   # Terms of Service URI
OAUTH_POLICY_URI=https://yourapp.com/policy # Privacy Policy URI
FALLBACK_DID=did:plc:optional           # Fallback DID if resolution fails
FALLBACK_DOMAIN=yourapp.com            # Fallback domain
PLC_DIRECTORY_URL=https://plc.directory # PLC directory URL (default: https://plc.directory)
PUBLIC_API_URL=https://api.yourapp.com # Public API URL for reference resolution
DEV_HOST=localhost                     # Development host
DEV_PORT=3000                          # Development port
```

### Session Secret

The session secret is passed directly to `TokenCodec` and `SessionManager`, not via environment variable:

```typescript
import { createSessionManager } from '@olamaelcu/atproto-svelte/server';

const sessionManager = createSessionManager({
  // ...
  tokenConfig: {
    secret: process.env.SESSION_SECRET,  // 32+ byte secret
    expiryMs: 30 * 24 * 60 * 60 * 1000,
    renewalThresholdMs: 15 * 24 * 60 * 60 * 1000
  }
});
```

### Production Safety

When `isDev=false`, the validator rejects:
- localhost or 127.0.0.1 in `OAUTH_DOMAIN`
- Non-HTTPS endpoints (unless `NODE_ENV=development`)
- Missing required variables

```typescript
import { loadEnvConfig } from '@olamaelcu/atproto-svelte/server';

// Validates and loads config, throws on invalid config in production
const config = loadEnvConfig();
```