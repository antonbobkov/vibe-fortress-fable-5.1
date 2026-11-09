/**
 * E2E `embark-testing` (T-532, `02` § Testing mode): on the embark screen, choose the Testing
 * fortress preset, add a free item on the Items tab, embark, and play a few days; the fortress is
 * marked as testing, its late items and runecasters arrived, and the Load screen marks its save.
 */

import { test, expect } from '@playwright/test';
import { findEmbarkableRegion, focusMenu, generateWorld, screenOf, textOf } from './helpers';
import { TICKS_PER_DAY } from '../../src/core/constants';

interface TestingHook {
  step(ticks: number): void;
  settled(): Promise<void>;
  lastSaveId(): string | null;
  screenshotName(name: string): string;
  readers: {
    fortress: { state: { name: string; testing?: boolean } };
    calendar: { tick: number };
    items: { count(id: string): number };
    of<T>(id: string): T;
  };
  host: {
    world: {
      registry: { table(name: string): { index(id: string): number } };
      entities: {
        componentTypes(): readonly { id: number; name: string }[];
        with(...types: { id: number; name: string }[]): number[];
        get<T>(id: number, type: { id: number; name: string }): T | undefined;
      };
    };
  };
}

interface DwarvesReader {
  list(): number[];
  population(): number;
  skill(id: number, skillId: string): number;
}

test('embark-testing', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await generateWorld(page, 'e2e-testing');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  // Testing mode is off by default, and the screen says so.
  await expect.poll(() => textOf(page)).toContain('Testing mode: off');

  // The presets menu: Testing fortress is the last row, after the four normal presets.
  await page.keyboard.press('p');
  await expect.poll(() => textOf(page)).toContain('Testing fortress');
  for (let k = 0; k < 4; k += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Budget unlimited (testing)');
  expect(await textOf(page)).toContain('Testing mode: ON');

  // The Items tab: a free line of five steel bars more, made by keys.
  await page.keyboard.press('4');
  await expect.poll(() => textOf(page)).toContain('New item');
  await page.keyboard.press('/');
  await page.keyboard.type('bar');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('/');
  await page.keyboard.type('steel');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  for (let k = 0; k < 4; k += 1) await page.keyboard.press('+');
  await page.keyboard.press('a');
  // The preset's 20 steel bars and these 5 are one kind: one line of 25.
  await expect.poll(() => textOf(page)).toContain('25 x steel bar');
  const items = await page.evaluate(() => (window as unknown as { __deepholm: TestingHook }).__deepholm.screenshotName('embark-testing-items'));
  await page.screenshot({ path: items });

  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 90_000 }).toBe('fortress');

  const arrived = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: TestingHook }).__deepholm;
    const dwarves = h.readers.of<DwarvesReader>('10');
    const ids = dwarves.list();
    const types = h.host.world.entities.componentTypes();
    const itemType = types.find((t) => t.name === 'Item');
    const runeType = types.find((t) => t.name === 'Rune');
    if (itemType === undefined || runeType === undefined) throw new Error('component types');
    const items = h.host.world.registry.table('items');
    const staffs = h.host.world.entities.with(itemType)
      .map((id) => h.host.world.entities.get<{ type: number; stone?: number }>(id, itemType))
      .filter((it) => it !== undefined && it.type === items.index('staff'));
    return {
      testing: h.readers.fortress.state.testing,
      population: dwarves.population(),
      runecasters: ids.filter((id) => dwarves.skill(id, 'runecraft') >= 15).length,
      withRune: h.host.world.entities.with(runeType).length,
      vials: h.readers.items.count('rune_vial'),
      bars: h.readers.items.count('bar'),
      staffsWithStones: staffs.filter((it) => it?.stone !== undefined).length,
      tick: h.readers.calendar.tick,
    };
  });
  expect(arrived.testing).toBe(true);
  expect(arrived.population).toBe(12);
  expect(arrived.runecasters).toBe(2);
  expect(arrived.withRune).toBeGreaterThanOrEqual(2);
  expect(arrived.vials).toBe(60);
  expect(arrived.bars).toBeGreaterThanOrEqual(25);
  expect(arrived.staffsWithStones).toBe(4);

  // Play three days through the hook, a few hundred ticks at a time.
  await page.evaluate(async (days) => {
    const h = (window as unknown as { __deepholm: TestingHook }).__deepholm;
    const target = h.readers.calendar.tick + days;
    while (h.readers.calendar.tick < target) {
      h.step(Math.min(300, target - h.readers.calendar.tick));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }, 3 * TICKS_PER_DAY);
  const after = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: TestingHook }).__deepholm;
    return { tick: h.readers.calendar.tick, population: h.readers.of<DwarvesReader>('10').population() };
  });
  expect(after.tick - arrived.tick).toBeGreaterThanOrEqual(3 * TICKS_PER_DAY);
  expect(after.population).toBeGreaterThanOrEqual(10);
  expect(await screenOf(page)).toBe('fortress');

  const path = await page.evaluate(() => (window as unknown as { __deepholm: TestingHook }).__deepholm.screenshotName('embark-testing'));
  await page.screenshot({ path });

  // The save's header marks it: the Load screen names the row "(testing)".
  await page.keyboard.press('F5');
  await expect
    .poll(() => page.evaluate(async () => {
      const h = (window as unknown as { __deepholm: TestingHook }).__deepholm;
      await h.settled();
      return h.lastSaveId();
    }))
    .toMatch(/^manual-\d+$/);
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('main_menu');
  await focusMenu(page);
  await page.keyboard.press('l');
  await expect.poll(() => screenOf(page)).toBe('load');
  await expect.poll(() => textOf(page)).toContain('(testing)');

  expect(errors).toEqual([]);
});
