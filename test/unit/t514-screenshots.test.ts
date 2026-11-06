/**
 * T-514: pictures of a headless game or a save (`tooling.md` § Screenshots). The glyph masks come
 * from the bundled font without a canvas; a picture of the `rd_snapshot_surface` scene holds the
 * render golden's cells, each stamped as its mask in its colours; the PNG decodes back to the
 * picture; the script draws the played fixture; and a test's `snapshot` does nothing unless
 * `SNAPSHOTS=1`.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { generatedSpec } from '@app/headless';
import { cropCells, encodePng, gameGlyphMasks, mapCells, rasterize, screenOfSave, stackCells, type Picture } from '@app/screenshot';
import { loadContent } from '@content/loader';
import { glyphChars } from '@render/atlas';
import { fontGlyphMasks } from '@render/font-masks';
import { toHex } from '@render/palette';
import { asRows, readGolden, snapshotView, SNAPSHOT_COLS, SNAPSHOT_ROWS, SNAPSHOT_SEED } from '../golden/render/render-fixtures';
import { TestWorld } from '../scenarios/test-world';
import { snapshot } from '../scenarios/snapshot';
import { LOG_ROWS } from '@render/constants';
import { STATUS_ROWS } from '@core/constants';

const registry = loadContent();
const font = new Uint8Array(readFileSync(resolve('src/assets/unscii-8.ttf')));
const masks = gameGlyphMasks(font, registry);
const deflate = (data: Uint8Array): Uint8Array => deflateSync(data);

/** A PNG back to RGB: the IHDR, the palette if any, the inflated unfiltered rows. */
function decodePng(png: Uint8Array): Picture {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = 8;
  let width = 0;
  let height = 0;
  let type = 0;
  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (at < png.length) {
    const length = view.getUint32(at);
    const name = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    if (name === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      type = data[9] as number;
    } else if (name === 'PLTE') palette = data;
    else if (name === 'IDAT') idat.push(data);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rgb = new Uint8Array(width * height * 3);
  const stride = type === 3 ? width : width * 3;
  for (let y = 0; y < height; y += 1) {
    expect(raw[y * (stride + 1)]).toBe(0);
    for (let x = 0; x < width; x += 1) {
      const src = y * (stride + 1) + 1;
      for (let c = 0; c < 3; c += 1) {
        rgb[(y * width + x) * 3 + c] = type === 3 ? (palette as Uint8Array)[(raw[src + x] as number) * 3 + c] as number : raw[src + x * 3 + c] as number;
      }
    }
  }
  return { width, height, rgb };
}

describe('T-514 headless screenshots', () => {
  afterEach(() => {
    delete process.env['SNAPSHOTS'];
  });

  it('reads the glyph masks from the font: the full block fills the square, a space is empty, the added symbols are their bitmaps', () => {
    const chars = glyphChars(registry);
    expect(masks).toHaveLength(chars.length);
    expect([...(masks[chars.indexOf('█')] as Uint8Array)].every((p) => p === 1)).toBe(true);
    expect([...(masks[32] as Uint8Array)].every((p) => p === 0)).toBe(true);
    // Every glyph but the blanks draws something.
    const blank = new Set([0, 32, 255, chars.indexOf(' ')]);
    chars.forEach((ch, g) => {
      if (!blank.has(g) && ch.trim() !== '') expect((masks[g] as Uint8Array).some((p) => p === 1), `glyph ${g} ${ch}`).toBe(true);
    });
    // The seven symbols added to the font (src/assets/font-additions.json) are known 8 × 8 bitmaps.
    const additions = JSON.parse(readFileSync(resolve('src/assets/font-additions.json'), 'utf8')) as Record<string, string[]>;
    for (const [hex, rows] of Object.entries(additions)) {
      const [mask] = fontGlyphMasks(font, [String.fromCodePoint(parseInt(hex, 16))]);
      expect([...(mask as Uint8Array)].join(''), hex).toBe(rows.join(''));
    }
  });

  it('a picture of rd_snapshot_surface holds the render golden\'s map cells, each its mask in its colours', () => {
    const w = new TestWorld({ seed: SNAPSHOT_SEED, world: 'local', spec: generatedSpec(SNAPSHOT_SEED), embark: 'none' });
    w.step(1);
    const view = snapshotView(w.readers);
    const mapRows = SNAPSHOT_ROWS - LOG_ROWS - STATUS_ROWS;
    const cells = mapCells(w.readers, registry, { camX: view.camX, camY: view.camY, z: view.z, cols: SNAPSHOT_COLS, rows: mapRows });
    const golden = readGolden('rd-snapshot-surface');
    expect(golden).not.toBeNull();
    expect(asRows(cells)).toEqual(golden!.cells.slice(0, mapRows));

    const scale = 2;
    const picture = rasterize(cells, masks, scale);
    expect(picture.width).toBe(SNAPSHOT_COLS * 16);
    expect(picture.height).toBe(mapRows * 16);
    const px = (x: number, y: number): string => {
      const i = (y * picture.width + x) * 3;
      return toHex(((picture.rgb[i] as number) << 16) | ((picture.rgb[i + 1] as number) << 8) | (picture.rgb[i + 2] as number));
    };
    for (let row = 0; row < mapRows; row += 1) {
      for (let col = 0; col < SNAPSHOT_COLS; col += 1) {
        const [glyph, fg, bg] = (golden!.cells[row]![col] as string).split(':') as [string, string, string];
        const mask = masks[Number(glyph)] as Uint8Array;
        for (let dy = 0; dy < 8; dy += 1) {
          for (let dx = 0; dx < 8; dx += 1) {
            const want = Number(glyph) !== 0 && Number(glyph) !== 32 && mask[dy * 8 + dx] === 1 ? fg : bg;
            for (const [sx, sy] of [[0, 0], [1, 1]] as const) {
              expect(px(col * 16 + dx * scale + sx, row * 16 + dy * scale + sy), `cell ${col},${row}`).toBe(want);
            }
          }
        }
      }
    }
    // The PNG is indexed (a cell picture has few colours) and decodes to the same pixels.
    const png = encodePng(picture, deflate);
    expect(png[25]).toBe(3);
    expect(decodePng(png)).toEqual(picture);
  });

  it('a picture of many colours is written as RGB', () => {
    const rgb = new Uint8Array(32 * 32 * 3);
    for (let i = 0; i < 32 * 32; i += 1) { rgb[i * 3] = i & 0xff; rgb[i * 3 + 1] = i >> 8; rgb[i * 3 + 2] = 7; }
    const picture = { width: 32, height: 32, rgb };
    const png = encodePng(picture, deflate);
    expect(png[25]).toBe(2);
    expect(decodePng(png)).toEqual(picture);
  });

  it('a save on a whole screen: the map, the log and the status bar, a panel by its key', async () => {
    const blob = new Uint8Array(readFileSync(resolve('test/fixtures/played-fortress.deepholm')));
    const { cells, map, game } = await screenOfSave(blob, { registry, steps: 10, keys: ['u'] });
    expect([cells.cols, cells.rows]).toEqual([80, 50]);
    expect(game.ui.panel).toBe('units');
    // Hints are off unless asked for: a save without its ui section would raise them all.
    expect(game.userSettings.hints).toBe(false);
    expect(map.cols).toBeLessThan(80);
    const text = game.textRows().join('\n');
    expect(text).toContain('Units (');
    expect(cropCells(cells, map).cols).toBe(map.cols);
    // Two pieces stacked: the map's top rows over the log's, the narrower padded.
    const top = cropCells(cells, { col: 0, row: 0, cols: 20, rows: 4 });
    const log = cropCells(cells, { col: 0, row: map.rows, cols: 30, rows: 3 });
    const both = stackCells([top, log]);
    expect([both.cols, both.rows]).toEqual([30, 7]);
    expect(both.get(5, 2)).toEqual(cells.get(5, 2));
    expect(both.get(7, 5)).toEqual(cells.get(7, map.rows + 1));
    expect(both.get(25, 1).glyph).toBe(0);
  });

  it('the script makes a PNG of the played fixture', async () => {
    const api = await import(pathToFileURL(resolve('scripts/screenshot.mjs')).href) as { main(argv: string[]): Promise<number> };
    const out = join('out', 'screenshots', 't514-script.png');
    rmSync(out, { force: true });
    expect(await api.main(['node', 'screenshot.mjs', 'test/fixtures/played-fortress.deepholm', '--size', '20x10', '--scale', '1', '--out', out])).toBe(0);
    const picture = decodePng(new Uint8Array(readFileSync(out)));
    expect([picture.width, picture.height]).toEqual([160, 80]);
    rmSync(out, { force: true });
  }, 60_000);

  it('snapshot writes only with SNAPSHOTS=1', () => {
    const w = new TestWorld({ seed: 't514-snapshot', world: 'flat-test', embark: 'default' });
    const file = join('out', 'screenshots', 't514-snapshot.png');
    rmSync(file, { force: true });
    expect(snapshot(w.game, 't514-snapshot')).toBeNull();
    expect(existsSync(file)).toBe(false);
    process.env['SNAPSHOTS'] = '1';
    expect(snapshot(w.game, 't514-snapshot', { cols: 16, rows: 8 })).toBe(file);
    const picture = decodePng(new Uint8Array(readFileSync(file)));
    expect([picture.width, picture.height]).toEqual([256, 128]);
    rmSync(file, { force: true });
  });
});
