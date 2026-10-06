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
      // `process/testing-strategy.md` § Coverage gates, verbatim: "`src/core` 90% lines,
      // `src/systems/**/rules` 90%, `src/systems/**` 75%, `src/render` 60%, `src/ui` 50%.
      // Thresholds are set in `vitest.config.ts` and raised, never lowered." Active from the M0
      // gate (T-M0-14). `src/app`, `src/content` and `src/platform` carry no documented threshold;
      // see DECISIONS.md D-037.
      thresholds: {
        'src/core/**': { lines: 90 },
        'src/systems/**/rules/**': { lines: 90 },
        'src/systems/**': { lines: 75 },
        'src/render/**': { lines: 60 },
        'src/ui/**': { lines: 50 },
      },
    },
  },
});
