import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Two kinds of test live here.
 *
 * `src/domain/**` is pure arithmetic with no Nest, Prisma or HTTP dependency, so
 * those tests need no application bootstrap and run in milliseconds — the
 * practical payoff of keeping that folder pure.
 *
 * `src/**\/*.integration.test.ts` boots the real Nest application over supertest
 * to cover the HTTP contract: status codes, validation and serialisation.
 *
 * The SWC transform is required for the integration tests only. Nest resolves
 * constructor dependencies from `emitDecoratorMetadata`, which esbuild — the
 * default Vitest transform — does not emit. Without it every injected provider
 * arrives undefined.
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/__fixtures__/**'],
    },
  },
});
