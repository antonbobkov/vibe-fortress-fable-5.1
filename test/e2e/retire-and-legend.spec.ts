/**
 * E2E `retire-and-legend` (T-155): play a few hundred ticks, retire through the game menu
 * and its confirmation, assert the legend screen, return to the main menu, open Legends
 * and assert that the fortress is listed.
 */

import { test, expect } from '@playwright/test';
import { screenOf, textOf } from './helpers';

interface RetireHook {
  screen(): string;
  text(): string[];
  step(ticks: number): void;
  screenshotName(name: string): string;
  readers: {
    fortress: { state: { name: string } };
    ui: { panel: string | null };
  };
}

test('retire-and-legend', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');
  await page.locator('canvas#screen').click();

  const fortressName = await page.evaluate(
    () => (window as unknown as { __deepholm: RetireHook }).__deepholm.readers.fortress.state.name,
  );
  expect(fortressName.length).toBeGreaterThan(0);

  // Play a few hundred ticks so time passes before retiring.
  await page.evaluate(() => (window as unknown as { __deepholm: RetireHook }).__deepholm.step(300));

  // Close any panel opened by the initial click (e.g. look panel) before opening the game menu.
  const panel = async () =>
    page.evaluate(
      () => (window as unknown as { __deepholm: RetireHook }).__deepholm.readers.ui.panel,
    );
  if ((await panel()) !== null) {
    await page.keyboard.press('Escape');
    await expect.poll(panel).toBeNull();
  }

  // Open game menu with Escape.
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('game_menu');
  expect(await textOf(page)).toContain('[x] Retire fortress');

  // Choose Retire fortress.
  await page.keyboard.press('x');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  expect(await textOf(page)).toContain(`Retire ${fortressName}?`);

  // Confirm retirement with 'y'.
  await page.keyboard.press('y');
  await expect.poll(() => screenOf(page)).toBe('legend');

  // Assert the legend screen shows the retired fortress details.
  const legendText = await textOf(page);
  expect(legendText).toContain(fortressName);
  expect(legendText).toContain('Retired in Year 1');

  // Save screenshot of the legend screen.
  const path = await page.evaluate(
    () => (window as unknown as { __deepholm: RetireHook }).__deepholm.screenshotName('retire-and-legend'),
  );
  await page.screenshot({ path });

  // Return to the main menu with Escape.
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('main_menu');

  // Open Legends from the main menu using 'g'.
  await page.keyboard.press('g');
  await expect.poll(() => screenOf(page)).toBe('legend');

  // Assert that the fortress is listed in Legends.
  const listText = await textOf(page);
  expect(listText).toContain(fortressName);

  // Open the record detail with Enter.
  await page.keyboard.press('Enter');
  expect(await textOf(page)).toContain('Retired in Year 1');

  // Return back to the list, then to the main menu.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('main_menu');

  expect(errors).toEqual([]);
});
