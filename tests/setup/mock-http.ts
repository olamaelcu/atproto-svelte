import { http, HttpResponse } from 'msw';
import { setupServer, type SetupServer } from 'msw/node';

export interface MockUser {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
}

export interface MockServerOptions {
	authMeResponse?: MockUser | null;
	authMeStatus?: number;
	profileHandle?: string;
	profileDisplayName?: string;
}

export function createMockAtprotoServer(options: MockServerOptions = {}): SetupServer {
	const {
		authMeResponse = null,
		authMeStatus,
		profileHandle = 'test.bsky.social',
		profileDisplayName = 'Test User'
	} = options;

	const effectiveAuthMeStatus = authMeStatus ?? (authMeResponse ? 200 : 401);

	const handlers = [
		http.get('/xrpc/com.atproto.identity.resolveHandle', ({ request }) => {
			const url = new URL(request.url);
			const handle = url.searchParams.get('handle');

			if (!handle) {
				return HttpResponse.json({ error: 'Missing handle' }, { status: 400 });
			}

			return HttpResponse.json({
				did: `did:plc:${handle.replace('.', '')}`
			});
		}),

		http.get('/xrpc/com.atproto.server.getSession', () => {
			if (effectiveAuthMeStatus === 401) {
				return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}

			if (!authMeResponse) {
				return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}

			return HttpResponse.json({
				did: authMeResponse.did,
				handle: authMeResponse.handle,
				email: 'test@example.com',
				displayName: authMeResponse.displayName
			});
		}),

		http.get('/xrpc/app.bsky.actor.getProfile', ({ request }) => {
			const url = new URL(request.url);
			const actor = url.searchParams.get('actor');

			if (!actor) {
				return HttpResponse.json({ error: 'Missing actor' }, { status: 400 });
			}

			return HttpResponse.json({
				did: actor,
				handle: profileHandle,
				displayName: profileDisplayName,
				avatar: null,
				description: null,
				indexedAt: null,
				followsCount: 0,
				followersCount: 0,
				followingCount: 0
			});
		}),

		http.get('/.xrpc/app.bsky.actor.getProfile', ({ request }) => {
			const url = new URL(request.url);
			const actor = url.searchParams.get('actor');

			if (!actor) {
				return HttpResponse.json({ error: 'Missing actor' }, { status: 400 });
			}

			return HttpResponse.json({
				did: actor,
				handle: profileHandle,
				displayName: profileDisplayName,
				avatar: null,
				description: null,
				indexedAt: null,
				followsCount: 0,
				followersCount: 0
			});
		}),

		http.get('/xrpc/com.atproto.plc.getSigningKey', ({ request }) => {
			const url = new URL(request.url);
			const did = url.searchParams.get('did');

			if (!did) {
				return HttpResponse.json({ error: 'Missing did' }, { status: 400 });
			}

			return HttpResponse.json({
				SigningKey: 'did:key:zAlice1234567890abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz'
			});
		}),

		http.get('/well-known/did.json', ({ request }) => {
			const url = new URL(request.url);
			const hostname = url.hostname;

			return HttpResponse.json({
				'@context': ['https://www.w3.org/ns/did/v1'],
				id: `did:plc:${hostname}`,
				service: [
					{
						id: '#atproto_pds',
						type: 'AtprotoPersonalDataServer',
						serviceEndpoint: 'https://bsky.social'
					}
				]
			});
		})
	];

	return setupServer(...handlers);
}