/**
 * T-422: the music volume and the music on/off setting change from Settings and from the mute key,
 * and survive a page reload (24 § Music). The e2e build plays no sound: no audio context is made,
 * whatever keys and clicks the test gives.
 */
import { expect, test, type Page } from '@playwright/test';
import { focusMenu, screenOf, textOf } from './helpers';

interface Hook { settled(): Promise<void> }

/** Count every audio context the page makes, from before its first script. */
async function countAudioContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w['__audioContexts'] = 0;
    for (const name of ['AudioContext', 'webkitAudioContext']) {
      const Real = w[name] as (new (...args: unknown[]) => object) | undefined;
      if (Real === undefined) continue;
      w[name] = class extends Real {
        constructor(...args: unknown[]) {
          super(...args);
          w['__audioContexts'] = (w['__audioContexts'] as number) + 1;
        }
      };
    }
  });
}

async function audioContexts(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts);
}

async function openSettings(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('main_menu');
  await focusMenu(page);
  await page.keyboard.press('o');
  await expect.poll(() => screenOf(page)).toBe('settings');
}

test('T-422 music settings: volume and the mute key persist, and no sound is made', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await countAudioContexts(page);
  await openSettings(page);
  expect(await textOf(page)).toMatch(/Music volume +\[50%\]/);
  expect(await textOf(page)).toMatch(/Music +\[on\]/);
  // Music volume is the row after Keybindings: down to it, two steps quieter.
  for (let n = 0; n < 10; n += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => textOf(page)).toMatch(/Music volume +\[30%\]/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toMatch(/Music +\[off\]/);

  // The mute key acts here too, and the browser does not get it.
  const prevented = await page.evaluate(() => {
    const seen: boolean[] = [];
    window.addEventListener('keydown', (event) => { if (event.ctrlKey && event.key.toLowerCase() === 'm') seen.push(event.defaultPrevented); });
    (window as unknown as { __mute: boolean[] }).__mute = seen;
    return seen;
  });
  expect(prevented).toEqual([]);
  await page.keyboard.press('Control+m');
  await expect.poll(() => textOf(page)).toMatch(/Music +\[on\]/);
  await page.keyboard.press('Control+m');
  await expect.poll(() => textOf(page)).toMatch(/Music +\[off\]/);
  expect(await page.evaluate(() => (window as unknown as { __mute: boolean[] }).__mute)).toEqual([true, true]);
  await page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.settled());

  await openSettings(page);
  expect(await textOf(page)).toMatch(/Music volume +\[30%\]/);
  expect(await textOf(page)).toMatch(/Music +\[off\]/);
  // Back to the menu, music on with the key: the menu plays nothing in an e2e build.
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('main_menu');
  await page.keyboard.press('Control+m');
  await page.keyboard.press('o');
  await expect.poll(() => textOf(page)).toMatch(/Music +\[on\]/);
  expect(await audioContexts(page)).toBe(0);
  expect(errors).toEqual([]);
});
