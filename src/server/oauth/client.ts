import {
  atprotoLoopbackClientMetadata,
  NodeOAuthClient,
} from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { Keyset } from "@atproto/jwk";
import type {
  OAuthEnvironmentConfig,
  OAuthStateStore,
  OAuthSessionStore,
  CreateOAuthClientOptions,
  CreateOAuthClientResult,
  NodeSavedSession,
  NodeSavedState,
} from "../types.js";

export function decodeBase64IfNeeded(input: string): string {
  try {
    JSON.parse(input);
    return input;
  } catch {
    try {
      const decoded = Buffer.from(input, "base64").toString("utf-8");
      JSON.parse(decoded);
      return decoded;
    } catch {
      return input;
    }
  }
}

function getDevUrl(config: OAuthEnvironmentConfig): string {
  const host = config.devHost ?? "127.0.0.1";
  const port = config.devPort ?? 5180;
  return `http://${host}:${port}`;
}

function validateNonDevUrls(
  config: OAuthEnvironmentConfig,
  rootUrl: string,
  devCallbackUrl: string,
): void {
  if (!config.isDev) {
    const localhostPattern = /localhost|127\.0\.0\.1/i;
    if (
      localhostPattern.test(rootUrl) ||
      localhostPattern.test(devCallbackUrl)
    ) {
      throw new Error(
        "Invalid configuration: production mode cannot use localhost URLs. " +
          "Set isDev to true or use a proper domain name.",
      );
    }
  }
}

export async function loadJwk(
  config: OAuthEnvironmentConfig,
): Promise<Keyset | undefined> {
  const raw = config.oauthJwk;
  if (!raw) return undefined;
  const json = Array.isArray(raw) ? raw : [raw];
  const decoded = json.map((jwk) => decodeBase64IfNeeded(jwk));
  const parsed = decoded.flatMap((j) => {
    if (typeof j !== "string") return [j];
    try {
      const result = JSON.parse(j);
      return Array.isArray(result) ? result : [result];
    } catch (err) {
      throw new Error(
        `Failed to parse JWK: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  });
  for (const jwk of parsed) {
    if (typeof jwk !== "object" || jwk === null) {
      throw new Error("JWK must be a plain object");
    }
    if (!jwk.kty) {
      throw new Error('JWK missing required "kty" property');
    }
    if (!jwk.kid) {
      throw new Error('JWK missing required "kid" property (Key ID)');
    }
    if (!jwk.crv) {
      throw new Error('JWK missing required "crv" property (curve)');
    }
    const hasCurve = jwk.crv !== undefined;
    const hasRsaParams = jwk.n !== undefined && jwk.e !== undefined;
    if (!hasCurve && !hasRsaParams) {
      throw new Error(
        'JWK must have either "crv" (for EC/symmetric) or "n"/"e" (for RSA)',
      );
    }
  }
  const keys = await Promise.all(parsed.map((jwk) => JoseKey.fromJWK(jwk)));
  for (const key of keys) {
    if (!key.jwk.key_ops) {
      Object.defineProperty(key.jwk, "key_ops", {
        value: ["sign", "verify"],
        enumerable: true,
        writable: false,
      });
    }
  }
  return new Keyset(keys, ["ES256"]);
}

export async function createOAuthClient(
  config: OAuthEnvironmentConfig,
  options: CreateOAuthClientOptions,
): Promise<CreateOAuthClientResult> {
  const isConfidential = config.oauthJwk !== undefined;
  const keys = isConfidential ? await loadJwk(config) : undefined;

  const devCallbackUrl = getDevUrl(config);
  const rootUrl = config.isDev ? devCallbackUrl : `https://${config.appDomain}`;

  if (config.isDev) {
    validateNonDevUrls(config, rootUrl, devCallbackUrl);
  }

  const clientMetadata = config.isDev
    ? atprotoLoopbackClientMetadata(
        `http://localhost?${new URLSearchParams([
          ["redirect_uri", `${devCallbackUrl}/oauth/callback`],
          ["scope", config.oauthScopes],
        ])}`,
      )
    : {
        client_name: config.oauthClientName,
        client_id: `${rootUrl}/oauth-client-metadata.json`,
        client_uri: rootUrl,
        redirect_uris: [`${rootUrl}/oauth/callback`] as [string, ...string[]],
        scope: config.oauthScopes,
        grant_types: ["authorization_code", "refresh_token"] as [
          (
            | "authorization_code"
            | "refresh_token"
            | "implicit"
            | "password"
            | "client_credentials"
            | "urn:ietf:params:oauth:grant-type:jwt-bearer"
            | "urn:ietf:params:oauth:grant-type:saml2-bearer"
          ),
          ...(
            | "authorization_code"
            | "refresh_token"
            | "implicit"
            | "password"
            | "client_credentials"
            | "urn:ietf:params:oauth:grant-type:jwt-bearer"
            | "urn:ietf:params:oauth:grant-type:saml2-bearer"
          )[],
        ],
        application_type: "web" as const,
        token_endpoint_auth_method: (isConfidential
          ? "private_key_jwt"
          : "none") as
          | "none"
          | "private_key_jwt"
          | "client_secret_basic"
          | "client_secret_jwt"
          | "client_secret_post"
          | "self_signed_tls_client_auth"
          | "tls_client_auth",
        token_endpoint_auth_signing_alg: isConfidential ? "ES256" : undefined,
        dpop_bound_access_tokens: true,
        jwks_uri: isConfidential
          ? `${rootUrl}/.well-known/jwks.json`
          : undefined,
        tos_uri: config.oauthTosUri,
        policy_uri: config.oauthPolicyUri,
      };

  const oauthClient = new NodeOAuthClient({
    stateStore: createStateStoreAdapter(options.stateStore),
    sessionStore: createSessionStoreAdapter(options.sessionStore),
    clientMetadata,
    keyset: keys as ConstructorParameters<typeof NodeOAuthClient>[0]["keyset"],
  });

  return {
    client: oauthClient,
    restore: async (did: string) => {
      return oauthClient.restore(did);
    },
  };
}

function createStateStoreAdapter(store: OAuthStateStore): NodeSavedStateStore {
  return {
    async get(key: string): Promise<NodeSavedState | undefined> {
      const value = await store.get(key);
      if (value === undefined) return undefined;
      return JSON.parse(Buffer.from(value).toString("utf-8")) as NodeSavedState;
    },
    async set(key: string, value: NodeSavedState): Promise<void> {
      const encoded = new TextEncoder().encode(JSON.stringify(value));
      await store.set(key, encoded);
    },
    async del(key: string): Promise<void> {
      await store.del(key);
    },
  };
}

function createSessionStoreAdapter(
  store: OAuthSessionStore,
): NodeSavedSessionStore {
  return {
    async get(key: string): Promise<NodeSavedSession | undefined> {
      return store.get(key);
    },
    async set(key: string, value: NodeSavedSession): Promise<void> {
      await store.set(key, value);
    },
    async del(key: string): Promise<void> {
      await store.del(key);
    },
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
