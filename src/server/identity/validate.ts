/**
 * ATProto Identity Validation
 *
 * Implements ATProto-compliant Handle and DID validation per the
 * specification requirements for identity verification.
 */

/**
 * Result type for validation operations.
 *
 * @template T - The type of the validated value (e.g., string for handles/DIDs)
 */
export interface Result<T = void> {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** The validated and normalized value if validation passed */
  value?: T;
}

// Reserved TLDs that should not be used in handles
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

// Supported DID methods
const SUPPORTED_DID_METHODS = ['plc', 'web', 'key'] as const;
type DidMethod = (typeof SUPPORTED_DID_METHODS)[number];

/**
 * Maximum length for handles per ATProto spec
 */
export const MAX_HANDLE_LENGTH = 253;

/**
 * Maximum length for DIDs per ATProto spec
 */
export const MAX_DID_LENGTH = 2048;

/**
 * Validates a handle per ATProto RFC.
 *
 * @param handle - The handle string to validate
 * @returns Result with validated handle (normalized to lowercase) or error
 *
 * @remarks
 * Requirements:
 * - Max length 253 characters
 * - RFC-compliant domain structure with dots
 * - No reserved TLDs (.alt, .arpa, .example, .internal, .invalid, .local, .localhost, .onion)
 * - No IP addresses (reject handles that look like IPv4/IPv6)
 * - Segments cannot start or end with hyphens
 * - TLD cannot start with a digit
 * - Case-insensitive, returns normalized lowercase
 *
 * @returns The validated handle string (normalized to lowercase) if valid
 */
export function validateHandle(handle: string): Result<string> {
  // Check empty input
  if (!handle || typeof handle !== 'string') {
    return { valid: false, error: 'Handle cannot be empty' };
  }

  // Check length constraint
  if (handle.length > MAX_HANDLE_LENGTH) {
    return { valid: false, error: `Handle exceeds maximum length of ${MAX_HANDLE_LENGTH} characters` };
  }

  // Normalize to lowercase for comparison and return
  const normalizedHandle = handle.toLowerCase();

  // Split into domain segments
  const segments = normalizedHandle.split('.');

  // Must have at least 2 segments (subdomain TLD)
  if (segments.length < 2) {
    return { valid: false, error: 'Handle must have at least two segments (domain.tld)' };
  }

  // Validate TLD (last segment)
  const tld = segments[segments.length - 1];
  if (!tld || tld.length === 0) {
    return { valid: false, error: 'TLD cannot be empty' };
  }

  // Check TLD doesn't start with digit (RFC 1123)
  if (/^\d/.test(tld)) {
    return { valid: false, error: 'TLD cannot start with a digit' };
  }

  // Check TLD is not reserved
  if (RESERVED_TLDS.has(tld)) {
    return { valid: false, error: `TLD (.${tld}) is reserved and cannot be used` };
  }

  // Validate each segment
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (!segment || segment.length === 0) {
      return { valid: false, error: 'Segment cannot be empty' };
    }

    // Segment cannot start with hyphen (RFC 952)
    if (segment.startsWith('-')) {
      return { valid: false, error: 'Segment cannot start with a hyphen' };
    }

    // Segment cannot end with hyphen (RFC 1123)
    if (segment.endsWith('-')) {
      return { valid: false, error: 'Segment cannot end with a hyphen' };
    }

    // Segment can only contain alphanumeric characters and hyphens
    if (!/^[a-z0-9-]+$/.test(segment)) {
      return { valid: false, error: 'Segment can only contain alphanumeric characters and hyphens' };
    }
  }

  // Check for IP address patterns (IPv4)
  // IPv4 regex: matches dotted decimal notation
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(normalizedHandle)) {
    return { valid: false, error: 'IP address handles are not allowed' };
  }

  // Check for IP address patterns (IPv6)
  // Simplified IPv6 detection - looks for hex:hex patterns typical of IPv6
  const ipv6SegmentRegex = /^([0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}$/i;
  if (ipv6SegmentRegex.test(normalizedHandle)) {
    return { valid: false, error: 'IP address handles are not allowed' };
  }

  // Additional IPv6 detection for compressed formats
  const ipv6CompressedRegex = /^([0-9a-f]{1,4}:)*:([0-9a-f]{1,4}:)*[0-9a-f]{1,4}$/i;
  if (ipv6CompressedRegex.test(normalizedHandle) && normalizedHandle.includes(':')) {
    // Further validate it's not just a regular domain with colons (invalid)
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)*:[a-z0-9-]+$/.test(normalizedHandle) === false) {
      // Could be IPv6, but we need to be more strict
      // Check if it matches the general IPv6 pattern more precisely
      const fullIpv6Regex =
        /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:)|fe80:(:[0-9a-f]{0,4}){0,4}%[0-9a-z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-f]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/i;
      if (fullIpv6Regex.test(normalizedHandle)) {
        return { valid: false, error: 'IP address handles are not allowed' };
      }
    }
  }

  // Return valid result with normalized handle
  return { valid: true, value: normalizedHandle };
}

