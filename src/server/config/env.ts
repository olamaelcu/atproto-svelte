import type { OAuthEnvironmentConfig } from '../types.js';

export function loadEnvConfig(): OAuthEnvironmentConfig {
  throw new Error('Not yet implemented - consumers provide their own implementation');
}

export function validateEnvConfig(config: OAuthEnvironmentConfig): void {
  throw new Error('Not yet implemented - consumers provide their own implementation');
}