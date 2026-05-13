import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveDid, resolveIdentity, verifyBidirectional, resolveHandle } from '../../src/server/identity/resolve';
import { fetchDidDocument } from '../../src/server/identity/plc';

vi.mock('../../src/server/identity/plc', async () => {
  const actual = await vi.importActual('../../src/server/identity/plc');
  return {
    ...actual as any,
    fetchDidDocument: vi.fn()
  };
});

const mockDidDocument = {
  id: 'did:plc:ejggqolmgpylroktvaktibik',
  verificationMethod: [
    {
      id: 'did:plc:ejggqolmgpylroktvaktibik#atproto',
      type: 'Multikey',
      controller: 'did:plc:ejggqolmgpylroktvaktibik',
      publicKeyMultibase: 'zQmRZ5o3XWyMX7YqZ5eLQNy6hP3gokyYcLRkdT6iR7U1pqL'
    }
  ],
  service: [
    {
      id: '#atproto_pds',
      type: 'AtprotoPersonalDataServer',
      endpoint: 'https://pds.example.com'
    }
  ],
  alsoKnownAs: ['at://handle.example.com']
};

describe('resolveDid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve a DID to Identity', async () => {
    vi.mocked(fetchDidDocument).mockResolvedValue(mockDidDocument);

    const identity = await resolveDid('did:plc:ejggqolmgpylroktvaktibik');

    expect(identity.did).toBe('did:plc:ejggqolmgpylroktvaktibik');
    expect(identity.handle).toBe('handle.example.com');
    expect(identity.pdsUrl).toBe('https://pds.example.com');
    expect(identity.signingKey).toBe('did:key:zQmRZ5o3XWyMX7YqZ5eLQNy6hP3gokyYcLRkdT6iR7U1pqL');
    expect(identity.isVerified).toBe(false);
  });

  it('should handle missing PDS service', async () => {
    const docWithoutPds = {
      ...mockDidDocument,
      service: []
    };
    vi.mocked(fetchDidDocument).mockResolvedValue(docWithoutPds);

    const identity = await resolveDid('did:plc:ejggqolmgpylroktvaktibik');

    expect(identity.pdsUrl).toBeNull();
  });

  it('should handle missing verification method', async () => {
    const docWithoutVm = {
      ...mockDidDocument,
      verificationMethod: []
    };
    vi.mocked(fetchDidDocument).mockResolvedValue(docWithoutVm);

    const identity = await resolveDid('did:plc:ejggqolmgpylroktvaktibik');

    expect(identity.signingKey).toBeNull();
  });

  it('should handle missing alsoKnownAs', async () => {
    const docWithoutAlias = {
      ...mockDidDocument,
      alsoKnownAs: []
    };
    vi.mocked(fetchDidDocument).mockResolvedValue(docWithoutAlias);

    const identity = await resolveDid('did:plc:ejggqolmgpylroktvaktibik');

    expect(identity.handle).toBeNull();
  });

  it('should throw on network error', async () => {
    vi.mocked(fetchDidDocument).mockRejectedValue(new Error('Network error'));

    await expect(resolveDid('did:plc:invalid')).rejects.toThrow('Network error');
  });
});

describe('resolveIdentity with DID', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect DID prefix and call resolveDid', async () => {
    vi.mocked(fetchDidDocument).mockResolvedValue(mockDidDocument);

    const identity = await resolveIdentity('did:plc:ejggqolmgpylroktvaktibik');

    expect(identity.did).toBe('did:plc:ejggqolmgpylroktvaktibik');
    expect(fetchDidDocument).toHaveBeenCalledWith('did:plc:ejggqolmgpylroktvaktibik');
  });

  it('should handle plc method DIDs', async () => {
    vi.mocked(fetchDidDocument).mockResolvedValue(mockDidDocument);

    const identity = await resolveIdentity('did:plc:z72d7lbqzyoged');

    expect(identity.did).toBe('did:plc:z72d7lbqzyoged');
    expect(fetchDidDocument).toHaveBeenCalledWith('did:plc:z72d7lbqzyoged');
  });

  it('should throw on invalid DID format', async () => {
    vi.mocked(fetchDidDocument).mockRejectedValue(new Error('Not found'));

    await expect(resolveIdentity('did:plc:invalid')).rejects.toThrow();
  });
});

describe('verifyBidirectional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when DID alsoKnownAs does not match handle', async () => {
    vi.mocked(fetchDidDocument).mockResolvedValue({
      ...mockDidDocument,
      alsoKnownAs: ['at://other.example.com']
    });

    const result = await verifyBidirectional('test.example.com', 'did:plc:ejggqolmgpylroktvaktibik');

    expect(result).toBe(false);
  });

  it('should return false when DID has no handle in alsoKnownAs', async () => {
    vi.mocked(fetchDidDocument).mockResolvedValue({
      ...mockDidDocument,
      alsoKnownAs: []
    });

    const result = await verifyBidirectional('test.example.com', 'did:plc:ejggqolmgpylroktvaktibik');

    expect(result).toBe(false);
  });

  it('should return false on network error during DID resolution', async () => {
    vi.mocked(fetchDidDocument).mockRejectedValue(new Error('Network error'));

    const result = await verifyBidirectional('test.example.com', 'did:plc:ejggqolmgpylroktvaktibik');

    expect(result).toBe(false);
  });

  it('should return false when handle resolves to different DID', async () => {
    vi.mocked(fetchDidDocument).mockResolvedValue(mockDidDocument);

    const result = await verifyBidirectional('test.example.com', 'did:plc:ejggqolmgpylroktvaktibik');

    expect(result).toBe(false);
  });
});