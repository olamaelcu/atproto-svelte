import { describe, it, expect, vi } from 'vitest';

const mockCreateQuery = vi.fn(() => ({ queryKey: [], data: undefined, isLoading: false }));

vi.mock('@tanstack/svelte-query', () => {
	return {
		createQuery: mockCreateQuery
	};
});

describe('client/identity', () => {
	describe('createIdentityQuery', () => {
		it('returns query with correct queryKey for identifier', async () => {
			const { createIdentityQuery } = await import('../../src/client/identity.js');
			const identifier = 'handle.example.com';

			createIdentityQuery(identifier);

			expect(mockCreateQuery).toHaveBeenCalledWith(
				expect.any(Function)
			);
			const queryFn = mockCreateQuery.mock.calls[mockCreateQuery.mock.calls.length - 1][0];
			const options = queryFn();
			expect(options.queryKey).toEqual(['identity', 'resolve', identifier]);
		});

		it('when identifier starts with did: delegates to resolveDid', async () => {
			const { createIdentityQuery } = await import('../../src/client/identity.js');
			const didIdentifier = 'did:plc:abc123def456';

			createIdentityQuery(didIdentifier);

			expect(mockCreateQuery).toHaveBeenCalledWith(
				expect.any(Function)
			);
			const queryFn = mockCreateQuery.mock.calls[mockCreateQuery.mock.calls.length - 1][0];
			const options = queryFn();
			expect(options.queryKey).toEqual(['identity', 'resolve', didIdentifier]);
		});

		it('when identifier is a handle delegates to resolveHandle', async () => {
			const { createIdentityQuery } = await import('../../src/client/identity.js');
			const handle = 'alice.example.com';

			createIdentityQuery(handle);

			expect(mockCreateQuery).toHaveBeenCalledWith(
				expect.any(Function)
			);
			const queryFn = mockCreateQuery.mock.calls[mockCreateQuery.mock.calls.length - 1][0];
			const options = queryFn();
			expect(options.queryKey).toEqual(['identity', 'resolve', handle]);
		});
	});

	describe('createResolveHandleQuery', () => {
		it('returns query with correct queryKey for handle', async () => {
			const { createResolveHandleQuery } = await import('../../src/client/identity.js');
			const handle = 'alice.example.com';

			createResolveHandleQuery(handle);

			expect(mockCreateQuery).toHaveBeenCalledWith(
				expect.any(Function)
			);
			const queryFn = mockCreateQuery.mock.calls[mockCreateQuery.mock.calls.length - 1][0];
			const options = queryFn();
			expect(options.queryKey).toEqual(['identity', 'handle', handle]);
		});
	});

	describe('createResolveDidQuery', () => {
		it('returns query with correct queryKey for did', async () => {
			const { createResolveDidQuery } = await import('../../src/client/identity.js');
			const did = 'did:plc:abc123def456';

			createResolveDidQuery(did);

			expect(mockCreateQuery).toHaveBeenCalledWith(
				expect.any(Function)
			);
			const queryFn = mockCreateQuery.mock.calls[mockCreateQuery.mock.calls.length - 1][0];
			const options = queryFn();
			expect(options.queryKey).toEqual(['identity', 'did', did]);
		});
	});
});

describe('client/profile', () => {
	describe('createProfileQuery', () => {
		it('returns query with correct queryKey for did', async () => {
			const { createProfileQuery } = await import('../../src/client/profile.js');
			const did = 'did:plc:abc123def456';

			createProfileQuery(did);

			expect(mockCreateQuery).toHaveBeenCalledWith(
				expect.any(Function)
			);
			const queryFn = mockCreateQuery.mock.calls[mockCreateQuery.mock.calls.length - 1][0];
			const options = queryFn();
			expect(options.queryKey).toEqual(['identity', 'profile', did]);
		});

		it('returns query with correct staleTime and gcTime', async () => {
			const { createProfileQuery } = await import('../../src/client/profile.js');
			const did = 'did:plc:abc123def456';

			createProfileQuery(did);

			expect(mockCreateQuery).toHaveBeenCalledWith(
				expect.any(Function)
			);
			const queryFn = mockCreateQuery.mock.calls[mockCreateQuery.mock.calls.length - 1][0];
			const options = queryFn();
			expect(options.staleTime).toBe(1000 * 60 * 5);
			expect(options.gcTime).toBe(1000 * 60 * 30);
		});
	});
});