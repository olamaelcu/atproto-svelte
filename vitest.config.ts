import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: ['tests/integration/**', 'src/**/*.svelte.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'cobertura'],
      exclude: ['node_modules', 'dist', 'tests/**']
    }
  },
  resolve: {
    alias: {
      '../../../src/server/types.js': '/home/vrgl/Code/olamaelcu/atproto-svelte/src/server/types.ts'
    }
  }
});