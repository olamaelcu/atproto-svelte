import { describe, it, expect } from 'vitest';

function decodeBase64IfNeeded(input: string): string {
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (base64Regex.test(input)) {
    const decoded = Buffer.from(input, 'base64').toString('utf-8');
    try {
      JSON.parse(decoded);
      return decoded;
    } catch {
      return input;
    }
  }
  return input;
}

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