/**
 * PLC Directory Operations
 *
 * Provides functions for fetching and parsing DID documents from the
 * PLC (Personal Logic Controller) directory. The PLC directory is the
 * authoritative source for ATProto identity information.
 */

/**
 * DID document returned from the PLC directory.
 *
 * @remarks
 * Contains verification methods, service endpoints, and alsoKnownAs entries
 * for an ATProto identity. This structure is fetched from the PLC directory
 * when resolving DIDs to their associated metadata.
 *
 * @example
 * ```ts
 * const doc: PlcDidDocument = await fetchDidDocument('did:plc:abc123');
 * const pdsUrl = doc.service.find(s => s.type === '#atproto_pds')?.endpoint;
 * ```
 */
export interface PlcDidDocument {
  /** The DID this document represents (e.g., 'did:plc:abc123') */
  id: string;
  /** Verification methods for cryptographic operations */
  verificationMethod: Array<{
    /** Full verification method ID (e.g., 'did:plc:abc123#atproto') */
    id: string;
    /** Verification method type (e.g., 'Multikey' or 'EcdsaSecp256k1RecoveryMethod') */
    type: string;
    /** Controller of this verification method (usually the DID itself) */
    controller: string;
    /** JSON Web Key for public key operations */
    publicKeyJwk?: {
      /** Key type (e.g., 'OKP' for Ed25519) */
      kty: string;
      /** Curve (e.g., 'Ed25519') */
      crv: string;
      /** Base64url-encoded public key bytes */
      x: string;
      /** Optional y coordinate for EC keys */
      y?: string;
    };
    /** Multibase-encoded public key (alternative to JWK) */
    publicKeyMultibase?: string;
  }>;
  /** Service endpoints including the ATProto PDS */
  service: Array<{
    /** Full service ID */
    id: string;
    /** Service type (e.g., '#atproto_pds') */
    type: string;
    /** Endpoint URL */
    endpoint: string;
  }>;
  /** Alternative identifiers, including 'at://' handle URLs */
  alsoKnownAs: string[];
}

/**
 * Fetch a DID document from the PLC directory.
 *
 * @param did - The DID to fetch (e.g., 'did:plc:abc123')
 * @param plcDirectoryUrl - Optional PLC directory URL (defaults to 'https://plc.directory')
 * @returns The DID document with verification methods and service endpoints
 * @throws Error if the fetch fails or the response is not OK
 *
 * @remarks
 * Fetches the DID document from the PLC directory, which serves as the
 * authoritative source for PLC identities (did:plc). The document contains
 * verification methods for cryptographic operations and service endpoints
 * for locating the user's PDS.
 *
 * @example
 * ```ts
 * const doc = await fetchDidDocument('did:plc:abc123');
 * const pds = doc.service.find(s => s.type === '#atproto_pds');
 * console.log(pds?.endpoint); // 'https://bsky.social'
 * ```
 */
export async function fetchDidDocument(did: string, plcDirectoryUrl?: string): Promise<PlcDidDocument> {
  const baseUrl = plcDirectoryUrl ?? 'https://plc.directory';
  const response = await fetch(`${baseUrl}/${did}`, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch DID document: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<PlcDidDocument>;
}

/**
 * Fetch the PDS (Personal Data Server) URL for a DID.
 *
 * @param did - The DID to look up (e.g., 'did:plc:abc123')
 * @param plcDirectoryUrl - Optional PLC directory URL (defaults to 'https://plc.directory')
 * @returns The PDS URL if found, null otherwise
 *
 * @remarks
 * Extracts the ATProto PDS service endpoint from the DID document.
 * The PDS is where the user's data is hosted and is needed for
 * making authenticated API calls.
 *
 * @example
 * ```ts
 * const pdsUrl = await fetchPdsUrl('did:plc:abc123');
 * if (pdsUrl) {
 *   console.log(`User's PDS: ${pdsUrl}`);
 * }
 * ```
 */
export async function fetchPdsUrl(did: string, plcDirectoryUrl?: string): Promise<string | null> {
  try {
    const doc = await fetchDidDocument(did, plcDirectoryUrl);
    const pdsService = doc.service.find(
      (s) => s.type === '#atproto_pds' || s.id.endsWith('#atproto_pds')
    );
    return pdsService?.endpoint ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract the signing key from a DID document.
 *
 * @param doc - The DID document to extract from
 * @returns The signing key as a did:key string, or null if not found
 *
 * @remarks
 * Searches for the ATProto verification method (typically ending in '#atproto')
 * and converts the public key to did:key format. Supports both JWK (Ed25519)
 * and multibase-encoded keys.
 *
 * @example
 * ```ts
 * const doc = await fetchDidDocument('did:plc:abc123');
 * const signingKey = extractSigningKey(doc);
 * console.log(signingKey); // 'did:key:z...' or null
 * ```
 */
export function extractSigningKey(doc: PlcDidDocument): string | null {
  const vm = doc.verificationMethod.find(
    (m) => m.id.endsWith('#atproto') || m.id.includes('/atproto')
  );

  if (!vm) return null;

  if (vm.publicKeyJwk) {
    const { kty, crv, x } = vm.publicKeyJwk;
    if (kty === 'OKP' && crv === 'Ed25519' && x) {
      return `did:key:z${x}`;
    }
  }

  if (vm.publicKeyMultibase) {
    return `did:key:${vm.publicKeyMultibase}`;
  }

  return null;
}

/**
 * Extract the handle from the alsoKnownAs field of a DID document.
 *
 * @param doc - The DID document to extract from
 * @returns The handle string without the 'at://' prefix, or null if not found
 *
 * @remarks
 * Parses the alsoKnownAs array to find the 'at://' handle URL and extracts
 * the handle portion. If the handle contains a path, only the host portion
 * is returned (everything before the first '/').
 *
 * @example
 * ```ts
 * const doc = await fetchDidDocument('did:plc:abc123');
 * const handle = extractHandleFromAlsoKnownAs(doc);
 * console.log(handle); // 'alice.bsky.social' or null
 * ```
 */
export function extractHandleFromAlsoKnownAs(doc: PlcDidDocument): string | null {
  const atHandle = doc.alsoKnownAs.find((alias) => alias.startsWith('at://'));
  if (!atHandle) return null;

  const handle = atHandle.replace('at://', '');
  if (handle.includes('/')) return handle.split('/')[0];
  return handle;
}