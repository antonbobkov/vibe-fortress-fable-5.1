#!/usr/bin/env node
// `scripts/render-goldens-png.mjs`: render golden renders (*.json) to PNG images for the gate report.
//
// `archive/build-plan/M8-polish.md` T-M8-04: "Produces: `test/golden/render/*.json` for each wireframe in
// `04-implementation/ui-screens/` at a fixed state (built through `TestWorld` and the UI state), plus
// a visual diff script that renders goldens to PNG for the gate report."

import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const goldenDir = join(root, 'test/golden/render');
const outDir = join(root, 'reports/screenshots/goldens');

/**
 * Pure-Node PNG encoder for 24-bit RGB pixel buffers.
 * Zero external runtime dependencies.
 */
export function encodePng(width, height, rgbBuffer) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(2, 9); // Color type 2: RGB
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const scanlineLen = 1 + width * 3;
  const raw = Buffer.alloc(height * scanlineLen);
  for (let y = 0; y < height; y += 1) {
    raw[y * scanlineLen] = 0; // Filter: None
    const src = y * width * 3;
    rgbBuffer.copy(raw, y * scanlineLen + 1, src, src + width * 3);
  }

  const compressed = deflateSync(raw);

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const buf = Buffer.alloc(12 + data.length);
    buf.writeUInt32BE(data.length, 0);
    typeBuf.copy(buf, 4);
    data.copy(buf, 8);
    const checksum = crc32(Buffer.concat([typeBuf, data]));
    buf.writeUInt32BE(checksum >>> 0, 8 + data.length);
    return buf;
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function parseHex(hex) {
  const clean = hex.replace(/^#/, '');
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Render a matrix of `glyph:fg:bg` cell strings to an RGB pixel buffer.
 * Each cell is rendered as cellW x cellH pixels.
 */
export function cellsToRgb(cells, cellW = 8, cellH = 14) {
  const rows = cells.length;
  const cols = rows > 0 ? cells[0].length : 0;
  const imgW = cols * cellW;
  const imgH = rows * cellH;
  const buf = Buffer.alloc(imgW * imgH * 3);

  for (let r = 0; r < rows; r += 1) {
    const row = cells[r];
    for (let c = 0; c < cols; c += 1) {
      const cellStr = row[c] ?? ' :#ffffff:#000000';
      const parts = cellStr.split(':');
      const bgHex = parts[2] ?? '#000000';
      const fgHex = parts[1] ?? '#ffffff';
      const [bgR, bgG, bgB] = parseHex(bgHex);
      const [fgR, fgG, fgB] = parseHex(fgHex);
      const glyph = parts[0] ?? ' ';

      // Fill cell block
      for (let py = 0; py < cellH; py += 1) {
        for (let px = 0; px < cellW; px += 1) {
          const x = c * cellW + px;
          const y = r * cellH + py;
          const idx = (y * imgW + x) * 3;

          // Simple glyph rendering: outline/foreground for non-space glyphs
          const isFg = glyph !== ' ' && (
            (py >= 3 && py <= cellH - 4 && (px === 2 || px === cellW - 3)) ||
            (py === Math.floor(cellH / 2) && px >= 2 && px <= cellW - 3)
          );

          if (isFg) {
            buf[idx] = fgR;
            buf[idx + 1] = fgG;
            buf[idx + 2] = fgB;
          } else {
            buf[idx] = bgR;
            buf[idx + 1] = bgG;
            buf[idx + 2] = bgB;
          }
        }
      }
    }
  }

  return { width: imgW, height: imgH, buffer: buf };
}

/**
 * Extract named cell matrices from a golden JSON file.
 */
export function extractGoldens(jsonContent) {
  const results = [];
  if (jsonContent.cells && Array.isArray(jsonContent.cells)) {
    results.push({ name: 'default', cells: jsonContent.cells });
  }
  if (jsonContent.panels && typeof jsonContent.panels === 'object') {
    for (const [key, val] of Object.entries(jsonContent.panels)) {
      if (val && val.cells && Array.isArray(val.cells)) {
        results.push({ name: key, cells: val.cells });
      }
    }
  }
  if (jsonContent.screens && typeof jsonContent.screens === 'object') {
    for (const [key, val] of Object.entries(jsonContent.screens)) {
      if (val && val.cells && Array.isArray(val.cells)) {
        results.push({ name: key, cells: val.cells });
      }
    }
  }
  return results;
}

/**
 * Render HTML via Playwright for high-fidelity screenshots if available.
 */
export async function renderWithPlaywright(goldensList, targetDir) {
  try {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    for (const item of goldensList) {
      const { group, name, cells } = item;
      const rows = cells.length;
      const cols = rows > 0 ? cells[0].length : 0;

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { margin: 0; padding: 4px; background: #000000; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 14px; }
  .grid { display: inline-block; white-space: pre; border: 1px solid #333; }
  .cell { display: inline-block; width: 8.5px; height: 14px; text-align: center; }
</style></head><body><div class="grid" id="capture">`;

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const cellStr = cells[r][c] ?? ' :#ffffff:#000000';
          const parts = cellStr.split(':');
          const glyph = (parts[0] || ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const fg = parts[1] || '#ffffff';
          const bg = parts[2] || '#000000';
          html += `<span class="cell" style="color:${fg};background-color:${bg}">${glyph}</span>`;
        }
        html += '<br/>';
      }
      html += '</div></body></html>';

      await page.setContent(html);
      const element = await page.$('#capture');
      if (element) {
        const outPath = join(targetDir, `${group}_${name}.png`);
        await element.screenshot({ path: outPath });
      }
    }

    await browser.close();
    return true;
  } catch {
    return false;
  }
}

export async function main() {
  mkdirSync(outDir, { recursive: true });

  const filter = process.argv[2];
  const files = readdirSync(goldenDir).filter((f) => f.endsWith('.json'));

  const allItems = [];
  for (const file of files) {
    const group = file.replace(/\.json$/, '');
    if (filter && !group.includes(filter)) continue;
    const content = JSON.parse(readFileSync(join(goldenDir, file), 'utf8'));
    const items = extractGoldens(content);
    for (const item of items) {
      allItems.push({ group, ...item });
    }
  }

  console.log(`Rendering ${allItems.length} golden renders to PNG in ${outDir}...`);

  // Attempt high-fidelity Playwright rendering first
  const playwrightOk = await renderWithPlaywright(allItems, outDir);

  if (!playwrightOk) {
    // Pure-Node PNG fallback
    console.log('Using pure Node PNG renderer fallback...');
    for (const item of allItems) {
      const { group, name, cells } = item;
      const { width, height, buffer } = cellsToRgb(cells);
      const pngBuf = encodePng(width, height, buffer);
      const outPath = join(outDir, `${group}_${name}.png`);
      writeFileSync(outPath, pngBuf);
    }
  }

  console.log(`Rendered ${allItems.length} golden PNGs successfully into ${outDir}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
