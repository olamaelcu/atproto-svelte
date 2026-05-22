import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'server/index': './src/server/index.ts',
    'client/index': './src/client/index.ts',
    'storage/index': './src/storage/index.ts'
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: [
    '@sveltejs/kit',
    '@sveltejs/adapter-node',
    '@tanstack/svelte-query'
  ]
});