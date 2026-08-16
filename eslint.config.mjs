import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', 'playwright-report/**', 'test-results/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // The API leans on decorator metadata and Prisma's generated types; an
      // unused argument there is usually a signature, not a mistake.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Jest and Vitest both inject globals, and the domain tests are plain functions.
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts', 'apps/web/src/testing/**'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  {
    files: ['scripts/**', '**/*.config.{js,mjs,ts}', 'apps/api/src/**'],
    languageOptions: { globals: globals.node },
  },

  // Last, so formatting rules never fight Prettier.
  prettier,
);
