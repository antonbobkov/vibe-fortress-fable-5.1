/**
 * E2E `game-menu` of `archive/build-plan/M7-outside-world.md` T-M7-09: "Esc opens the menu, Resume returns",
 * over 24 § Game menu (`Resume`, `Save`, `Load`, `Settings`, `Retire fortress`, `Main menu`
 * "(confirm if unsaved changes since the last save)") and the Esc chain of § Input model. T-704: every
 * row but Resume takes its letter with Shift, and a bare panel letter leaves the menu for its panel.
 */

import { expect, test } from '@playwright/test';
import { screenOf, textOf } from './helpers';

interface MenuHook {
  readers: { ui: { panel: string | null } };
  host: { speed(): number };
  screen(): string;
  step(ticks: number): void;
  settled(): Promise<void>;
  screenshotName(name: string): string;
}

test('game-menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');
  await page.locator('canvas#screen').click();

  // The Esc chain: the tool, then the panel, then the menu.
  const panel = (): Promise<string | null> =>
    page.evaluate(() => (window as unknown as { __deepholm: MenuHook }).__deepholm.readers.ui.panel);
  // U-03 (D-241): `d` opens Designate with Dig chosen.
  await page.keyboard.press('d');
  await expect.poll(panel).toBe('designate');
  await expect.poll(() => textOf(page)).toContain('Dig · priority 5');
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBe('designate');
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('game_menu');
  const menu = await textOf(page);
  for (const entry of ['[r] Resume', '[S-s] Save', '[S-l] Load', '[S-o] Settings', '[S-x] Retire fortress', '[S-m] Main menu']) {
    expect(menu).toContain(entry);
  }
  // The menu pauses the simulation while it is open.
  expect(await page.evaluate(() => (window as unknown as { __deepholm: MenuHook }).__deepholm.host.speed())).toBe(0);
  const path = await page.evaluate(() => (window as unknown as { __deepholm: MenuHook }).__deepholm.screenshotName('game-menu'));
  await page.screenshot({ path });

  // `Resume` returns to the fortress.
  await page.keyboard.press('r');
  await expect.poll(() => screenOf(page)).toBe('fortress');

  // One `Esc` too many, then a panel letter: `a` opens the Log, `m` Military; neither abandons nor leaves.
  await page.evaluate(() => (window as unknown as { __deepholm: MenuHook }).__deepholm.step(30));
  for (const [letter, name] of [['a', 'log'], ['m', 'military'], ['s', 'stocks'], ['l', 'labors']] as const) {
    await page.keyboard.press('Escape');
    await expect.poll(() => screenOf(page)).toBe('game_menu');
    await page.keyboard.press(letter);
    await expect.poll(() => screenOf(page)).toBe('fortress');
    await expect.poll(panel).toBe(name);
    await page.keyboard.press('Escape');
    await expect.poll(panel).toBeNull();
  }

  // `Main menu` asks first, because ticks have run since the last save.
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('game_menu');
  await page.keyboard.press('Shift+M');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  expect(await textOf(page)).toContain('Return to the main menu?');
  await page.keyboard.press('n');
  await expect.poll(() => screenOf(page)).toBe('game_menu');

  // Settings opens from the menu and `Esc` comes back to it.
  await page.keyboard.press('Shift+O');
  await expect.poll(() => screenOf(page)).toBe('settings');
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('game_menu');
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('fortress');

  await page.evaluate(() => (window as unknown as { __deepholm: MenuHook }).__deepholm.settled());
  expect(errors).toEqual([]);
});
