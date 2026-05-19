import { describe, it, expect, vi } from 'vitest';

const mockCreateQuery = vi.fn(() => ({ queryKey: [], data: undefined, isLoading: false }));

let mockOptions: any = null;

function MockQueryClient(options?: any) {
	mockOptions = options;
	this.getDefaultOptions = () => options?.defaultOptions ?? {};
}

vi.mock('@tanstack/svelte-query', () => {
	return {
		createQuery: mockCreateQuery,
		QueryClient: MockQueryClient
	};
});

describe('client/identity', () => {
	describe('createIdentityQuery', () => {
		it('returns query with correct queryKey for identifier', async () => {
			mockOptions = null;
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

	describe('identityClient', () => {
		it('has correct default config', async () => {
			const { identityClient } = await import('../../src/client/identity.js');

			const defaultOptions = identityClient.getDefaultOptions();
			const queriesConfig = defaultOptions.queries;

			expect(queriesConfig?.staleTime).toBe(1000 * 60 * 10);
			expect(queriesConfig?.gcTime).toBe(1000 * 60 * 60);
			expect(queriesConfig?.refetchOnWindowFocus).toBe(false);
			expect(queriesConfig?.retry).toBe(2);
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