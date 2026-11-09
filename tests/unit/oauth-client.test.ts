import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Keyset } from '@atproto/jwk';
import { loadJwk, decodeBase64IfNeeded, createOAuthClient } from '../../src/server/oauth/client.js';
import type { OAuthStateStore, OAuthSessionStore } from '../../src/server/types.js';

function getDevUrl(config: { devHost?: string; devPort?: number }): string {
  const host = config.devHost ?? '127.0.0.1';
  const port = config.devPort ?? 5180;
  return `http://${host}:${port}`;
}

function validateNonDevUrls(config: { isDev: boolean }, rootUrl: string, devCallbackUrl: string): void {
  if (!config.isDev) {
    const localhostPattern = /localhost|127\.0\.0\.1/i;
    if (localhostPattern.test(rootUrl) || localhostPattern.test(devCallbackUrl)) {
      throw new Error(
        'Invalid configuration: production mode cannot use localhost URLs. ' +
        'Set isDev to true or use a proper domain name.'
      );
    }
  }
}

/** Bind a throwaway HTTP server on 127.0.0.1 and report the port it got. */
async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ port: number; close: () => Promise<void> }> {
  const server: Server = createServer(handler);
  const listening = Promise.withResolvers<void>();
  server.listen(0, '127.0.0.1', listening.resolve);
  await listening.promise;

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    port,
    close: () => {
      const closed = Promise.withResolvers<void>();
      server.close(() => closed.resolve());
      return closed.promise;
    },
  };
}

describe('decodeBase64IfNeeded', () => {
  it('should return raw JSON string unchanged', () => {
    const input = '{"kty":"EC"}';
    const result = decodeBase64IfNeeded(input);
    expect(result).toBe('{"kty":"EC"}');
  });

  it('should decode actual base64-encoded JSON', () => {
    const raw = '{"kty":"EC"}';
    const encoded = Buffer.from(raw).toString('base64');
    const result = decodeBase64IfNeeded(encoded);
    expect(result).toBe('{"kty":"EC"}');
  });

  it('should NOT decode pure alphanumeric non-base64 strings', () => {
    const input = 'test';
    const result = decodeBase64IfNeeded(input);
    expect(result).toBe(input);
  });

  it('should decode base64 with padding', () => {
    const raw = '{"kty":"RSA"}';
    const encoded = Buffer.from(raw).toString('base64');
    const result = decodeBase64IfNeeded(encoded);
    expect(result).toBe('{"kty":"RSA"}');
  });
});

describe('getDevUrl', () => {
  it('should return correct URL with valid port', () => {
    const config = { devHost: '127.0.0.1', devPort: 3000 };
    const result = getDevUrl(config);
    expect(result).toBe('http://127.0.0.1:3000');
  });

  it('should use default host and port when not provided', () => {
    const config = {};
    const result = getDevUrl(config);
    expect(result).toBe('http://127.0.0.1:5180');
  });

  it('should use custom host when provided', () => {
    const config = { devHost: 'localhost', devPort: 8080 };
    const result = getDevUrl(config);
    expect(result).toBe('http://localhost:8080');
  });
});

describe('validateNonDevUrls', () => {
  it('should throw for non-dev mode with localhost URL', () => {
    const config = { isDev: false };
    expect(() => validateNonDevUrls(config, 'https://example.com', 'http://127.0.0.1:5180')).toThrow(
      'Invalid configuration: production mode cannot use localhost URLs'
    );
  });

  it('should not throw for dev mode with localhost', () => {
    const config = { isDev: true };
    expect(() => validateNonDevUrls(config, 'http://127.0.0.1:5180', 'http://127.0.0.1:5180')).not.toThrow();
  });

  it('should throw for non-dev mode with 127.0.0.1 in rootUrl', () => {
    const config = { isDev: false };
    expect(() => validateNonDevUrls(config, 'http://127.0.0.1:5180', 'https://example.com')).toThrow(
      'Invalid configuration: production mode cannot use localhost URLs'
    );
  });

  it('should not throw for non-dev mode with proper domain', () => {
    const config = { isDev: false };
    expect(() => validateNonDevUrls(config, 'https://example.com', 'https://example.com')).not.toThrow();
  });
});

