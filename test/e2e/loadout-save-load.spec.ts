/**
 * E2E `loadout-save-load` (T-531): on the embark screen, change the loadout and save it under a
 * name; reload the page, embark again on the same site, load the saved loadout and embark; the
 * arrived stock is the saved loadout's (`02` § Loadouts, `ui-screens/embark.md` § Saved loadouts).
 */

import { test, expect, type Page } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface LoadoutHook extends Hook {
  readers: {
    items: { count(id: string): number };
    of<T>(id: string): T;
  };
  settled(): Promise<void>;
}

interface AnimalsReader {
  bySpecies(species: number | string, wild?: boolean): number[];
}

const SEED = 'e2e-loadouts';

async function openEmbark(page: Page): Promise<void> {
  await generateWorld(page, SEED);
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
}

async function selectRow(page: Page, name: string): Promise<void> {
  for (let k = 0; k < 40 && !(await textOf(page)).includes(`► ${name}`); k += 1) await page.keyboard.press('ArrowDown');
  expect(await textOf(page)).toContain(`► ${name}`);
}

test('loadout-save-load', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // 1. Change the loadout: a third iron pick and a second cat.
  await openEmbark(page);
  await page.keyboard.press('2');
  await selectRow(page, 'Iron pick');
  await page.keyboard.press('+');
  await page.keyboard.press('3');
  await selectRow(page, 'Cat');
  await page.keyboard.press('+');
  const spent = /Spent ([\d,]+)/.exec(await textOf(page))?.[1];
  expect(spent).toBeDefined();

  // 2. Save it as "Deep start".
  await page.keyboard.press('l');
  await expect.poll(() => textOf(page)).toContain('Saved loadouts');
  await page.keyboard.press('s');
  await expect.poll(() => screenOf(page)).toBe('text_input');
  for (let k = 0; k < 40; k += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('Deep start');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await expect.poll(() => textOf(page)).toContain('Saved Deep start.');
  await page.evaluate(() => (window as unknown as { __deepholm: LoadoutHook }).__deepholm.settled());

  // 3. Reload the page; the same site opens with Balanced, and the saved loadout is listed.
  await openEmbark(page);
  expect(await textOf(page)).not.toContain(`Spent ${spent}`);
  await page.keyboard.press('l');
  await expect.poll(() => textOf(page)).toContain('Deep start');
  const path = await page.evaluate(
    () => (window as unknown as { __deepholm: LoadoutHook }).__deepholm.screenshotName('loadout-save-load'),
  );
  await page.screenshot({ path });

  // 4. Load it and embark.
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Loaded Deep start.');
  expect(await textOf(page)).toContain(`Spent ${spent}`);
  await page.keyboard.press('Escape');
  await expect.poll(() => textOf(page)).not.toContain('Saved loadouts');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');

  const arrived = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: LoadoutHook }).__deepholm;
    return { picks: h.readers.items.count('pick'), cats: h.readers.of<AnimalsReader>('08').bySpecies('cat', false).length };
  });
  expect(arrived).toEqual({ picks: 3, cats: 2 });
  expect(errors).toEqual([]);
});
