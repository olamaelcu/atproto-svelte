import type { OAuthEnvironmentConfig } from '../types.js';

/**
 * Validates the OAuth environment configuration.
 * Throws an AggregateError if any validation fails, listing all errors.
 */
export function validateEnvConfig(config: OAuthEnvironmentConfig): void {
  const errors: string[] = [];

  if (!config.oauthDomain?.trim()) {
    errors.push('oauthDomain is required and must be a non-empty string');
  }
  if (!config.oauthClientName?.trim()) {
    errors.push('oauthClientName is required and must be a non-empty string');
  }
  if (!config.oauthScopes?.trim()) {
    errors.push('oauthScopes is required and must be a non-empty string');
  }
  if (!config.pdsUrl?.trim()) {
    errors.push('pdsUrl is required and must be a non-empty string');
  }

  if (config.oauthDomain) {
    const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(config.oauthDomain)) {
      errors.push(`oauthDomain "${config.oauthDomain}" is not a valid domain format`);
    }
  }

  if (config.pdsUrl) {
    let url: URL | null = null;
    try {
      url = new URL(config.pdsUrl);
    } catch {
      errors.push(`pdsUrl "${config.pdsUrl}" is not a valid URL`);
    }

    if (url && url.protocol !== 'https:') {
      if (!config.isDev) {
        errors.push('pdsUrl must use https protocol in production');
      }
    }
  }

  if (!config.isDev) {
    const localhostPatterns = [/localhost$/i, /127\.0\.0\.1$/];

    if (config.pdsUrl) {
      try {
        const url = new URL(config.pdsUrl);
        const host = url.hostname;
        if (localhostPatterns.some((pattern) => pattern.test(host))) {
          errors.push('pdsUrl cannot contain localhost or 127.0.0.1 in production');
        }
      } catch (_) {
        void _;
      }
    }

    if (config.oauthDomain) {
      if (localhostPatterns.some((pattern) => pattern.test(config.oauthDomain))) {
        errors.push('oauthDomain cannot contain localhost or 127.0.0.1 in production');
      }
    }
  }

  if (config.oauthJwk !== undefined) {
    const jwks = Array.isArray(config.oauthJwk) ? config.oauthJwk : [config.oauthJwk];
    for (let i = 0; i < jwks.length; i++) {
      const jwk = jwks[i];
      if (typeof jwk !== 'string' || jwk.trim() === '') {
        errors.push(`oauthJwk[${i}] must be a non-empty base64 encoded string`);
      } else {
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        if (!base64Regex.test(jwk)) {
          errors.push(`oauthJwk[${i}] is not a valid base64 encoded string`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(
      errors.map((e) => new Error(e)),
      `OAuth environment configuration validation failed:\n${errors.join('\n')}`
    );
  }
}

export function loadEnvConfig(): OAuthEnvironmentConfig {
  const config: OAuthEnvironmentConfig = {
    oauthDomain: process.env.OAUTH_DOMAIN ?? '',
    oauthClientName: process.env.OAUTH_CLIENT_NAME ?? '',
    oauthScopes: process.env.OAUTH_SCOPES ?? '',
    pdsUrl: process.env.PDS_URL ?? '',
    isDev: process.env.NODE_ENV === 'development',
  };

  if (process.env.OAUTH_JWK) {
    config.oauthJwk = process.env.OAUTH_JWK;
  }
  if (process.env.OAUTH_TOS_URI) {
    config.oauthTosUri = process.env.OAUTH_TOS_URI;
  }
  if (process.env.OAUTH_POLICY_URI) {
    config.oauthPolicyUri = process.env.OAUTH_POLICY_URI;
  }
  if (process.env.FALLBACK_DID) {
    config.fallbackDid = process.env.FALLBACK_DID;
  }
  if (process.env.FALLBACK_DOMAIN) {
    config.fallbackDomain = process.env.FALLBACK_DOMAIN;
  }
  if (process.env.DEV_HOST) {
    config.devHost = process.env.DEV_HOST;
  }
  if (process.env.DEV_PORT) {
    config.devPort = parseInt(process.env.DEV_PORT, 10);
    if (isNaN(config.devPort)) throw new Error('DEV_PORT must be a number');
  }
  if (process.env.PLC_DIRECTORY_URL) {
    config.plcDirectoryUrl = process.env.PLC_DIRECTORY_URL;
  }
  if (process.env.PUBLIC_API_URL) {
    config.publicApiUrl = process.env.PUBLIC_API_URL;
  }

  validateEnvConfig(config);

  return config;
}