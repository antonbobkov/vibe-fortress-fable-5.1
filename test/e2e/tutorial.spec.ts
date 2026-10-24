/**
 * T-439: the tutorial played through in the browser (`ui-screens/menus-and-world.md` § Tutorial).
 * Every step is done with the real keyboard and mouse, as its text says, and the step is read
 * through the hook after each. A second test takes the first New world's offer and drives the box's
 * buttons and keys.
 */
import { expect, test, type Page } from '@playwright/test';
import { focusMenu, screenOf, textCell, textOf, tilePixel, type Hook } from './helpers';

const FLOOR = 2;

interface TutorialHook extends Hook {
  tutorial(): { step: string | null; index: number; total: number } | null;
  dwarves(): { id: number; x: number; y: number; z: number }[];
  settled(): Promise<void>;
  readers: {
    ui: { camX: number; camY: number; z: number; panel: string | null; cursor: { x: number; y: number } | null };
    map: { w: number; h: number; d: number; kindAt(i: number): number; index(x: number, y: number, z: number): number };
    entities: { at(i: number): readonly number[] };
    buildings: {
      at(i: number): number;
      zoneAt(i: number): number;
      zoneTileQualifies(type: string, i: number): boolean;
      ghost(type: string, origin: number, orientation: number): { tiles: number[]; bad: number[]; reason: string | null };
    };
  };
  host: { headless: { registry: { table(name: string): { ids(): readonly string[]; byId(id: string): { name?: string; category?: string } | undefined } } } };
}

async function step(page: Page): Promise<string | null | undefined> {
  return page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.tutorial()?.step);
}

async function cursor(page: Page): Promise<{ x: number; y: number }> {
  const c = await page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.readers.ui.cursor);
  expect(c).not.toBeNull();
  return c as { x: number; y: number };
}

/** Walk the map cursor onto a tile with the arrows (Shift: ten at a time). */
async function cursorTo(page: Page, x: number, y: number): Promise<void> {
  for (let guard = 0; guard < 200; guard += 1) {
    const c = await cursor(page);
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx === 0 && dy === 0) return;
    if (dx !== 0) await page.keyboard.press(`${Math.abs(dx) >= 10 ? 'Shift+' : ''}${dx > 0 ? 'ArrowRight' : 'ArrowLeft'}`);
    else await page.keyboard.press(`${Math.abs(dy) >= 10 ? 'Shift+' : ''}${dy > 0 ? 'ArrowDown' : 'ArrowUp'}`);
  }
  throw new Error(`the cursor did not reach ${x},${y}`);
}

/** A w×h rectangle of free tiles near the cursor on the current level: floor, or tiles the zone type takes. */
async function patchNear(page: Page, w: number, h: number, kind: 'stockpile' | 'farm_plot' | 'floor'): Promise<{ x: number; y: number }> {
  const at = await page.evaluate(({ w, h, kind, FLOOR }) => {
    const k = (window as unknown as { __deepholm: TutorialHook }).__deepholm;
    const { map, buildings, ui } = k.readers;
    const c = ui.cursor ?? { x: ui.camX + 20, y: ui.camY + 15 };
    const ok = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
      const i = map.index(x, y, ui.z);
      if (buildings.at(i) !== 0 || buildings.zoneAt(i) !== 0) return false;
      return kind === 'floor' ? map.kindAt(i) === FLOOR : buildings.zoneTileQualifies(kind, i);
    };
    for (let r = 2; r < 40; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = c.x + dx;
          const y = c.y + dy;
          let all = true;
          for (let a = 0; a < h && all; a += 1) for (let b = 0; b < w && all; b += 1) all = ok(x + b, y + a);
          if (all) return { x, y };
        }
      }
    }
    return null;
  }, { w, h, kind, FLOOR });
  expect(at, `${w}x${h} ${kind}`).not.toBeNull();
  return at as { x: number; y: number };
}

async function startTutorial(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('main_menu');
  await focusMenu(page);
}

