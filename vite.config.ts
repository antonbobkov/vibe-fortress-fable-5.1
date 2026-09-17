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
  build: { target: 'es2022', outDir: 'dist', sourcemap: true },
  server: { port: 5173 },
});
