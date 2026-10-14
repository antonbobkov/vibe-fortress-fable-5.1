/**
 * E2E `mouse-parity` (T-270): with the mouse alone, a player opens panels from the hotkey strip,
 * closes one with its `[x]`, pauses and resumes from the speed glyph, scrolls a sidebar list with
 * the wheel without changing the map level, and opens the game menu from `[Esc] menu`.
 */

import { expect, test } from '@playwright/test';
import { clickText, findEmbarkableRegion, generateWorld, screenOf, textCell, textOf, type Hook } from './helpers';

interface MouseHook extends Hook {
  readers: { ui: { panel: string | null; z: number } };
}

test('mouse-parity', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await generateWorld(page, 'e2e-mouse-parity');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  const state = (): Promise<{ panel: string | null; z: number }> => page.evaluate(() => {
    const u = (window as unknown as { __deepholm: MouseHook }).__deepholm.readers.ui;
    return { panel: u.panel, z: u.z };
  });

  // The hotkey strip opens a panel; its [x] closes it.
  await clickText(page, '[u] units');
  await expect.poll(async () => (await state()).panel).toBe('units');
  await expect.poll(() => textOf(page)).toContain('[x]');
  await clickText(page, '[x]', 0);
  await expect.poll(async () => (await state()).panel).toBeNull();

  // The wheel over the sidebar scrolls its list and leaves the level alone.
  await clickText(page, '[u] units');
  const z = (await state()).z;
  const over = await textCell(page, 'Units', 2);
  await page.mouse.move(over.x, over.y + 60);
  await page.mouse.wheel(0, 300);
  expect((await state()).z).toBe(z);
  await clickText(page, '[x]', 0);

  // The speed glyph pauses and resumes.
  await page.mouse.click((await textCell(page, 'Day ')).x, (await textCell(page, 'Day ')).y);
  await expect.poll(async () => (await state()).panel).toBe('calendar');
  await clickText(page, '[x]', 0);
  await expect.poll(async () => (await state()).panel).toBeNull();
  const row = await page.evaluate(() => (window as unknown as { __deepholm: MouseHook }).__deepholm.text().find((l) => l.includes('Day ')) ?? '');
  const glyph = /(║|►+ \dx)/.exec(row)?.[0] ?? '';
  expect(glyph).not.toBe('');
  await clickText(page, glyph, 0);
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __deepholm: MouseHook }).__deepholm.text().find((l) => l.includes('Day ')) ?? '')) !== row).toBe(true);

  // The menu button opens the game menu.
  await clickText(page, '[Esc]', 0);
  await expect.poll(() => screenOf(page)).toBe('game_menu');
  expect(errors).toEqual([]);
});
