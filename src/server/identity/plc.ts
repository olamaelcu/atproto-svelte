export interface PlcDidDocument {
  id: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyJwk?: {
      kty: string;
      crv: string;
      x: string;
      y?: string;
    };
    publicKeyMultibase?: string;
  }>;
  service: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  alsoKnownAs: string[];
}

export async function fetchDidDocument(did: string, plcDirectoryUrl?: string): Promise<PlcDidDocument> {
  const baseUrl = plcDirectoryUrl ?? 'https://plc.directory';
  const response = await fetch(`${baseUrl}/${encodeURIComponent(did)}`, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch DID document: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<PlcDidDocument>;
}

export async function fetchPdsUrl(did: string, plcDirectoryUrl?: string): Promise<string | null> {
  try {
    const doc = await fetchDidDocument(did, plcDirectoryUrl);
    const pdsService = doc.service.find(
      (s) => s.type === '#atproto_pds' || s.id.endsWith('#atproto_pds')
    );
    return pdsService?.serviceEndpoint ?? null;
  } catch {
    return null;
  }
}

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

export function extractHandleFromAlsoKnownAs(doc: PlcDidDocument): string | null {
  const atHandle = doc.alsoKnownAs.find((alias) => alias.startsWith('at://'));
  if (!atHandle) return null;

  const handle = atHandle.replace('at://', '');
  if (handle.includes('/')) return handle.split('/')[0] ?? handle;
  return handle;
}