/**
 * Validates a DID per ATProto spec.
 *
 * @param did - The DID string to validate
 * @returns Result with validated DID or error
 *
 * @remarks
 * Requirements:
 * - Must match pattern ^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$
 * - Supported methods: plc, web, key
 * - did:web should reject localhost in production
 * - Max length 2048 characters
 * - did:key has special format (starts with did:key:z) - allow it
 *
 * @returns The validated DID string if valid
 */
export function validateDid(did: string): Result<string> {
  // Check empty input
  if (!did || typeof did !== 'string') {
    return { valid: false, error: 'DID cannot be empty' };
  }

  // Check length constraint
  if (did.length > MAX_DID_LENGTH) {
    return { valid: false, error: `DID exceeds maximum length of ${MAX_DID_LENGTH} characters` };
  }

  // Base pattern for DID validation
  const didPattern = /^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/;
  if (!didPattern.test(did)) {
    return { valid: false, error: 'DID format is invalid' };
  }

  // Extract method (second segment)
  const method = did.split(':')[1] as DidMethod;

  // Check if method is supported
  if (!SUPPORTED_DID_METHODS.includes(method)) {
    return {
      valid: false,
      error: `DID method (.${method}) is not supported. Supported methods: ${SUPPORTED_DID_METHODS.join(', ')}`,
    };
  }

  // Method-specific validation
  if (method === 'web') {
    // Extract the path portion of did:web
    const path = did.slice('did:web:'.length);

    // Check for localhost in production - reject it
    // Normalize to lowercase for comparison
    const normalizedPath = path.toLowerCase();
    if (normalizedPath.includes('localhost')) {
      return { valid: false, error: 'did:web does not support localhost in production' };
    }

    // did:web must have a path (at least one segment)
    if (!path || path.length === 0) {
      return { valid: false, error: 'did:web must have a path component' };
    }
  }

  if (method === 'key') {
    // did:key format: did:key:z<base58>
    const keyData = did.slice('did:key:'.length);

    // Must start with 'z' for base58 encoding
    if (!keyData.startsWith('z')) {
      return { valid: false, error: 'did:key must start with did:key:z followed by base58 encoding' };
    }

    // Must have at least some data after 'z'
    if (keyData.length < 2) {
      return { valid: false, error: 'did:key must have a valid key value' };
    }
  }

  if (method === 'plc') {
    // PLC DID format: did:plc:<24-char-or-more-path>
    const path = did.slice('did:plc:'.length);

    // PLC DIDs should have a specific format (alphanumeric only, no special chars)
    if (!/^[a-zA-Z0-9]+$/.test(path)) {
      return { valid: false, error: 'did:plc must contain only alphanumeric characters' };
    }
  }

  return { valid: true, value: did };
}

/**
 * Auto-detects whether the identifier is a handle or DID
 * and validates accordingly.
 *
 * @param identifier - The identifier to validate (handle or DID)
 * @returns Result with validated identifier or error
 *
 * @remarks
 * Automatically detects the identifier type by checking for the 'did:' prefix.
 * If present, validates as DID. Otherwise, validates as handle.
 *
 * @returns The validated identifier string if valid
 */
export function validateIdentity(identifier: string): Result<string> {
  if (!identifier || typeof identifier !== 'string') {
    return { valid: false, error: 'Identifier cannot be empty' };
  }

  // Auto-detect based on prefix
  if (identifier.toLowerCase().startsWith('did:')) {
    return validateDid(identifier);
  }

  // Otherwise, treat as handle
  return validateHandle(identifier);
}