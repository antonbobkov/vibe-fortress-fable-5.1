/**
 * Shared steps of the M1 e2e tests: they drive the real keyboard and read state only through
 * `window.__deepholm` (`01-testing-strategy.md` § E2E harness).
 */

import { expect, type Page } from '@playwright/test';

export interface Hook {
  screen(): string;
  text(): string[];
  cells(): { cols: number; rows: number; glyph: number[]; fg: number[]; bg: number[] };
  cellCenter(col: number, row: number): { x: number; y: number };
  screenshotName(name: string): string;
}

export async function screenOf(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.screen());
}

export async function textOf(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.text().join('\n'));
}

/** Main menu → New world → the seed typed into the field → Generate → the world map. */
export async function generateWorld(page: Page, seed: string): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('main_menu');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('n');
  await expect.poll(() => screenOf(page)).toBe('world_gen');
  for (let k = 0; k < 40; k += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type(seed);
  await page.keyboard.press('Enter');
  await page.keyboard.press('g');
  await expect.poll(() => textOf(page), { timeout: 30_000 }).toContain('Stage: names');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('world_map');
}

/** Walk the world-map cursor until the region panel shows a region that can be embarked on. */
export async function findEmbarkableRegion(page: Page): Promise<void> {
  if ((await textOf(page)).includes('Wealth')) return;
  for (let step = 0; step < 32; step += 1) {
    await page.keyboard.press('ArrowRight');
    if ((await textOf(page)).includes('Wealth')) return;
    await page.keyboard.press('ArrowDown');
    if ((await textOf(page)).includes('Wealth')) return;
  }
}
