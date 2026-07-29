import { defineConfig } from 'vitest/config';

/**
 * Only the domain folder is unit tested here. It has no Nest, Prisma or HTTP
 * dependencies, so the tests need no application bootstrap and run in
 * milliseconds — which is the practical payoff of keeping that folder pure.
 */
export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/__fixtures__/**'],
    },
  },
});
