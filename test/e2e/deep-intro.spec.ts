/**
 * E2E `deep-intro` (T-433, `ui-screens/menus-and-world.md` § Intro, `03-content/deep-intro.md`): a
 * first launch with the test build's skip turned off (`?intro=on`) plays the deep intro, the default
 * Intro style. The page's clock is held and moved on by hand, so three moments of it are saved as
 * screenshots: the descent, the eye and the title. A key skips it to the main menu.
 */

import { expect, test } from '@playwright/test';
import { screenOf, textOf } from './helpers';

interface IntroHook {
  screenshotName(name: string): string;
}

test('deep-intro', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const start = new Date('2026-10-23T12:00:00Z').getTime();
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 10);
  await page.goto('/?intro=on');
  await page.waitForSelector('canvas#screen');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined)).toBe(true);
  await expect.poll(() => screenOf(page)).toBe('intro');

  let at = 0;
  const shoot = async (ms: number, name: string, says: string): Promise<void> => {
    await page.clock.runFor(ms - at);
    at = ms;
    await expect.poll(() => textOf(page)).toContain(says);
    const path = await page.evaluate((n) => (window as unknown as { __deepholm: IntroHook }).__deepholm.screenshotName(n), name);
    await page.screenshot({ path });
  };
  await shoot(1000, 'deep-intro-card', 'Chapter I: The Lantern');
  await shoot(6000, 'deep-intro-descent', 'Somebody always has to go down first.');
  await shoot(24000, 'deep-intro-eye', 'Any key or click to skip');
  await shoot(46000, 'deep-intro-title', 'a hall beneath the world');

  await page.keyboard.press('x');
  await page.clock.runFor(100);
  await expect.poll(() => screenOf(page)).toBe('main_menu');
  expect(errors).toEqual([]);
});
