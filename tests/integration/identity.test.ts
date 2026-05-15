import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { resolveHandle, resolveDid, resolveIdentity, verifyBidirectional } from '../../src/server/index.js';

const baseUrl = 'https://plc.directory';

const mockDidDocument = {
	'@context': ['https://www.w3.org/ns/did/v1'],
	id: 'did:plc:testdid123',
	verificationMethod: [
		{
			id: 'did:plc:testdid123#atproto',
			type: 'EcdsaSecp256k1RecoveryMethod2020',
			controller: 'did:plc:testdid123',
			publicKeyJwk: {
				kty: 'OKP',
				crv: 'Ed25519',
				x: 'QM4cHt6V4R8xjTJ7Q7vgTLMXgAvJ_rW6L3M6xMU8l0'
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
	alsoKnownAs: ['at://test.bsky.social']
};

const mockPlcHandlers = [
	http.get(new RegExp('https://plc\\.directory/did%3Aplc%3Atestdid123'), () => {
		return HttpResponse.json(mockDidDocument);
	}),
	http.get(new RegExp('https://plc\\.directory/did%3Aplc%3Ainvalid'), () => {
		return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
	}),
	http.get(new RegExp('https://bsky\\.social/xrpc/com\\.atproto\\.identity\\.resolveHandle'), ({ request }) => {
		const url = new URL(request.url);
		const handle = url.searchParams.get('handle');
		if (!handle) {
			return HttpResponse.json({ error: 'Missing handle' }, { status: 400 });
		}
		return HttpResponse.json({ did: `did:plc:${handle.replace(/\./g, '')}` });
	})
];

describe('identity resolution', () => {
	const server = setupServer(...mockPlcHandlers);

	beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
	afterAll(() => server.close());
	afterEach(() => server.resetHandlers());

	describe('resolveDid', () => {
		it('should resolve a valid DID to identity', async () => {
			const identity = await resolveDid('did:plc:testdid123');

			expect(identity.did).toBe('did:plc:testdid123');
			expect(identity.pdsUrl).toBe('https://bsky.social');
			expect(identity.signingKey).toBe('did:key:zQM4cHt6V4R8xjTJ7Q7vgTLMXgAvJ_rW6L3M6xMU8l0');
			expect(identity.handle).toBe('test.bsky.social');
			expect(identity.isVerified).toBe(false);
		});

		it('should throw error for invalid DID', async () => {
			await expect(resolveDid('did:plc:invalid')).rejects.toThrow();
		});

		it('should use custom plcDirectoryUrl when provided', async () => {
			const customUrl = 'https://plc.example.com';
			server.use(
				http.get(new RegExp('https://plc\\.example\\.com/did%3Aplc%3Atestdid123'), () => {
					return HttpResponse.json({
						...mockDidDocument,
						service: [
							{
								id: '#atproto_pds',
								type: 'AtprotoPersonalDataServer',
								serviceEndpoint: 'https://custom.pds.com'
							}
						]
					});
				})
			);

			const identity = await resolveDid('did:plc:testdid123', customUrl);
			expect(identity.pdsUrl).toBe('https://custom.pds.com');
		});
	});

	describe('resolveIdentity', () => {
		it('should resolve a DID directly', async () => {
			const identity = await resolveIdentity('did:plc:testdid123');
			expect(identity.did).toBe('did:plc:testdid123');
		});
	});

	describe('verifyBidirectional', () => {
		it('should return true for matching handle and DID', async () => {
			server.use(
				http.get(new RegExp('https://test\\.bsky\\.social/.well-known/atproto-did'), () => {
					return HttpResponse.text('did:plc:testdid123');
				})
			);
			const result = await verifyBidirectional('test.bsky.social', 'did:plc:testdid123');
			expect(result).toBe(true);
		});

		it('should return false for non-matching handle and DID', async () => {
			server.use(
				http.get(new RegExp('https://other\\.handle/.well-known/atproto-did'), () => {
					return HttpResponse.text('did:plc:otherhandle');
				})
			);
			const result = await verifyBidirectional('other.handle', 'did:plc:testdid123');
			expect(result).toBe(false);
		});

		it('should return false for invalid DID', async () => {
			const result = await verifyBidirectional('test.bsky.social', 'did:plc:invalid');
			expect(result).toBe(false);
		});
	});
});