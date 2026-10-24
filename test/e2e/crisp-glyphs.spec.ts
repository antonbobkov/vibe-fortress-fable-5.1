/**
 * E2E `crisp-glyphs` (T-435, `02-systems/23-rendering.md` § Atlas): the main menu at device pixel
 * ratios 1 and 1.25 holds only palette colours, with no anti-aliased partial tones beside its
 * glyphs. A screenshot of each is saved to `reports/screenshots/`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { screenOf } from './helpers';

interface Hook {
  screenshotName(name: string): string;
}

const palette = new Set<string>(
  (JSON.parse(readFileSync(join(process.cwd(), 'src/content/palette.json'), 'utf8')) as { hex: string; alt?: string }[])
    .flatMap((row) => [row.hex, row.alt ?? row.hex].map((hex) => hex.toLowerCase())),
);

for (const dpr of [1, 1.25]) {
  test.describe(`device pixel ratio ${dpr}`, () => {
    test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr });

    test(`crisp-glyphs at ${dpr}`, async ({ page }) => {
      await page.goto('/');
      await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
      await expect.poll(() => screenOf(page)).toBe('main_menu');
      const colors = await page.evaluate(() => {
        const canvas = document.querySelector('canvas#screen') as HTMLCanvasElement;
        const data = (canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, canvas.width, canvas.height).data;
        const seen = new Set<string>();
        for (let i = 0; i < data.length; i += 4) {
          seen.add(`#${[data[i], data[i + 1], data[i + 2]].map((v) => (v as number).toString(16).padStart(2, '0')).join('')}`);
        }
        return [...seen];
      });
      expect(colors.length).toBeGreaterThan(2);
      expect(colors.filter((hex) => !palette.has(hex)), 'colours outside the palette').toEqual([]);
      const path = await page.evaluate((name) => (window as unknown as { __deepholm: Hook }).__deepholm.screenshotName(name), `crisp-glyphs-${dpr}`);
      await page.screenshot({ path });
    });
  });
}
