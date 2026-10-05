/**
 * E2E `labor-manager` (U-06; UI audit M5, M10, M11): with the real keyboard and mouse, the labor
 * manager applies a template to two marked dwarves, the units panel renames a dwarf through the
 * text input, and a squad takes three members from one multi-select.
 */

import { expect, test } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface U06Hook extends Hook {
  readers: { ui: { panel: string | null }; entities: { get(id: number, component: unknown): { name?: string } | undefined }; of<T>(id: string): T };
  step(n: number): void;
}

interface Dwarves { list(): number[] }
interface Jobs { laborEnabled(dwarf: number, labor: string): boolean }
interface Combat { squads(): { id: number; members: number[] }[] }

test('labor-manager', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await generateWorld(page, 'u06-labor-manager');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();
  const step = (n: number): Promise<void> => page.evaluate((ticks) => (window as unknown as { __deepholm: U06Hook }).__deepholm.step(ticks), n);

  // The labors panel, then the manager; two marks; the Miner template.
  await page.keyboard.press('l');
  await expect.poll(() => textOf(page)).toContain('[Enter] labor manager');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('labor_manager');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect.poll(() => textOf(page)).toContain('2 of 7 marked');
  await page.keyboard.press('t');
  await expect.poll(() => textOf(page)).toContain('Apply a template to 2 dwarves');
  await page.keyboard.press('1');
  await step(1);
  const labors = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: U06Hook }).__deepholm;
    const dwarves = h.readers.of<Dwarves>('10').list();
    const jobs = h.readers.of<Jobs>('11');
    const of = (d: number): string[] => ['mining', 'hauling', 'farming', 'carpentry', 'cooking'].filter((l) => jobs.laborEnabled(d, l));
    return [of(dwarves[0] as number), of(dwarves[1] as number), of(dwarves[2] as number)];
  });
  expect(labors[0]).toEqual(['mining', 'hauling']);
  expect(labors[1]).toEqual(['mining', 'hauling']);
  expect(labors[2]?.length).toBeGreaterThan(2);

  // The close button, by mouse.
  const close = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: U06Hook }).__deepholm;
    const row = h.text()[0] ?? '';
    return h.cellCenter(row.indexOf('[Esc] close') + 2, 0);
  });
  const box = await page.locator('canvas#screen').boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + close.x, box.y + close.y);
  await expect.poll(() => screenOf(page)).toBe('fortress');

  // Units: Space marks instead of pausing; Shift+N renames through the text input.
  await page.keyboard.press('u');
  await page.keyboard.press('Space');
  await expect.poll(() => textOf(page)).toContain('1 marked');
  await page.keyboard.press('Shift+N');
  await expect.poll(() => screenOf(page)).toBe('text_input');
  for (let k = 0; k < 30; k += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('Kili Deepdelver');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('fortress');
  await step(1);
  await expect.poll(() => textOf(page)).toContain('Kili Deepdelver');

  // Military: a squad, then three members from one list.
  await page.keyboard.press('m');
  await page.keyboard.press('+');
  await step(1);
  await page.keyboard.press('a');
  for (let k = 0; k < 3; k += 1) {
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
  }
  await expect.poll(() => textOf(page)).toContain('Add: 3 marked');
  await page.keyboard.press('Enter');
  await step(1);
  const members = await page.evaluate(() => (window as unknown as { __deepholm: U06Hook }).__deepholm.readers.of<Combat>('16').squads()[0]?.members.length ?? 0);
  expect(members).toBe(3);
  expect(errors).toEqual([]);
});
