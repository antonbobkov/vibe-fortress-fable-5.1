import { defineConfig } from 'vitest/config';
import { aliases } from './vite.config';

export default defineConfig({
  resolve: { alias: aliases },
  test: {
    include: ['test/perf/**/*.test.ts'],
    environment: 'node',
    testTimeout: 600_000,
    hookTimeout: 600_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
