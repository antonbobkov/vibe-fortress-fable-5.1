#!/usr/bin/env node
// `node scripts/screenshot.mjs <save> [options]`: a PNG of a save, drawn without a browser.
//
// `tooling.md` § Screenshots. The save is loaded headless and its map composed by the game's own
// compositor; each cell's glyph mask, read from the bundled font, is stamped in its colours. With
// `--screen` the save is loaded into a whole game instead, so the log, the status bar and a panel
// opened with `--keys` and `--click` are drawn too. A plain Node script cannot import the
// TypeScript sources (D-028), so this one asks Vite to load `src/app/screenshot.ts`, as
// `replay.mjs` does.
//
// Options:
//   --z N            the level (default: the wagon's)
//   --at X,Y         the tile the picture is centred on (default: the wagon)
//   --size WxH       the size in tiles of the map picture (default 48x24); with --screen, the
//                    cells of the screen kept from its top-left (default: all of it)
//   --scale N        pixels a design pixel; a cell is 8 x N pixels (default 2)
//   --steps N        play N ticks after the load first
//   --screen         the whole fortress screen (map, sidebar, log, status) instead of the map
//   --keys a,b,S-c   keys pressed in order (with --screen); S- holds Shift
//   --click X,Y      a map tile left-clicked after the keys (with --screen); repeatable
//   --hints          show the first-time hints in the log (with --screen; off by default)
//   --crop C,R,W,H   the cells of the screen kept (with --screen); repeated, the pieces are
//                    stacked top to bottom
//   --out FILE       where the PNG goes (default: out/screenshots/<save name>.png)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parse(argv) {
  const out = { file: null, clicks: [] };
  for (let k = 0; k < argv.length; k += 1) {
    const a = argv[k];
    const next = () => {
      const v = argv[k + 1];
      if (v === undefined) throw new Error(`${a} needs a value`);
      k += 1;
      return v;
    };
    const ints = (v, n, what) => {
      const parts = v.split(/[,x]/).map(Number);
      if (parts.length !== n || parts.some((p) => !Number.isInteger(p))) throw new Error(`${a} needs ${what}`);
      return parts;
    };
    if (a === '--z') out.z = ints(next(), 1, 'an integer')[0];
    else if (a === '--at') out.at = ints(next(), 2, 'X,Y');
    else if (a === '--size') out.size = ints(next(), 2, 'WxH');
    else if (a === '--scale') out.scale = ints(next(), 1, 'an integer')[0];
    else if (a === '--steps') out.steps = ints(next(), 1, 'an integer')[0];
    else if (a === '--screen') out.screen = true;
    else if (a === '--hints') out.hints = true;
    else if (a === '--keys') out.keys = next().split(',').filter((s) => s !== '');
    else if (a === '--click') out.clicks.push(ints(next(), 2, 'X,Y'));
    else if (a === '--crop') (out.crops ??= []).push(ints(next(), 4, 'C,R,W,H'));
    else if (a === '--out') out.out = next();
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else out.file = a;
  }
  return out;
}

export async function main(argv) {
  let opts;
  try {
    opts = parse(argv.slice(2));
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    opts = null;
  }
  if (opts === null || opts.file === null) {
    console.error('usage: node scripts/screenshot.mjs <save> [--z N] [--at X,Y] [--size WxH] [--scale N] [--steps N] [--screen [--keys a,b] [--click X,Y] [--crop C,R,W,H]] [--out file.png]');
    return 2;
  }
  const server = await createServer({
    root,
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const shot = await server.ssrLoadModule('/src/app/screenshot.ts');
    const saves = await server.ssrLoadModule('/src/app/game-save.ts');
    const { contentRegistry } = await server.ssrLoadModule('/src/content/loader.ts');
    const registry = contentRegistry();
    const blob = new Uint8Array(readFileSync(opts.file));
    const masks = shot.gameGlyphMasks(new Uint8Array(readFileSync(join(root, 'src/assets/unscii-8.ttf'))), registry);
    const deflate = (data) => deflateSync(data, { level: 9 });
    const scale = opts.scale ?? 2;
    let cells;
    let where;
    if (opts.screen) {
      const probe = await saves.loadGame(blob, { registry });
      const wagon = probe.game.arrival?.wagon;
      const z = opts.z ?? wagon?.z;
      const at = opts.at ?? (wagon === undefined ? undefined : [wagon.x, wagon.y]);
      const keys = (opts.keys ?? []).map((k) => (k.startsWith('S-') ? { key: k.slice(2), shift: true } : k));
      const screen = await shot.screenOfSave(blob, {
        registry,
        ...(opts.steps === undefined ? {} : { steps: opts.steps }),
        ...(at === undefined || z === undefined ? {} : { centre: { x: at[0], y: at[1], z } }),
        keys,
        clicks: opts.clicks.map(([x, y]) => ({ x, y })),
        hints: opts.hints === true,
      });
      const crops = opts.crops ?? [opts.size === undefined ? [0, 0, screen.cells.cols, screen.cells.rows] : [0, 0, opts.size[0], opts.size[1]]];
      cells = shot.stackCells(crops.map(([c, r, w, h]) => shot.cropCells(screen.cells, { col: c, row: r, cols: w, rows: h })));
      where = `screen cells ${crops.map(([c, r, w, h]) => `${c},${r} ${w}x${h}`).join(' + ')}, tick ${screen.game.host.readers.calendar.tick}`;
    } else {
      const loaded = await saves.loadGame(blob, { registry });
      const game = loaded.game;
      if ((opts.steps ?? 0) > 0) game.step(opts.steps);
      const readers = game.world.readers;
      const wagon = game.arrival?.wagon;
      const map = readers.map;
      const [x, y] = opts.at ?? [wagon?.x ?? Math.floor(map.w / 2), wagon?.y ?? Math.floor(map.h / 2)];
      const z = opts.z ?? wagon?.z ?? Math.floor(map.d / 2);
      const [w, h] = opts.size ?? [48, 24];
      const view = shot.viewAround(readers, x, y, z, w, h);
      cells = shot.mapCells(readers, registry, view);
      where = `map ${view.camX},${view.camY} z ${view.z} ${view.cols}x${view.rows}, tick ${readers.calendar.tick}`;
    }
    const png = shot.encodePng(shot.rasterize(cells, masks, scale), deflate);
    const out = opts.out ?? join('out', 'screenshots', `${basename(opts.file).replace(/\.[^.]*$/, '')}.png`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, png);
    console.log(`${out}: ${where}, ${png.length} bytes`);
    return 0;
  } finally {
    await server.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv).then((code) => process.exit(code), (error) => {
    console.error(error);
    process.exit(1);
  });
}
