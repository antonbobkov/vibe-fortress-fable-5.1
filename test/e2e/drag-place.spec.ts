/**
 * E2E `drag-place` (U-04; UI audit M6, S9): with the real keyboard and mouse, the build tool on
 * the bed places three beds in one drag, and the status bar counts them while dragging.
 */

import { expect, test, type Page } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface U04Hook extends Hook {
  step(n: number): void;
  readers: {
    ui: { camX: number; camY: number; z: number; panel: string | null };
    map: { w: number; h: number; index(x: number, y: number, z: number): number };
    buildings: {
      byType(type: string): number[];
      get(id: number): { origin: number; state: string } | undefined;
      ghost(type: string, origin: number, orientation: number): { reason: string | null };
    };
  };
}

/** Three tiles in a row, in view, each of which takes a bed. */
async function findRow(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: U04Hook }).__deepholm;
    const u = hook.readers.ui;
    const map = hook.readers.map;
    const ok = (x: number, y: number): boolean => hook.readers.buildings.ghost('bed', map.index(x, y, u.z), 0).reason === null;
    for (let y = u.camY + 3; y < u.camY + 30; y += 1) {
      for (let x = u.camX + 3; x < u.camX + 35; x += 1) {
        if (ok(x, y) && ok(x + 1, y) && ok(x + 2, y)) return { x, y };
      }
    }
    return null;
  });
}

test('drag-place', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await generateWorld(page, 'u04-drag-place');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();

  const row = await findRow(page);
  expect(row).not.toBeNull();
  const site = row as { x: number; y: number };

  // Build › Furniture › Bed.
  await page.keyboard.press('b');
  await page.keyboard.press('Shift+F');
  // The list highlights a row with the arrows; Enter picks it as the tool, Backspace drops it again.
  for (let k = 0; k < 30; k += 1) {
    await page.keyboard.press('Enter');
    if ((await textOf(page)).includes('Bed · ')) break;
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowDown');
  }
  await expect.poll(() => textOf(page)).toContain('Bed · ');

  // Drag over the three tiles with the real mouse: the status bar counts them.
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas box');
  const cell = async (x: number, y: number): Promise<{ x: number; y: number }> => page.evaluate(([tx, ty]) => {
    const hook = (window as unknown as { __deepholm: U04Hook }).__deepholm;
    const u = hook.readers.ui;
    return hook.cellCenter((tx as number) - u.camX, (ty as number) - u.camY);
  }, [x, y]);
  const a = await cell(site.x, site.y);
  const b = await cell(site.x + 2, site.y);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await expect.poll(() => textOf(page)).toContain('Bed x3');
  await page.mouse.up();
  await expect.poll(() => textOf(page)).toContain('Bed x3 placed');

  // The world takes all three, on the three tiles.
  await page.evaluate(() => (window as unknown as { __deepholm: U04Hook }).__deepholm.step(1));
  const placed = await page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: U04Hook }).__deepholm;
    const b = hook.readers.buildings;
    return b.byType('bed').map((id) => b.get(id)?.origin ?? -1).sort((p, q) => p - q);
  });
  const expected = await page.evaluate((s) => {
    const hook = (window as unknown as { __deepholm: U04Hook }).__deepholm;
    const map = hook.readers.map;
    return [0, 1, 2].map((dx) => map.index(s.x + dx, s.y, hook.readers.ui.z));
  }, site);
  expect(placed).toEqual(expected);
  // The tool is still active for the next lot.
  expect(await textOf(page)).toContain('Bed');
  expect(errors).toEqual([]);
});
