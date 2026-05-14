import { resolveTxt } from 'dns';
import { fetchDidDocument, extractSigningKey, extractHandleFromAlsoKnownAs, type PlcDidDocument } from './plc.js';
import type { Identity } from '../../types/index.js';
import { DEFAULT_PLC_DIRECTORY_URL } from '../constants.js';

/**
 * Resolve a handle to an Identity.
 *
 * @param handle - The handle to resolve (e.g., 'alice.bsky.social' or 'did:plc:abc123')
 * @param plcDirectoryUrl - Optional PLC directory URL (defaults to 'https://plc.directory')
 * @returns The resolved Identity including DID, PDS URL, and signing key
 * @throws Error if resolution fails via both DNS TXT and .well-known methods
 *
 * @remarks
 * Resolution order:
 * 1. If handle is a DID, skip to PLC directory lookup
 * 2. Try DNS TXT record at `_atproto.{domain}`
 * 3. Fall back to HTTPS `/.well-known/atproto-did`
 *
 * @example
 * ```ts
 * const identity = await resolveHandle('alice.bsky.social');
 * console.log(identity.did); // did:plc:abc123...
 * ```
 */
export async function resolveHandle(handle: string, plcDirectoryUrl?: string): Promise<Identity> {
  const domain = handle.startsWith('did:') ? null : handle;

  let did: string | null = null;

  if (domain) {
    did = await resolveTxtRecord(domain);
  }

  if (!did) {
    did = await resolveWellKnown(handle);
  }

  if (!did) {
    throw new Error(`Failed to resolve handle: ${handle}`);
  }

  return resolveDid(did, plcDirectoryUrl);
}

async function resolveTxtRecord(domain: string): Promise<string | null> {
  return new Promise((resolve) => {
    resolveTxt(`_atproto.${domain}`, (err, records) => {
      if (err || !records) {
        resolve(null);
        return;
      }

      for (const record of records) {
        for (const txt of record) {
          if (txt.startsWith('did=')) {
            resolve(txt.slice(4));
            return;
          }
        }
      }

      resolve(null);
    });
  });
}

async function resolveWellKnown(handle: string): Promise<string | null> {
  try {
    const url = handle.startsWith('https://') ? handle : `https://${handle}`;
    const wellKnownUrl = `${url}/.well-known/atproto-did`;

    const response = await fetch(wellKnownUrl, {
      headers: {
        Accept: 'text/plain'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    const trimmed = text.trim();

    if (trimmed.startsWith('did:')) {
      return trimmed;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a DID to an Identity using the PLC directory.
 *
 * @param did - The DID to resolve (e.g., 'did:plc:abc123')
 * @param plcDirectoryUrl - Optional PLC directory URL (defaults to 'https://plc.directory')
 * @returns The resolved Identity with PDS URL, signing key, and handle
 *
 * @remarks
 * Fetches the DID document from the PLC directory and extracts:
 * - PDS URL from service endpoints
 * - Signing key from verification methods
 * - Handle from alsoKnownAs (if set)
 *
 * @example
 * ```ts
 * const identity = await resolveDid('did:plc:abc123');
 * console.log(identity.pdsUrl, identity.signingKey);
 * ```
 */
export async function resolveDid(did: string, plcDirectoryUrl?: string): Promise<Identity> {
  const doc = await fetchDidDocument(did, plcDirectoryUrl ?? DEFAULT_PLC_DIRECTORY_URL);

  const pdsUrl = extractPdsUrl(doc);
  const signingKey = extractSigningKey(doc);
  const handle = extractHandleFromAlsoKnownAs(doc);

  return {
    did,
    handle,
    pdsUrl,
    signingKey,
    isVerified: false
  };
}

function extractPdsUrl(doc: PlcDidDocument): string | null {
  const pdsService = doc.service.find(
    (s) => s.type === '#atproto_pds' || s.id.endsWith('#atproto_pds')
  );
  return pdsService?.endpoint ?? null;
}

/**
 * Resolve any identifier (handle or DID) to an Identity.
 *
 * @param identifier - Either a handle (e.g., 'alice.bsky.social') or DID
 * @param plcDirectoryUrl - Optional PLC directory URL (defaults to 'https://plc.directory')
 * @returns The resolved Identity
 *
 * @remarks
 * Automatically detects whether the identifier is a DID or handle
 * and routes to the appropriate resolution method.
 *
 * @example
 * ```ts
 * const identity = await resolveIdentity('alice.bsky.social');
 * // or
 * const identity = await resolveIdentity('did:plc:abc123');
 * ```
 */
export async function resolveIdentity(identifier: string, plcDirectoryUrl?: string): Promise<Identity> {
  if (identifier.startsWith('did:')) {
    return resolveDid(identifier, plcDirectoryUrl ?? DEFAULT_PLC_DIRECTORY_URL);
  }
  return resolveHandle(identifier, plcDirectoryUrl ?? DEFAULT_PLC_DIRECTORY_URL);
}

/**
 * Verify a bidirectional handle↔DID link.
 *
 * @param handle - The handle to verify
 * @param did - The DID to verify against
 * @param plcDirectoryUrl - Optional PLC directory URL (defaults to 'https://plc.directory')
 * @returns True if the handle is verified by the DID and vice versa
 *
 * @remarks
 * This performs bidirectional verification:
 * 1. Resolves the handle and checks if its DID matches the provided DID
 * 2. Resolves the DID and checks if its handle matches the provided handle
 *
 * Both conditions must be true for verification to pass.
 * Comparison is case-insensitive.
 *
 * @example
 * ```ts
 * const verified = await verifyBidirectional('alice.bsky.social', 'did:plc:abc123');
 * if (verified) {
 *   // Alice's identity is cryptographically verified
 * }
 * ```
 */
export async function verifyBidirectional(handle: string, did: string, plcDirectoryUrl?: string): Promise<boolean> {
  try {
    const handleIdentity = await resolveHandle(handle, plcDirectoryUrl ?? DEFAULT_PLC_DIRECTORY_URL);
    if (handleIdentity.did !== did) {
      return false;
    }

    const didIdentity = await resolveDid(did, plcDirectoryUrl ?? DEFAULT_PLC_DIRECTORY_URL);
    if (!didIdentity.handle) {
      return false;
    }

    const normalizedHandle = handle.toLowerCase();
    const normalizedDidHandle = didIdentity.handle.toLowerCase();

    return normalizedHandle === normalizedDidHandle;
  } catch {
    return false;
  }
}