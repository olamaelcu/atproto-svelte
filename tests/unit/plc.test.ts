import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockDid = 'did:plc:abc123def456';

const mockDidDocument = {
	'@context': ['https://www.w3.org/ns/did/v1'],
	id: mockDid,
	verificationMethod: [
		{
			id: `${mockDid}#atproto`,
			type: 'EcdsaSecp256k1RecoveryMethod2020',
			controller: mockDid,
			publicKeyJwk: {
				kty: 'ES',
				crv: 'secp256k1',
				x: 'SNXlNqL_MnFVXstKKyLrSW4X4B9P6yigV4FDKO90_9k',
				y: 'cvjABaM59WNbLM4tJ7rOUf3L6r1fFk5r2f0aBQ8-j0A'
			}
		}
	],
	service: [
		{
			id: '#atproto_pds',
			type: 'AtprotoPersonalDataServer',
			serviceEndpoint: 'https://bsky.social'
		}
	],
	alsoKnownAs: ['at://alice.example.com']
};

const mockDidDocumentWithEd25519 = {
	...mockDidDocument,
	verificationMethod: [
		{
			id: `${mockDid}#atproto`,
			type: 'JsonWebKey2020',
			controller: mockDid,
			publicKeyJwk: {
				kty: 'OKP',
				crv: 'Ed25519',
				x: 'VCFIqFzKrB8YBDm2hkJVfMGEpH2wQS2aZ7f2k3F9VZw'
			}
		}
	]
};

