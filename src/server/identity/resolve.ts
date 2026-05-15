import { resolveTxt } from 'dns';
import { fetchDidDocument, extractSigningKey, extractHandleFromAlsoKnownAs, type PlcDidDocument } from './plc.js';
import type { Identity } from '../../types/index.js';
import { DEFAULT_PLC_DIRECTORY_URL } from '../constants.js';

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

export async function resolveIdentity(identifier: string, plcDirectoryUrl?: string): Promise<Identity> {
  if (identifier.startsWith('did:')) {
    return resolveDid(identifier, plcDirectoryUrl ?? DEFAULT_PLC_DIRECTORY_URL);
  }
  return resolveHandle(identifier, plcDirectoryUrl ?? DEFAULT_PLC_DIRECTORY_URL);
}

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