test('T-439 tutorial: every step played through by keyboard and mouse', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startTutorial(page);
  await page.keyboard.press('t');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.tutorial())).toEqual({ step: 'view', index: 0, total: 11 });
  await expect.poll(() => textOf(page)).toContain('Tutorial · step 1 of 11');
  await page.screenshot({ path: 'reports/screenshots/t439-tutorial-1-view.png' });

  // 1. Move the view and change the level.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('<');
  await expect.poll(() => step(page)).toBe('look');
  await page.keyboard.press('Home');

  // 2. Look at a tile by a click, then move the look cursor onto a dwarf.
  const target = await page.evaluate(() => {
    const k = (window as unknown as { __deepholm: TutorialHook }).__deepholm;
    const { map, entities, ui } = k.readers;
    for (const d of k.dwarves()) {
      if (d.z !== ui.z) continue;
      for (const dx of [2, -2, 3, -3]) {
        const x = d.x + dx;
        if (entities.at(map.index(x, d.y, d.z)).length === 0 && entities.at(map.index(d.x + Math.sign(dx), d.y, d.z)).length === 0) return { dwarf: d, empty: { x, y: d.y } };
      }
    }
    return null;
  });
  expect(target).not.toBeNull();
  const { dwarf, empty } = target as { dwarf: { x: number; y: number }; empty: { x: number; y: number } };
  const at = await tilePixel(page, empty.x, empty.y);
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.readers.ui.panel)).toBe('look');
  expect(await step(page)).toBe('look');
  await cursorTo(page, dwarf.x, dwarf.y);
  await expect.poll(() => step(page)).toBe('dig');

  // 3. Designate a dig box one level down: Enter at one corner, the arrows, Enter at the other.
  await page.keyboard.press('d');
  await expect.poll(() => textOf(page)).toContain('Tutorial · step 3 of 11');
  await page.screenshot({ path: 'reports/screenshots/t439-tutorial-2-dig.png' });
  await page.keyboard.press('<');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => step(page)).toBe('stairs');

  // 4. Down stairs on a floor tile of the surface: two clicks on it.
  await page.keyboard.press('>');
  await page.keyboard.press('Shift+J');
  const stairs = await patchNear(page, 1, 1, 'floor');
  await cursorTo(page, stairs.x, stairs.y);
  const stairsAt = await tilePixel(page, stairs.x, stairs.y);
  await page.mouse.click(stairsAt.x, stairsAt.y);
  await page.mouse.click(stairsAt.x, stairsAt.y);
  await expect.poll(() => step(page)).toBe('stockpile');

  // 5. A stockpile: two corners by Enter.
  await page.keyboard.press('z');
  await page.keyboard.press('Shift+S');
  const pile = await patchNear(page, 3, 2, 'stockpile');
  await cursorTo(page, pile.x, pile.y);
  await page.keyboard.press('Enter');
  await cursorTo(page, pile.x + 2, pile.y + 1);
  await page.keyboard.press('Enter');
  await expect.poll(() => step(page)).toBe('workshop');

  // 6. A workshop from the Build list, placed at the cursor.
  await page.keyboard.press('b');
  await page.keyboard.press('w');
  await page.keyboard.press('Enter');
  const origin = await page.evaluate(() => {
    const k = (window as unknown as { __deepholm: TutorialHook }).__deepholm;
    const rows = k.text();
    const status = (rows[rows.length - 1] ?? '').toLowerCase();
    const table = k.host.headless.registry.table('buildings');
    const type = table.ids().find((id) => table.byId(id)?.category === 'workshop' && status.includes((table.byId(id)?.name ?? '?').toLowerCase()));
    if (type === undefined) return null;
    const { map, buildings, ui } = k.readers;
    const c = ui.cursor ?? { x: ui.camX + 20, y: ui.camY + 15 };
    for (let r = 0; r < 30; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = c.x + dx;
          const y = c.y + dy;
          if (x < 1 || y < 1 || x >= map.w - 3 || y >= map.h - 3) continue;
          const g = buildings.ghost(type, map.index(x, y, ui.z), 0);
          // The ghost is centred on the cursor: the cursor goes to the middle of the footprint.
          if (g.reason === null && g.bad.length === 0 && g.tiles.length > 0 && g.tiles.every((i) => buildings.zoneAt(i) === 0)) {
            const xs = g.tiles.map((i) => i % map.w);
            const ys = g.tiles.map((i) => Math.floor(i / map.w) % map.h);
            return { x: x + Math.floor((Math.max(...xs) - Math.min(...xs) + 1) / 2), y: y + Math.floor((Math.max(...ys) - Math.min(...ys) + 1) / 2) };
          }
        }
      }
    }
    return null;
  });
  expect(origin).not.toBeNull();
  await cursorTo(page, (origin as { x: number }).x, (origin as { y: number }).y);
  await page.keyboard.press('Enter');
  await expect.poll(() => step(page)).toBe('order');

  // 7. An order: Orders, Shift+N, part of a recipe's name typed, Enter.
  await page.keyboard.press('Escape');
  await page.keyboard.press('o');
  await page.keyboard.press('Shift+N');
  await page.keyboard.type('bed');
  await page.keyboard.press('Enter');
  await expect.poll(() => step(page)).toBe('farm');

  // 8. A farm plot over soil, by a drag of the mouse.
  await page.keyboard.press('Escape');
  await page.keyboard.press('z');
  await page.keyboard.press('Shift+F');
  const plot = await patchNear(page, 2, 2, 'farm_plot');
  await cursorTo(page, plot.x, plot.y);
  await cursorTo(page, plot.x + 1, plot.y + 1);
  const pa = await tilePixel(page, plot.x, plot.y);
  const pb = await tilePixel(page, plot.x + 1, plot.y + 1);
  await page.mouse.move(pa.x, pa.y);
  await page.mouse.down();
  await page.mouse.move(pb.x, pb.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => step(page)).toBe('labors');

  // 9. Labors: the whole row of the first dwarf.
  await page.keyboard.press('Escape');
  await page.keyboard.press('l');
  await page.keyboard.press('Shift+A');
  await expect.poll(() => step(page)).toBe('speed');

  // 10. Run, faster, and pause again.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Space');
  await page.keyboard.press('+');
  await page.keyboard.press('Space');
  await expect.poll(() => step(page)).toBe('save');

  // 11. A quick save.
  await page.keyboard.press('F5');
  await page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.settled());
  await expect.poll(() => page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.tutorial())).toEqual({ step: null, index: 11, total: 11 });
  await expect.poll(() => textOf(page)).toContain('Tutorial · done');
  await page.screenshot({ path: 'reports/screenshots/t439-tutorial-3-done.png' });
  await page.keyboard.press('F1');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.tutorial())).toBeNull();
  expect(await textOf(page)).not.toContain('Tutorial ·');
  expect(errors).toEqual([]);
});

