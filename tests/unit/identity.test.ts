import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

function createPlcHandler(did: string, handle: string | null) {
	return http.get(`https://plc.directory/${did}`, () => {
		return HttpResponse.json({
			'@context': ['https://www.w3.org/ns/did/v1'],
			id: did,
			verificationMethod: [
				{
					id: `${did}#atproto`,
					type: 'EcdsaSecp256k1RecoveryMethod2020',
					controller: did,
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
			alsoKnownAs: handle ? [`at://${handle}`] : []
		});
	});
}

describe('verifyBidirectional', () => {
	let server: ReturnType<typeof setupServer>;

	beforeEach(() => {
		server = setupServer();
	});

	afterEach(() => {
		server.close();
	});

	describe('reverse resolution mismatch', () => {
		it('should return false when DID document handle does not match provided handle', async () => {
			const { verifyBidirectional } = await import('../../src/server/identity/resolve.js');
			const handle = 'alice.example.com';
			const did = 'did:plc:abc123def456';
			const differentHandle = 'charlie.other.com';

			server.use(
				http.get(`https://${handle}/.well-known/atproto-did`, () => {
					return HttpResponse.text(did, { status: 200 });
				}),
				createPlcHandler(did, differentHandle)
			);

			const result = await verifyBidirectional(handle, did, 'https://plc.directory');
			expect(result).toBe(false);
		});
	});

	describe('missing handle in DID document', () => {
		it('should return false when DID document has no alsoKnownAs entry', async () => {
			const { verifyBidirectional } = await import('../../src/server/identity/resolve.js');
			const handle = 'alice.example.com';
			const did = 'did:plc:abc123def456';

			server.use(
				http.get(`https://${handle}/.well-known/atproto-did`, () => {
					return HttpResponse.text(did, { status: 200 });
				}),
				createPlcHandler(did, null)
			);

			const result = await verifyBidirectional(handle, did, 'https://plc.directory');
			expect(result).toBe(false);
		});
	});

	describe('network failure', () => {
		it('should return false when forward resolution fails', async () => {
			const { verifyBidirectional } = await import('../../src/server/identity/resolve.js');
			const handle = 'alice.example.com';
			const did = 'did:plc:abc123def456';

			server.use(
				http.get(`https://${handle}/.well-known/atproto-did`, () => {
					return HttpResponse.error();
				})
			);

			const result = await verifyBidirectional(handle, did, 'https://plc.directory');
			expect(result).toBe(false);
		});

		it('should return false when reverse resolution fails', async () => {
			const { verifyBidirectional } = await import('../../src/server/identity/resolve.js');
			const handle = 'alice.example.com';
			const did = 'did:plc:abc123def456';

			server.use(
				http.get(`https://${handle}/.well-known/atproto-did`, () => {
					return HttpResponse.text(did, { status: 200 });
				}),
				http.get(`https://plc.directory/${did}`, () => {
					return HttpResponse.error();
				})
			);

			const result = await verifyBidirectional(handle, did, 'https://plc.directory');
			expect(result).toBe(false);
		});

		it('should return false when PLC directory returns non-ok status', async () => {
			const { verifyBidirectional } = await import('../../src/server/identity/resolve.js');
			const handle = 'alice.example.com';
			const did = 'did:plc:abc123def456';

			server.use(
				http.get(`https://${handle}/.well-known/atproto-did`, () => {
					return HttpResponse.text(did, { status: 200 });
				}),
				http.get(`https://plc.directory/${did}`, () => {
					return HttpResponse.json({}, { status: 500 });
				})
			);

			const result = await verifyBidirectional(handle, did, 'https://plc.directory');
			expect(result).toBe(false);
		});
	});

	describe('exception handling', () => {
		it('should return false when handle resolution throws', async () => {
			const { verifyBidirectional } = await import('../../src/server/identity/resolve.js');
			const handle = 'alice.example.com';
			const did = 'did:plc:abc123def456';

			server.use(
				http.get(`https://${handle}/.well-known/atproto-did`, () => {
					throw new Error('Unexpected error');
				})
			);

			const result = await verifyBidirectional(handle, did, 'https://plc.directory');
			expect(result).toBe(false);
		});

		it('should return false when DID resolution throws', async () => {
			const { verifyBidirectional } = await import('../../src/server/identity/resolve.js');
			const handle = 'alice.example.com';
			const did = 'did:plc:abc123def456';

			server.use(
				http.get(`https://${handle}/.well-known/atproto-did`, () => {
					return HttpResponse.text(did, { status: 200 });
				}),
				http.get(`https://plc.directory/${did}`, () => {
					throw new Error('Unexpected error');
				})
			);

			const result = await verifyBidirectional(handle, did, 'https://plc.directory');
			expect(result).toBe(false);
		});
	});
});