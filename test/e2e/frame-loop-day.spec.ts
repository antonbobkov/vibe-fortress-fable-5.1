/**
 * E2E `frame-loop-day` (T-221) of `process/testing-strategy.md` § E2E harness: one game day runs
 * through the real frame loop at 4x. The spec asserts that the calendar advances by a day and
 * nothing else about the simulation, because real time decides how many ticks the loop has run
 * when the assertion is made. `full-year` gives all its commands with the clock paused and steps
 * time through the hook, so that its year is the same on every run.
 */

import { expect, test } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf } from './helpers';
import { TICKS_PER_DAY } from '../../src/core/constants';

interface FrameLoopHook {
  host: { speed(): number };
  readers: { calendar: { tick: number; dayOfYear: number } };
}

test('frame-loop-day', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await generateWorld(page, 'e2e-frame-loop');
  await findEmbarkableRegion(page);
  await expect.poll(() => textOf(page)).toContain('Wealth');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await expect.poll(() => textOf(page)).toContain('Balanced');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Spent 1,480');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');

  const read = (): Promise<{ speed: number; tick: number; dayOfYear: number }> =>
    page.evaluate(() => {
      const h = (window as unknown as { __deepholm: FrameLoopHook }).__deepholm;
      return { speed: h.host.speed(), tick: h.readers.calendar.tick, dayOfYear: h.readers.calendar.dayOfYear };
    });

  const opening = await read();
  expect(opening.speed, 'the fortress opens paused').toBe(0);

  // Space starts the clock at 1x, `+` twice steps it to 4x.
  await page.keyboard.press('Space');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await expect.poll(() => textOf(page)).toContain('4x');

  await expect
    .poll(async () => (await read()).tick, { timeout: 120_000, intervals: [500] })
    .toBeGreaterThanOrEqual(opening.tick + TICKS_PER_DAY);

  // Pause again and read the calendar once: it has left the first day.
  await page.keyboard.press('Space');
  const after = await read();
  expect(after.speed, 'Space paused the clock').toBe(0);
  expect(after.tick - opening.tick, 'a day has elapsed through the frame loop').toBeGreaterThanOrEqual(TICKS_PER_DAY);
  expect(after.dayOfYear, 'the calendar has moved to a later day').toBeGreaterThan(opening.dayOfYear);

  expect(errors).toEqual([]);
});
