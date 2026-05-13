import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'

export default [
  // Base recommended config
  js.configs.recommended,

  // TypeScript files
  ...tseslint.configs.recommended,

  // Svelte support
  ...svelte.configs.recommended,

  // Files configuration
  {
    files: ['**/*.ts', '**/*.svelte'],
    rules: {
      // ERROR rules - fail CI
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'consistent-return': 'error',
      'no-throw-literal': 'error',

      // WARN rules
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'warn',

      // Disable no-undef (handled by typescript)
      'no-undef': 'off',
    },
  },

  // Test files - more relaxed
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Server files - slightly more relaxed
  {
    files: ['src/server/**/*.ts'],
    rules: {
      // Allow console in server code for logging
      'no-console': 'off',
    },
  },
]