import type { OAuthEnvironmentConfig } from '../types.js';

/**
 * Validates the OAuth environment configuration.
 * Throws an AggregateError if any validation fails, listing all errors.
 */
export function validateEnvConfig(config: OAuthEnvironmentConfig): void {
  const errors: string[] = [];

  if (!config.appDomain?.trim()) {
    errors.push('appDomain is required and must be a non-empty string');
  }
  if (!config.oauthClientName?.trim()) {
    errors.push('oauthClientName is required and must be a non-empty string');
  }
  if (!config.oauthScopes?.trim()) {
    errors.push('oauthScopes is required and must be a non-empty string');
  }

  if (config.appDomain) {
    const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(config.appDomain)) {
      errors.push(`appDomain "${config.appDomain}" is not a valid domain format`);
    }
  }

  if (!config.isDev) {
    const localhostPatterns = [/localhost$/i, /127\.0\.0\.1$/];

    if (config.appDomain) {
      if (localhostPatterns.some((pattern) => pattern.test(config.appDomain))) {
        errors.push('appDomain cannot contain localhost or 127.0.0.1 in production');
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

export function loadEnvConfig(overrides?: Partial<OAuthEnvironmentConfig>): OAuthEnvironmentConfig {
  const config: OAuthEnvironmentConfig = {
    appDomain: process.env.APP_DOMAIN ?? '',
    oauthClientName: process.env.OAUTH_CLIENT_NAME ?? '',
    oauthScopes: process.env.OAUTH_SCOPES ?? '',
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

  if (overrides) {
    Object.assign(config, overrides);
  }

  validateEnvConfig(config);

  return config;
}