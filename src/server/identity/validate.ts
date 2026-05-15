export interface Result<T = void> {
  valid: boolean;
  error?: string;
  value?: T;
}

const RESERVED_TLDS = new Set([
  'alt',
  'arpa',
  'example',
  'internal',
  'invalid',
  'local',
  'localhost',
  'onion',
]);

const SUPPORTED_DID_METHODS = ['plc', 'web', 'key'] as const;
type DidMethod = (typeof SUPPORTED_DID_METHODS)[number];

export const MAX_HANDLE_LENGTH = 253;

export const MAX_DID_LENGTH = 2048;

export function validateHandle(handle: string): Result<string> {
  if (!handle || typeof handle !== 'string') {
    return { valid: false, error: 'Handle cannot be empty' };
  }

  if (handle.length > MAX_HANDLE_LENGTH) {
    return { valid: false, error: `Handle exceeds maximum length of ${MAX_HANDLE_LENGTH} characters` };
  }

  const normalizedHandle = handle.toLowerCase();

  const segments = normalizedHandle.split('.');

  if (segments.length < 2) {
    return { valid: false, error: 'Handle must have at least two segments (domain.tld)' };
  }

  const tld = segments[segments.length - 1];
  if (!tld || tld.length === 0) {
    return { valid: false, error: 'TLD cannot be empty' };
  }

  if (/^\d/.test(tld)) {
    return { valid: false, error: 'TLD cannot start with a digit' };
  }

  if (RESERVED_TLDS.has(tld)) {
    return { valid: false, error: `TLD (.${tld}) is reserved and cannot be used` };
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (!segment || segment.length === 0) {
      return { valid: false, error: 'Segment cannot be empty' };
    }

    if (segment.startsWith('-')) {
      return { valid: false, error: 'Segment cannot start with a hyphen' };
    }

    if (segment.endsWith('-')) {
      return { valid: false, error: 'Segment cannot end with a hyphen' };
    }

    if (!/^[a-z0-9-]+$/.test(segment)) {
      return { valid: false, error: 'Segment can only contain alphanumeric characters and hyphens' };
    }
  }

  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(normalizedHandle)) {
    return { valid: false, error: 'IP address handles are not allowed' };
  }

  if (normalizedHandle.includes(':')) {
    return { valid: false, error: 'IP address handles are not allowed' };
  }

  return { valid: true, value: normalizedHandle };
}

export function validateDid(did: string): Result<string> {
  if (!did || typeof did !== 'string') {
    return { valid: false, error: 'DID cannot be empty' };
  }

  if (did.length > MAX_DID_LENGTH) {
    return { valid: false, error: `DID exceeds maximum length of ${MAX_DID_LENGTH} characters` };
  }

  const didPattern = /^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/;
  if (!didPattern.test(did)) {
    return { valid: false, error: 'DID format is invalid' };
  }

  const method = did.split(':')[1] as DidMethod;

  if (!SUPPORTED_DID_METHODS.includes(method)) {
    return {
      valid: false,
      error: `DID method (.${method}) is not supported. Supported methods: ${SUPPORTED_DID_METHODS.join(', ')}`,
    };
  }

  if (method === 'web') {
    const path = did.slice('did:web:'.length);

    const normalizedPath = path.toLowerCase();
    if (normalizedPath.includes('localhost')) {
      return { valid: false, error: 'did:web does not support localhost in production' };
    }

    if (!path || path.length === 0) {
      return { valid: false, error: 'did:web must have a path component' };
    }
  }

  if (method === 'key') {
    const keyData = did.slice('did:key:'.length);

    if (!keyData.startsWith('z')) {
      return { valid: false, error: 'did:key must start with did:key:z followed by base58 encoding' };
    }

    if (keyData.length < 2) {
      return { valid: false, error: 'did:key must have a valid key value' };
    }
  }

  if (method === 'plc') {
    const path = did.slice('did:plc:'.length);

    if (!/^[a-zA-Z0-9]+$/.test(path)) {
      return { valid: false, error: 'did:plc must contain only alphanumeric characters' };
    }
  }

  return { valid: true, value: did };
}

export function validateIdentity(identifier: string): Result<string> {
  if (!identifier || typeof identifier !== 'string') {
    return { valid: false, error: 'Identifier cannot be empty' };
  }

  if (identifier.toLowerCase().startsWith('did:')) {
    return validateDid(identifier);
  }

  return validateHandle(identifier);
}