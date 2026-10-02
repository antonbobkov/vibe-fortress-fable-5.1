import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a plain .mjs script without type declarations
import { cellsToRgb, encodePng, extractGoldens } from '../../scripts/render-goldens-png.mjs';

describe('T-M8-04 visual diff script: render-goldens-png.mjs', () => {
  it('encodePng outputs a valid PNG format header and chunks', () => {
    const width = 2;
    const height = 2;
    const rgb = Buffer.from([
      255, 0, 0,    0, 255, 0,
      0, 0, 255,    255, 255, 255,
    ]);
    const png = encodePng(width, height, rgb) as Buffer;

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    // Check IHDR chunk
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(width);
    expect(png.readUInt32BE(20)).toBe(height);

    // Check IEND chunk at end
    expect(png.subarray(png.length - 8, png.length - 4).toString('ascii')).toBe('IEND');
  });

  it('cellsToRgb calculates dimensions and parses cell strings', () => {
    const cells = [
      ['A:#ff0000:#000000', 'B:#00ff00:#112233'],
      ['C:#0000ff:#445566', 'D:#ffffff:#778899'],
    ];
    const { width, height, buffer } = cellsToRgb(cells, 8, 14) as {
      width: number;
      height: number;
      buffer: Buffer;
    };

    expect(width).toBe(2 * 8);
    expect(height).toBe(2 * 14);
    expect(buffer.length).toBe(width * height * 3);
  });

  it('extractGoldens parses screens, panels, and default cell matrices', () => {
    const jsonScreens = {
      screens: {
        main_menu: { cells: [[' :#ffffff:#000000']] },
        settings: { cells: [[' :#ffffff:#000000']] },
      },
    };
    const extractedScreens = extractGoldens(jsonScreens) as { name: string; cells: string[][] }[];
    expect(extractedScreens.map((s) => s.name)).toEqual(['main_menu', 'settings']);

    const jsonPanels = {
      panels: {
        build: { cells: [[' :#ffffff:#000000']] },
        stocks: { cells: [[' :#ffffff:#000000']] },
      },
    };
    const extractedPanels = extractGoldens(jsonPanels) as { name: string; cells: string[][] }[];
    expect(extractedPanels.map((p) => p.name)).toEqual(['build', 'stocks']);

    const jsonDirect = {
      cells: [[' :#ffffff:#000000']],
    };
    const extractedDirect = extractGoldens(jsonDirect) as { name: string; cells: string[][] }[];
    expect(extractedDirect.map((d) => d.name)).toEqual(['default']);
  });
});
