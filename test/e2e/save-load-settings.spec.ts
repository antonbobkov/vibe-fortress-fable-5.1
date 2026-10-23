/** T-M7-07: settings survive page reload and do not disturb save continuity. */
import { expect, test } from '@playwright/test';
import { focusMenu, screenOf, textOf } from './helpers';

interface SettingsHook {
  readers: { ui: { zoom: number } };
  host: { speed(): number };
  screen(): string;
  hash(): string;
  step(ticks: number): void;
  settled(): Promise<void>;
  lastSaveId(): string | null;
}

test('T-M7-07 save-load-settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await focusMenu(page);
  await page.keyboard.press('o');
  await expect.poll(() => screenOf(page)).toBe('settings');
  for (let n = 0; n < 4; n += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  expect(await textOf(page)).toContain('[0.75x]');
  for (let n = 0; n < 5; n += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await textOf(page)).toContain('Keybindings');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  // T-424: `v` is a zone inspector and military key, which the pause key acts beside.
  await page.keyboard.press('F8');
  expect(await textOf(page)).toMatch(/pause \/ resume +F8/);
  await page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.settled());

  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');
  expect(await page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.readers.ui.zoom)).toBe(0.75);
  await page.locator('canvas#screen').click();
  await page.keyboard.press('F8');
  expect(await page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.host.speed())).toBe(1);
  await page.keyboard.press('F8');
  expect(await page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.host.speed())).toBe(0);
  await page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.step(40));
  const saved = await page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.hash());
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(async () => {
    const h = (window as unknown as { __deepholm: SettingsHook }).__deepholm;
    await h.settled();
    return h.lastSaveId();
  })).toMatch(/^manual-\d+$/);
  await page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.step(60));
  expect(await page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.hash())).not.toBe(saved);
  await page.keyboard.press('F9');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  await page.keyboard.press('y');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __deepholm: SettingsHook }).__deepholm.hash())).toBe(saved);
  expect(await screenOf(page)).toBe('fortress');
  expect(errors).toEqual([]);
});
