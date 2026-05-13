import { atprotoLoopbackClientMetadata, NodeOAuthClient } from '@atproto/oauth-client-node';
import { JoseKey } from '@atproto/jwk-jose';
import { Keyset } from '@atproto/jwk';
import type {
  OAuthEnvironmentConfig,
  OAuthStateStore,
  OAuthSessionStore,
  ServiceUrlStore,
  CreateOAuthClientOptions,
  CreateOAuthClientResult,
  NodeSavedSession,
  NodeSavedState
} from '../types.js';
import { base32 } from '@oslojs/encoding';
import { createHmac, createHash } from 'crypto';

interface ServiceUrlStoreOps {
  getServiceUrl(key: string): Promise<string | undefined>;
  setServiceUrl(key: string, url: string): Promise<void>;
  takeServiceUrl(key: string): Promise<string | undefined>;
}

function decodeBase64IfNeeded(input: string): string {
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (base64Regex.test(input)) {
    const decoded = Buffer.from(input, 'base64').toString('utf-8');
    return decoded;
  }
  return input;
}

function getDevUrl(config: OAuthEnvironmentConfig): string {
  const host = config.devHost ?? '127.0.0.1';
  const port = config.devPort ?? 5180;
  return `http://${host}:${port}`;
}

function validateNonDevUrls(config: OAuthEnvironmentConfig, rootUrl: string, devCallbackUrl: string): void {
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

async function loadJwk(config: OAuthEnvironmentConfig): Promise<Keyset | undefined> {
  const raw = config.oauthJwk;
  if (!raw) return undefined;
  const json = Array.isArray(raw) ? raw : [raw];
  const decoded = json.map((jwk) => decodeBase64IfNeeded(jwk));
  const parsed = decoded.map((j) => {
    if (typeof j !== 'string') return j;
    try {
      return JSON.parse(j);
    } catch (err) {
      throw new Error(`Failed to parse JWK: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  // Validate JWK structure
  for (const jwk of parsed) {
    if (typeof jwk !== 'object' || jwk === null) {
      throw new Error('JWK must be a plain object');
    }
    if (!jwk.kty) {
      throw new Error('JWK missing required "kty" property');
    }
    const hasCurve = jwk.crv !== undefined;
    const hasRsaParams = jwk.n !== undefined && jwk.e !== undefined;
    if (!hasCurve && !hasRsaParams) {
      throw new Error('JWK must have either "crv" (for EC/symmetric) or "n"/"e" (for RSA)');
    }
  }
  const keys = await Promise.all(parsed.map((jwk) => JoseKey.fromJWK(jwk)));
  for (const key of keys) {
    Object.defineProperty(key.jwk, 'use', { value: 'sig', enumerable: true, writable: false });
  }
  return new Keyset(keys, ['ES256']);
}

export async function createOAuthClient(
  config: OAuthEnvironmentConfig,
  options: CreateOAuthClientOptions
): Promise<CreateOAuthClientResult> {
  const isConfidential = config.oauthJwk !== undefined;
  const keys = isConfidential ? await loadJwk(config) : undefined;

  const devCallbackUrl = getDevUrl(config);
  const rootUrl = config.isDev ? devCallbackUrl : `https://${config.oauthDomain}`;

  validateNonDevUrls(config, rootUrl, devCallbackUrl);

  const clientMetadata = config.isDev
    ? atprotoLoopbackClientMetadata(
        `http://localhost?${new URLSearchParams([
          ['redirect_uri', `${devCallbackUrl}/oauth/callback`],
          ['scope', config.oauthScopes]
        ])}`
      )
    : {
        client_name: config.oauthClientName,
        client_id: `${rootUrl}/oauth-client-metadata.json`,
        client_uri: rootUrl,
        redirect_uris: [`${rootUrl}/oauth/callback`],
        scope: config.oauthScopes,
        grant_types: ['authorization_code', 'refresh_token'] as const,
        application_type: 'web' as const,
        token_endpoint_auth_method: isConfidential ? 'private_key_jwt' : 'none',
        token_endpoint_auth_signing_alg: isConfidential ? 'ES256' : undefined,
        dpop_bound_access_tokens: true,
        jwks_uri: isConfidential ? `${rootUrl}/.well-known/jwks.json` : undefined,
        tos_uri: config.oauthTosUri,
        policy_uri: config.oauthPolicyUri
      };

  const oauthClient = new NodeOAuthClient({
    stateStore: createStateStoreAdapter(options.stateStore),
    sessionStore: createSessionStoreAdapter(options.sessionStore, options.serviceUrlStore),
    clientMetadata,
    keyset: keys
  });

  return {
    client: oauthClient,
    restore: async (did: string) => {
      return oauthClient.restore(did);
    }
  };
}

function createStateStoreAdapter(store: OAuthStateStore): NodeSavedStateStore {
  return {
    async get(key: string): Promise<NodeSavedState | undefined> {
      const value = await store.get(key);
      if (value === undefined) return undefined;
      return JSON.parse(Buffer.from(value).toString('utf-8')) as NodeSavedState;
    },
    async set(key: string, value: NodeSavedState): Promise<void> {
      const encoded = new TextEncoder().encode(JSON.stringify(value));
      await store.set(key, encoded);
    },
    async del(key: string): Promise<void> {
      await store.del(key);
    }
  };
}

function createSessionStoreAdapter(
  store: OAuthSessionStore,
  serviceUrlStore?: ServiceUrlStore
): NodeSavedSessionStore {
  const serviceUrlOps: ServiceUrlStoreOps | undefined = serviceUrlStore
    ? {
        getServiceUrl: (key) => serviceUrlStore.getServiceUrl(key),
        setServiceUrl: (key, url) => serviceUrlStore.setServiceUrl(key, url),
        takeServiceUrl: (key) => serviceUrlStore.takeServiceUrl(key)
      }
    : undefined;

  return {
    async get(key: string): Promise<NodeSavedSession | undefined> {
      return store.get(key);
    },
    async set(key: string, value: NodeSavedSession): Promise<void> {
      await store.set(key, value);
    },
    async del(key: string): Promise<void> {
      await store.del(key);
    }
  };
}

type NodeSavedStateStore = {
  get(key: string): Promise<NodeSavedState | undefined>;
  set(key: string, value: NodeSavedState): Promise<void>;
  del(key: string): Promise<void>;
};

type NodeSavedSessionStore = {
  get(key: string): Promise<NodeSavedSession | undefined>;
  set(key: string, value: NodeSavedSession): Promise<void>;
  del(key: string): Promise<void>;
};