#!/usr/bin/env node
// Replays a season's command log from a save and prints the world hash every 100 ticks.
//
// `tooling.md` § Debug and replay: "`node scripts/replay.mjs <save> <log>` prints world hashes per
// 100 ticks for bisecting divergence". `<log>` is a JSON array of command-log entries (the
// debug panel's export) or a later save, whose `commandLog` section is the season's log.
//
// A plain Node script cannot import the TypeScript sources (D-028), so this one asks Vite, a
// listed dev dependency, to load `src/app/replay.ts` with the project's aliases (docs/archive/decisions-archive.md
// D-084). Options: `--until <tick>`, `--every <n>`.
//
// Usage: node scripts/replay.mjs <save.deepholm> <log.json|later.deepholm> [--until N] [--every N]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function option(args, name) {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = Number(args[at + 1]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} needs a positive integer`);
  return value;
}

export async function main(argv) {
  const args = argv.slice(2);
  const files = args.filter((a, k) => !a.startsWith('--') && !(k > 0 && args[k - 1].startsWith('--')));
  if (files.length < 2) {
    console.error('usage: node scripts/replay.mjs <save> <log> [--until N] [--every N]');
    return 2;
  }
  const until = option(args, '--until');
  const every = option(args, '--every');
  const server = await createServer({
    root,
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const mod = await server.ssrLoadModule('/src/app/replay.ts');
    const save = new Uint8Array(readFileSync(files[0]));
    const log = new Uint8Array(readFileSync(files[1]));
    const { loaded, start, points } = await mod.replayFiles(save, log, {
      ...(until === undefined ? {} : { until }),
      ...(every === undefined ? {} : { every }),
    });
    console.log(`# ${loaded.header.fortress}, from tick ${start} (${loaded.content.match} content match)`);
    for (const p of points) console.log(`${p.tick}\t${p.hash}`);
    return 0;
  } finally {
    await server.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
