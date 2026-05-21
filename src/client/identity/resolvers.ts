import { Agent } from '@atproto/api';
import type { Identity } from '../../types/index.js';
import { DEFAULT_PUBLIC_API_URL } from '../../constants.js';

export function resolveHandle(handle: string, publicApiUrl?: string): Promise<Identity> {
	const agent = new Agent(publicApiUrl ?? DEFAULT_PUBLIC_API_URL);
	return agent.resolveHandle({ handle }).then((res) => ({
		did: res.data.did,
		handle,
		pdsUrl: null,
		signingKey: null
	}));
}

export function resolveDid(did: string, publicApiUrl?: string): Promise<Identity> {
	const agent = new Agent(publicApiUrl ?? DEFAULT_PUBLIC_API_URL);
	return agent.getProfile({ actor: did }).then((res) => ({
		did: res.data.did,
		handle: res.data.handle,
		pdsUrl: null,
		signingKey: null
	}));
}

export function resolveIdentity(identifier: string, publicApiUrl?: string): Promise<Identity> {
	if (identifier.startsWith('did:')) {
		return resolveDid(identifier, publicApiUrl);
	}
	return resolveHandle(identifier, publicApiUrl);
}