test('T-439 tutorial: offered on the first New world, skipped and ended by the box and its keys', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startTutorial(page, '?tutorial=offer');
  await page.keyboard.press('n');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  await expect.poll(() => textOf(page)).toContain('Is this your first fortress?');
  await page.keyboard.press('y');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await expect.poll(() => step(page)).toBe('view');
  // A click on the box's skip button, then the skip key.
  const skip = await textCell(page, '[F1] skip step', 1);
  await page.mouse.click(skip.x, skip.y);
  await expect.poll(() => step(page)).toBe('look');
  await page.keyboard.press('F1');
  await expect.poll(() => step(page)).toBe('dig');
  // A click on the box away from its buttons does nothing, and opens no look panel under it.
  const title = await textCell(page, 'Tutorial · step 3 of 11', 2);
  await page.mouse.click(title.x, title.y);
  expect(await step(page)).toBe('dig');
  expect(await page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.readers.ui.panel)).toBeNull();
  const end = await textCell(page, '[Shift+F1] end tutorial', 2);
  await page.mouse.click(end.x, end.y);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __deepholm: TutorialHook }).__deepholm.tutorial())).toBeNull();
  // The fortress goes on as any other; the tutorial's keys now do nothing.
  await page.keyboard.press('F1');
  expect(await screenOf(page)).toBe('fortress');
  expect(errors).toEqual([]);
});