describe('plc.ts', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('fetchDidDocument', () => {
		it('with valid DID returns DID document object', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockDidDocument
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchDidDocument } = await import('../../src/server/identity/plc.js');
			const doc = await fetchDidDocument(mockDid);

			expect(doc.id).toBe(mockDid);
			expect(doc.verificationMethod).toHaveLength(1);
			expect(doc.service).toHaveLength(1);
			expect(doc.alsoKnownAs).toContain('at://alice.example.com');
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining(`/did:plc:abc123def456`),
				expect.any(Object)
			);
		});

		it('with missing verificationMethod returns document with null signingKey', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					id: mockDid,
					verificationMethod: [],
					service: [
						{
							id: '#atproto_pds',
							type: 'AtprotoPersonalDataServer',
							serviceEndpoint: 'https://bsky.social'
						}
					],
					alsoKnownAs: ['at://alice.example.com']
				})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchDidDocument, extractSigningKey } = await import('../../src/server/identity/plc.js');
			const doc = await fetchDidDocument(mockDid);

			expect(extractSigningKey(doc)).toBeNull();
		});

		it('with missing service array returns document with null pdsUrl', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					id: mockDid,
					verificationMethod: mockDidDocument.verificationMethod,
					service: [],
					alsoKnownAs: ['at://alice.example.com']
				})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchDidDocument, fetchPdsUrl } = await import('../../src/server/identity/plc.js');
			const doc = await fetchDidDocument(mockDid);
			const pdsUrl = await fetchPdsUrl(doc.id);

			expect(pdsUrl).toBeNull();
		});

		it('with missing alsoKnownAs returns document with null handle', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					id: mockDid,
					verificationMethod: mockDidDocument.verificationMethod,
					service: mockDidDocument.service,
					alsoKnownAs: []
				})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchDidDocument, extractHandleFromAlsoKnownAs } = await import('../../src/server/identity/plc.js');
			const doc = await fetchDidDocument(mockDid);

			expect(extractHandleFromAlsoKnownAs(doc)).toBeNull();
		});

		it('with Secp256k1 key returns null for signingKey', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockDidDocument
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchDidDocument, extractSigningKey } = await import('../../src/server/identity/plc.js');
			const doc = await fetchDidDocument(mockDid);

			expect(extractSigningKey(doc)).toBeNull();
		});

		it('with Ed25519 key returns the key', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockDidDocumentWithEd25519
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchDidDocument, extractSigningKey } = await import('../../src/server/identity/plc.js');
			const doc = await fetchDidDocument(mockDid);

			expect(extractSigningKey(doc)).toBe('did:key:zVCFIqFzKrB8YBDm2hkJVfMGEpH2wQS2aZ7f2k3F9VZw');
		});
	});

	describe('fetchPdsUrl', () => {
		it('with valid service entry returns the endpoint URL', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockDidDocument
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchPdsUrl } = await import('../../src/server/identity/plc.js');
			const pdsUrl = await fetchPdsUrl(mockDid);

			expect(pdsUrl).toBe('https://bsky.social');
		});

		it('with missing service returns null', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					id: mockDid,
					verificationMethod: mockDidDocument.verificationMethod,
					service: [],
					alsoKnownAs: ['at://alice.example.com']
				})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchPdsUrl } = await import('../../src/server/identity/plc.js');
			const pdsUrl = await fetchPdsUrl(mockDid);

			expect(pdsUrl).toBeNull();
		});

		it('with network error returns null', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			});
			vi.stubGlobal('fetch', mockFetch);

			const { fetchPdsUrl } = await import('../../src/server/identity/plc.js');
			const pdsUrl = await fetchPdsUrl(mockDid);

			expect(pdsUrl).toBeNull();
		});
	});

	describe('extractSigningKey', () => {
		it('with Ed25519 key (crv === Ed25519) returns the key', async () => {
			const doc = {
				id: 'did:plc:abc123def456',
				verificationMethod: [
					{
						id: 'did:plc:abc123def456#atproto',
						type: 'JsonWebKey2020',
						controller: 'did:plc:abc123def456',
						publicKeyJwk: {
							kty: 'OKP',
							crv: 'Ed25519',
							x: 'VCFIqFzKrB8YBDm2hkJVfMGEpH2wQS2aZ7f2k3F9VZw'
						}
					}
				],
				service: [],
				alsoKnownAs: []
			};

			const { extractSigningKey } = await import('../../src/server/identity/plc.js');
			const key = extractSigningKey(doc);

			expect(key).toBe('did:key:zVCFIqFzKrB8YBDm2hkJVfMGEpH2wQS2aZ7f2k3F9VZw');
		});

		it('with Secp256k1 key (crv === secp256k1) returns null', async () => {
			const doc = {
				id: 'did:plc:abc123def456',
				verificationMethod: [
					{
						id: 'did:plc:abc123def456#atproto',
						type: 'EcdsaSecp256k1RecoveryMethod2020',
						controller: 'did:plc:abc123def456',
						publicKeyJwk: {
							kty: 'ES',
							crv: 'secp256k1',
							x: 'SNXlNqL_MnFVXstKKyLrSW4X4B9P6yigV4FDKO90_9k',
							y: 'cvjABaM59WNbLM4tJ7rOUf3L6r1fFk5r2f0aBQ8-j0A'
						}
					}
				],
				service: [],
				alsoKnownAs: []
			};

			const { extractSigningKey } = await import('../../src/server/identity/plc.js');
			const key = extractSigningKey(doc);

			expect(key).toBeNull();
		});

		it('with no verificationMethod returns null', async () => {
			const doc = {
				id: 'did:plc:abc123def456',
				verificationMethod: [],
				service: [],
				alsoKnownAs: []
			};

			const { extractSigningKey } = await import('../../src/server/identity/plc.js');
			const key = extractSigningKey(doc);

			expect(key).toBeNull();
		});

		it('with multibase key returns the did:key', async () => {
			const doc = {
				id: 'did:plc:abc123def456',
				verificationMethod: [
					{
						id: 'did:plc:abc123def456#atproto',
						type: 'Multikey',
						controller: 'did:plc:abc123def456',
						publicKeyMultibase: 'zQmT9YQgF8vpcZrApZfFEiW4ibV4d4X8zM1WkH6gHqR3pF'
					}
				],
				service: [],
				alsoKnownAs: []
			};

			const { extractSigningKey } = await import('../../src/server/identity/plc.js');
			const key = extractSigningKey(doc);

			expect(key).toBe('did:key:zQmT9YQgF8vpcZrApZfFEiW4ibV4d4X8zM1WkH6gHqR3pF');
		});
	});

	describe('extractHandleFromAlsoKnownAs', () => {
		it('with at:// handle returns the handle string', async () => {
			const doc = {
				id: 'did:plc:abc123def456',
				verificationMethod: [],
				service: [],
				alsoKnownAs: ['at://alice.example.com']
			};

			const { extractHandleFromAlsoKnownAs } = await import('../../src/server/identity/plc.js');
			const handle = extractHandleFromAlsoKnownAs(doc);

			expect(handle).toBe('alice.example.com');
		});

		it('with at://handle/path returns just the handle', async () => {
			const doc = {
				id: 'did:plc:abc123def456',
				verificationMethod: [],
				service: [],
				alsoKnownAs: ['at://alice.example.com/app.bsky.feed.post/123']
			};

			const { extractHandleFromAlsoKnownAs } = await import('../../src/server/identity/plc.js');
			const handle = extractHandleFromAlsoKnownAs(doc);

			expect(handle).toBe('alice.example.com');
		});

		it('with no alsoKnownAs returns null', async () => {
			const doc = {
				id: 'did:plc:abc123def456',
				verificationMethod: [],
				service: [],
				alsoKnownAs: []
			};

			const { extractHandleFromAlsoKnownAs } = await import('../../src/server/identity/plc.js');
			const handle = extractHandleFromAlsoKnownAs(doc);

			expect(handle).toBeNull();
		});

		it('with non-at:// entries returns null', async () => {
			const doc = {
				id: 'did:plc:abc123def456',
				verificationMethod: [],
				service: [],
				alsoKnownAs: ['https://example.com/profile']
			};

			const { extractHandleFromAlsoKnownAs } = await import('../../src/server/identity/plc.js');
			const handle = extractHandleFromAlsoKnownAs(doc);

			expect(handle).toBeNull();
		});
	});
});