describe('loadJwk', () => {
  it('should handle single base64-encoded JWK object', async () => {
    const jwk = { kty: 'EC', crv: 'P-256', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', y: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
    const encoded = Buffer.from(JSON.stringify(jwk)).toString('base64');
    const result = await loadJwk({ oauthJwk: encoded });
    expect(result).toBeInstanceOf(Keyset);
    expect(result!.keys).toHaveLength(1);
    expect(result!.keys[0].jwk.kty).toBe('EC');
  });

  it('should handle base64-encoded JWK array', async () => {
    const jwk = { kty: 'EC', crv: 'P-256', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', y: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
    const encoded = Buffer.from(JSON.stringify([jwk])).toString('base64');
    const result = await loadJwk({ oauthJwk: encoded });
    expect(result).toBeInstanceOf(Keyset);
    expect(result!.keys).toHaveLength(1);
    expect(result!.keys[0].jwk.kty).toBe('EC');
  });

  it('should handle multiple JWKs in base64-encoded array', async () => {
    const jwk1 = { kty: 'EC', crv: 'P-256', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', y: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
    const jwk2 = { kty: 'RSA', n: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', e: 'AQAB' };
    const encoded = Buffer.from(JSON.stringify([jwk1, jwk2])).toString('base64');
    const result = await loadJwk({ oauthJwk: encoded });
    expect(result).toBeInstanceOf(Keyset);
    expect(result!.keys).toHaveLength(2);
  });

  it('should handle oauthJwk as string array', async () => {
    const jwk1 = { kty: 'EC', crv: 'P-256', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', y: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
    const jwk2 = { kty: 'EC', crv: 'P-256', x: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', y: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' };
    const result = await loadJwk({ oauthJwk: [Buffer.from(JSON.stringify(jwk1)).toString('base64'), Buffer.from(JSON.stringify(jwk2)).toString('base64')] });
    expect(result).toBeInstanceOf(Keyset);
    expect(result!.keys).toHaveLength(2);
  });

  it('should throw for JWK missing kty', async () => {
    const invalid = { crv: 'P-256' };
    const encoded = Buffer.from(JSON.stringify(invalid)).toString('base64');
    await expect(loadJwk({ oauthJwk: encoded })).rejects.toThrow('JWK missing required "kty" property');
  });

  it('should return undefined when oauthJwk is undefined', async () => {
    const result = await loadJwk({});
    expect(result).toBeUndefined();
  });

  it('should handle raw JSON JWK array string', async () => {
    const jwk = { kty: 'EC', crv: 'P-256', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', y: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
    const raw = JSON.stringify([jwk]);
    const result = await loadJwk({ oauthJwk: raw });
    expect(result).toBeInstanceOf(Keyset);
    expect(result!.keys).toHaveLength(1);
    expect(result!.keys[0].jwk.kty).toBe('EC');
  });

  it('produces a sign-usage key for a private EC P-256 JWK (regression: do not re-add use:"sig")', async () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateJwk = privateKey.export({ format: 'jwk' }) as { kty: string; crv: string; x: string; y: string; d: string };
    (privateJwk as { kid?: string }).kid = 'test-key-1';
    const encoded = Buffer.from(JSON.stringify(privateJwk)).toString('base64');

    const result = await loadJwk({ oauthJwk: encoded });

    expect(result).toBeInstanceOf(Keyset);
    const signKeys = Array.from(result!.list({ usage: 'sign' }));
    expect(signKeys).toHaveLength(1);
    const [signingKey] = signKeys;
    expect(signingKey.kid).toBe('test-key-1');
    expect((signingKey.jwk as { use?: string }).use).toBeUndefined();
    expect(signingKey.algorithms).toContain('ES256');
  });
});

function createInMemoryStateStore(): OAuthStateStore {
  const map = new Map<string, Uint8Array>();
  return {
    async get(key) {
      return map.get(key);
    },
    async set(key, value) {
      map.set(key, value);
    },
    async del(key) {
      map.delete(key);
    },
  };
}

function createInMemorySessionStore(): OAuthSessionStore {
  const map = new Map<string, unknown>();
  return {
    async get(key) {
      return map.get(key) as never;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async del(key) {
      map.delete(key);
    },
  };
}

describe('createOAuthClient (private_key_jwt)', () => {
  it('constructs without throwing the "active signing key with a kid" error for a private EC P-256 JWK', async () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateJwk = privateKey.export({ format: 'jwk' }) as { kty: string; crv: string; x: string; y: string; d: string };
    (privateJwk as { kid?: string }).kid = 'test-key-1';
    const encoded = Buffer.from(JSON.stringify(privateJwk)).toString('base64');

    await expect(
      createOAuthClient(
        {
          appDomain: 'example.com',
          oauthClientName: 'Test Client',
          oauthScopes: 'atproto',
          oauthJwk: encoded,
          isDev: false,
        },
        {
          stateStore: createInMemoryStateStore(),
          sessionStore: createInMemorySessionStore(),
        },
      ),
    ).resolves.toBeDefined();
  });
});
describe('createOAuthClient (identity resolution)', () => {
  /**
   * A PDS reachable only through a local PLC has to be resolvable by the OAuth
   * client itself: `authorize()` derives the authorization URL from the DID
   * document, so `plcDirectoryUrl` must reach the client, not just the exported
   * `resolveDid` helpers.
   */
  it('resolves the DID document from the configured PLC directory', async () => {
    const did = 'did:plc:l22esprzdf2bljrureroam4a';
    const plcRequests: string[] = [];

    // The PDS is bound first: the document the PLC serves has to name the port
    // the authorization server actually listens on.
    const pds = await startServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          issuer: `http://127.0.0.1:${pds.port}`,
          authorization_endpoint: `http://127.0.0.1:${pds.port}/oauth/authorize`,
          token_endpoint: `http://127.0.0.1:${pds.port}/oauth/token`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          scopes_supported: ['atproto'],
          dpop_signing_alg_values_supported: ['ES256'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
        }),
      );
    });

    const plc = await startServer((req, res) => {
      plcRequests.push(req.url ?? '');
      res.setHeader('content-type', 'application/did+ld+json');
      res.end(
        JSON.stringify({
          id: did,
          alsoKnownAs: ['at://alice.test'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: `http://127.0.0.1:${pds.port}`,
            },
          ],
        }),
      );
    });

    try {
      const { client } = await createOAuthClient(
        {
          appDomain: 'example.com',
          oauthClientName: 'Test Client',
          oauthScopes: 'atproto',
          isDev: true,
          devPort: 5180,
          plcDirectoryUrl: `http://127.0.0.1:${plc.port}`,
          allowHttp: true,
        },
        {
          stateStore: createInMemoryStateStore(),
          sessionStore: createInMemorySessionStore(),
        },
      );

      // `authorize()` only accepts a handle, so the DID path is the resolver
      // the client exposes — the very one `authorize()` uses once a handle has
      // been mapped to a DID.
      const identity = await client.identityResolver.resolve(did);

      // The document came from the configured directory, not plc.directory.
      // The path is percent-encoded (`did%3Aplc%3A…`), so decode before matching.
      expect(decodeURIComponent(plcRequests.join(' '))).toContain(did);
      // ... and the issuer it named is what the client will authorize against.
      expect(identity.didDoc.service?.[0]?.serviceEndpoint).toBe(
        `http://127.0.0.1:${pds.port}`,
      );
    } finally {
      await plc.close();
      await pds.close();
    }
  });
});
