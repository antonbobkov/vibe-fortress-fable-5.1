/**
 * E2E `panels-open-and-close` (M2) of `05-plan/M2-things.md` T-M2-09: "every hotkey opens its panel
 * and `Esc` closes it; `Tab` toggles the sidebar". Every panel registered by the systems present
 * (and the UI's own designate, look and log) is opened with its hotkey through the real keyboard;
 * `Esc` closes it (D-077).
 */

import { test, expect } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface PanelHook extends Hook {
  readers: { ui: { panel: string | null; sidebar: boolean } };
  host: { world: { registrations: { panels: readonly { id: string; title: string; hotkey: string }[] } } };
}

const UI_PANELS = [
  { id: 'designate', title: 'Designate', hotkey: 'd' },
  { id: 'look', title: 'Look', hotkey: 'k' },
  { id: 'log', title: 'Log', hotkey: 'a' },
];

test('panels-open-and-close', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await generateWorld(page, 'e2e-1');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');

  const panels = await page.evaluate(() => (window as unknown as { __deepholm: PanelHook }).__deepholm.host.world.registrations.panels.map((p) => ({ ...p })));
  const all = [...UI_PANELS, ...panels.filter((p) => !UI_PANELS.some((u) => u.id === p.id))];
  expect(all.map((p) => p.id)).toEqual(expect.arrayContaining(['build', 'zones', 'stocks', 'units', 'jobs', 'labors']));
  const state = async (): Promise<{ panel: string | null; sidebar: boolean }> =>
    page.evaluate(() => {
      const u = (window as unknown as { __deepholm: PanelHook }).__deepholm.readers.ui;
      return { panel: u.panel, sidebar: u.sidebar };
    });
  for (const p of all) {
    await page.keyboard.press(p.hotkey);
    await expect.poll(async () => (await state()).panel).toBe(p.id);
    await expect.poll(() => textOf(page)).toContain(`[${p.hotkey}]`);
    await expect.poll(() => textOf(page)).toContain(p.title);
    // U-03 (D-241): Designate opens with Dig chosen; Esc cancels the tool before the panel.
    if (p.id === 'designate') await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state()).panel).toBeNull();
  }
  await page.keyboard.press('u');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await state()).sidebar).toBe(false);
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await state()).sidebar).toBe(true);
  await expect.poll(async () => (await state()).panel).toBe('units');

  const path = await page.evaluate(() => (window as unknown as { __deepholm: PanelHook }).__deepholm.screenshotName('panels-open-and-close'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
