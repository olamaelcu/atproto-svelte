export interface Identity {
  did: string;
  handle: string | null;
  pdsUrl: string | null;
  signingKey: string | null;
  isVerified: boolean;
}

export interface Profile {
  did: string;
  handle: string;
  displayName: string | null;
  avatar: string | null;
  description: string | null;
  indexedAt: string | null;
  followsCount: number;
  followersCount: number;
  followingCount: number;
}