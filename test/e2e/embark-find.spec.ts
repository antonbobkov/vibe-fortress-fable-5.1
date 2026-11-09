/**
 * E2E `embark-find` (T-533): on the embark screen at 80 × 50 cells, find a skill and clear it with
 * `0`, scroll the skills with the mouse wheel to the last one and raise it with a click, find supplies
 * and an animal by typing, review the chosen lines, take back an `Esc` that would lose the edits,
 * embark; the arrived party and stock show each change (`ui-screens/embark.md` § Finding things).
 */

import { test, expect, type Page } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface FindHook extends Hook {
  readers: {
    items: { count(id: string): number };
    of<T>(id: string): T;
  };
}

interface DwarvesReader {
  list(): number[];
  skill(id: number, skillId: string): number;
}

interface AnimalsReader {
  bySpecies(species: number | string, wild?: boolean): number[];
}

/** The page position of the cell where `text` starts on the first row matching `row`, plus `offset` cells. */
async function cellOf(page: Page, row: RegExp, text: string, offset = 1): Promise<{ x: number; y: number }> {
  const at = await page.evaluate(([source, needle]) => {
    const rows = (window as unknown as { __deepholm: Hook }).__deepholm.text();
    const r = rows.findIndex((line) => new RegExp(source as string).test(line));
    return r < 0 ? null : { col: (rows[r] as string).search(new RegExp(source as string)) + (rows[r] as string).slice((rows[r] as string).search(new RegExp(source as string))).indexOf(needle as string), row: r };
  }, [row.source, text]);
  if (at === null) throw new Error(`no row ${row}`);
  const b = await page.locator('canvas#screen').boundingBox();
  if (b === null) throw new Error('no canvas');
  const p = await page.evaluate(
    ([col, r]) => (window as unknown as { __deepholm: Hook }).__deepholm.cellCenter(col as number, r as number),
    [at.col + offset, at.row],
  );
  return { x: b.x + p.x, y: b.y + p.y };
}

async function find(page: Page, text: string): Promise<void> {
  await page.keyboard.press('/');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('embark-find', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await generateWorld(page, 'e2e-find');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');

  // 1. Dwarves: find Axe and clear it with `0`; the first dwarf has two points to spend.
  await find(page, 'axe');
  await expect.poll(() => textOf(page)).toMatch(/► Axe +\[-\] 2 \[\+\]/);
  await page.keyboard.press('0');
  await expect.poll(() => textOf(page)).toContain('Skills (points left: 2)');
  await page.keyboard.press('Escape');
  await expect.poll(() => textOf(page)).toContain('[/] find');

  // 2. The wheel over the skills reaches the last of them; a click on its [+] raises it.
  const woodcutting = /Woodcutting +\[-\] 0 \[\+\]/;
  expect(await textOf(page)).not.toMatch(woodcutting);
  const skills = await cellOf(page, /Building +\[-\]/, 'Building');
  await page.mouse.move(skills.x, skills.y);
  for (let k = 0; k < 6 && !woodcutting.test(await textOf(page)); k += 1) await page.mouse.wheel(0, 120);
  expect(await textOf(page)).toMatch(woodcutting);
  const plus = await cellOf(page, woodcutting, '[+]');
  await page.mouse.click(plus.x, plus.y);
  await expect.poll(() => textOf(page)).toMatch(/Woodcutting +\[-\] 1 \[\+\]/);

  // 3. Supplies: find the crossbow and the copper bolts and drop them; find and buy a war dog.
  await page.keyboard.press('2');
  await find(page, 'crossbow');
  await page.keyboard.press('0');
  await find(page, 'bolts');
  await expect.poll(() => textOf(page)).toContain('► 25 copper bolts');
  await page.keyboard.press('0');
  await find(page, 'war');
  await expect.poll(() => textOf(page)).toMatch(/► War dog +72 ☼ +\[-\] +0 \[\+\] +Animals/);
  await page.keyboard.press('+');

  // 4. The chosen lines, animals too, in one view.
  await page.keyboard.press('ArrowLeft');
  const chosen = await textOf(page);
  expect(chosen).toMatch(/War dog +72 ☼ +\[-\] +1 \[\+\] += +72 +Animals/);
  expect(chosen).toMatch(/Iron pick .*Tools/);
  expect(chosen).not.toContain('Crossbow');
  const path = await page.evaluate(
    () => (window as unknown as { __deepholm: FindHook }).__deepholm.screenshotName('embark-find'),
  );
  await page.screenshot({ path });

  // 5. Esc would lose the edits: it asks, and the default answer stays.
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');

  // 6. Embark.
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  const arrived = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FindHook }).__deepholm;
    const dwarves = h.readers.of<DwarvesReader>('10');
    const first = dwarves.list()[0] ?? 0;
    return {
      axe: dwarves.skill(first, 'axe'),
      woodcutting: dwarves.skill(first, 'woodcutting'),
      dogs: h.readers.of<AnimalsReader>('08').bySpecies('dog', false).length,
    };
  });
  expect(arrived).toEqual({ axe: 0, woodcutting: 1, dogs: 3 });
  expect(errors).toEqual([]);
});
