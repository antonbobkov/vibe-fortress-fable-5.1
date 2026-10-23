/**
 * E2E `intro` (T-423, `ui-screens/menus-and-world.md` § Intro): a first launch with the test
 * build's skip turned off (`?intro=on`) shows the intro; a key skips it to the main menu; the
 * menu's Intro plays it again and a click skips it; a later launch does not play it again.
 */

import { expect, test } from '@playwright/test';
import { screenOf, textOf } from './helpers';

interface IntroHook {
  screenshotName(name: string): string;
  settled(): Promise<void>;
}

test('intro', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = (): Promise<unknown> => page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);

  // A test build skips the intro at launch by default.
  await page.goto('/');
  await ready();
  await expect.poll(() => screenOf(page)).toBe('main_menu');

  // With the skip turned off, a first launch plays it.
  await page.goto('/?intro=on');
  await ready();
  await expect.poll(() => screenOf(page)).toBe('intro');
  expect(await textOf(page)).toContain('Any key or click to skip');
  await expect.poll(() => textOf(page), { timeout: 10_000 }).toContain('So seven of them packed a wagon');
  const path = await page.evaluate(() => (window as unknown as { __deepholm: IntroHook }).__deepholm.screenshotName('intro'));
  await page.screenshot({ path });

  // Any key skips it to the main menu, which offers it again.
  await page.keyboard.press('x');
  await expect.poll(() => screenOf(page)).toBe('main_menu');
  expect(await textOf(page)).toContain('[i] Intro');

  // The menu's Intro plays it again; a click skips it.
  await page.keyboard.press('i');
  await expect.poll(() => screenOf(page)).toBe('intro');
  await page.locator('canvas#screen').click();
  await expect.poll(() => screenOf(page)).toBe('main_menu');

  // It played at this launch, so the next launch goes straight to the menu.
  await page.evaluate(() => (window as unknown as { __deepholm: IntroHook }).__deepholm.settled());
  await page.goto('/?intro=on');
  await ready();
  await expect.poll(() => screenOf(page)).toBe('main_menu');

  expect(errors).toEqual([]);
});
