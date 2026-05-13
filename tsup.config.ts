import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    server: './src/server/index.ts',
    client: './src/client/index.ts'
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