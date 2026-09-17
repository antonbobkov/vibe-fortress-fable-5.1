import { defineConfig } from 'vitest/config';
import { aliases } from './vite.config';

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    include: [
      'test/unit/**/*.test.ts',
      'test/scenarios/**/*.test.ts',
      'test/property/**/*.test.ts',
      'test/golden/**/*.test.ts',
    ],
    environment: 'node',
    environmentMatchGlobs: [['test/unit/render/**', 'jsdom'], ['test/unit/ui/**', 'jsdom']],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'reports/coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
});
