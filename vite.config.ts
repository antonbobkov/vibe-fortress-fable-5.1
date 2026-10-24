import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export const aliases: Record<string, string> = {
  '@platform': r('./src/platform'),
  '@core': r('./src/core'),
  '@content': r('./src/content'),
  '@systems': r('./src/systems'),
  '@render': r('./src/render'),
  '@ui': r('./src/ui'),
  '@app': r('./src/app'),
};

export default defineConfig({
  base: './',
  resolve: { alias: aliases },
  build: { target: 'es2022', outDir: 'dist', sourcemap: true, assetsInlineLimit: 0 },
  // Agent worktrees live under .claude/; watching them reloads the page on every agent build and
  // can crash the watcher on a file a test holds open (EBUSY).
  server: { port: 5173, watch: { ignored: ['**/.claude/**', '**/dist/**', '**/coverage/**'] } },
});
