import { describe, it, expect } from 'vitest';
import { Keyset } from '@atproto/jwk';
import { loadJwk, decodeBase64IfNeeded } from '../../src/server/oauth/client.js';

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
});