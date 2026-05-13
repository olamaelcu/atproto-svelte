/**
 * Represents a user's identity resolved from the ATProto network.
 *
 * @remarks
 * An Identity contains the core identifying information for a user:
 * - Their DID (Decentralized Identifier) which is the primary identifier
 * - Their handle which is a human-readable alias (may be null if not set)
 * - Their PDS URL which is the server hosting their data
 * - Their signing key for verifying their content
 * - Whether the identity has been cryptographically verified
 *
 * @example
 * ```ts
 * const identity = await resolveHandle('alice.example.com');
 * console.log(identity.did); // did:plc:abc123...
 * ```
 */
export interface Identity {
  /** The user's Decentralized Identifier (DID). Unique and permanent. */
  did: string;
  /** The user's handle, or null if not set. May be verified via alsoKnownAs. */
  handle: string | null;
  /** URL of the user's Personal Data Server (PDS). Null if unknown. */
  pdsUrl: string | null;
  /** The user's signing key for verifying content. Null if not available. */
  signingKey: string | null;
  /** Whether the identity has been verified (bidirectional handle↔DID link confirmed). */
  isVerified: boolean;
}

/**
 * Represents a user's public profile information from the ATProto network.
 *
 * @remarks
 * A Profile contains the publicly visible profile data for a user, including
 * biographical information and social metrics.
 *
 * @example
 * ```ts
 * const profile = await fetchProfile('did:plc:abc123');
 * console.log(profile.displayName, profile.followersCount);
 * ```
 */
export interface Profile {
  /** The user's Decentralized Identifier. */
  did: string;
  /** The user's handle (always resolved, not null). */
  handle: string;
  /** The user's display name, or null if not set. */
  displayName: string | null;
  /** URL to the user's avatar image, or null if not set. */
  avatar: string | null;
  /** The user's bio/description, or null if empty. */
  description: string | null;
  /** ISO timestamp of when the profile was last indexed, or null. */
  indexedAt: string | null;
  /** Number of accounts this user follows. */
  followsCount: number;
  /** Number of accounts following this user. */
  followersCount: number;
  /** Number of accounts this user is following. */
  followingCount: number;
}