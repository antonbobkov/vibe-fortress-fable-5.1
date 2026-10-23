/**
 * T-424: every key binding is configurable from the menu. Settings › Keybindings rebinds a map key
 * and a panel key; both act at once, the old keys do not, and both survive a page reload; "all
 * defaults" puts every key back (`ui-keymap-and-screens.md` § Keymap, 24 § Settings).
 */
import { expect, test, type Page } from '@playwright/test';
import { screenOf, textOf } from './helpers';

interface KeysHook {
  readers: { ui: { z: number; panel: string | null } };
  settled(): Promise<void>;
}

const START = '/?start=flat-test&embark=default';

async function zOf(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __deepholm: KeysHook }).__deepholm.readers.ui.z);
}

async function panelOf(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as unknown as { __deepholm: KeysHook }).__deepholm.readers.ui.panel);
}

async function openFortress(page: Page): Promise<void> {
  await page.goto(START);
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');
  await page.locator('canvas#screen').click();
}

/** From the fortress: the game menu, Settings, the Keybindings list. */
async function openKeybindings(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('game_menu');
  await page.keyboard.press('o');
  await expect.poll(() => screenOf(page)).toBe('settings');
  for (let n = 0; n < 9; n += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Settings · Keybindings');
}

/** Back from the Keybindings list to the fortress. */
async function closeKeybindings(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('game_menu');
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('fortress');
}

/** Move the editor's cursor onto the row of `action` under the heading `context`, with the keyboard only. */
async function selectBinding(page: Page, context: string, action: string): Promise<void> {
  for (let step = 0; step < 200; step += 1) {
    const rows = (await textOf(page)).split('\n').map((row) => row.trim());
    const cursor = rows.findIndex((row) => row.startsWith('►'));
    const heading = rows.indexOf(context);
    const target = heading < 0 ? -1 : rows.findIndex((row, k) => k > heading && row.replace(/^► /, '').startsWith(action));
    if (target >= 0 && target === cursor) return;
    if (target >= 0) await page.keyboard.press(target > cursor ? 'ArrowDown' : 'ArrowUp');
    else await page.keyboard.press('PageDown');
  }
  throw new Error(`no binding "${action}" under "${context}"`);
}

async function rebind(page: Page, context: string, action: string, key: string): Promise<void> {
  await selectBinding(page, context, action);
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Press a key');
  await page.keyboard.press(key);
  await expect.poll(() => textOf(page)).toContain('[Enter] rebind');
}

/** `<` (Map: z-level down) and `i` (Units panel: idle only), and their new keys `q` and `h`. */
async function useBoth(page: Page, rebound: boolean): Promise<void> {
  const z = await zOf(page);
  await page.keyboard.press(rebound ? '<' : 'q');
  expect(await zOf(page)).toBe(z);
  await page.keyboard.press(rebound ? 'q' : '<');
  await expect.poll(() => zOf(page)).toBe(z - 1);
  await page.keyboard.press('>');
  await expect.poll(() => zOf(page)).toBe(z);

  await page.keyboard.press('u');
  await expect.poll(() => panelOf(page)).toBe('units');
  await page.keyboard.press(rebound ? 'i' : 'h');
  expect(await textOf(page)).not.toMatch(/Units · idle/);
  await page.keyboard.press(rebound ? 'h' : 'i');
  await expect.poll(() => textOf(page)).toMatch(/Units · idle/);
  await page.keyboard.press(rebound ? 'h' : 'i');
  await expect.poll(() => textOf(page)).not.toMatch(/Units · idle/);
  await page.keyboard.press('u');
  await expect.poll(() => panelOf(page)).toBeNull();
}

test('T-424 keybindings: rebind a map key and a panel key, use them, reload, reset all', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openFortress(page);
  await useBoth(page, false);

  await openKeybindings(page);
  await rebind(page, 'Map', 'z-level down', 'q');
  expect(await textOf(page)).toMatch(/z-level down +q {2}\(default <\)/);
  await rebind(page, 'Units panel', 'show only idle dwarves / all', 'h');
  expect(await textOf(page)).toMatch(/show only idle dwarves \/ all +\[h\] {2}\(default \[i\]\)/);
  await page.evaluate(() => (window as unknown as { __deepholm: KeysHook }).__deepholm.settled());
  await closeKeybindings(page);
  await useBoth(page, true);

  // The keymap is a preference: a reload keeps it.
  await openFortress(page);
  await useBoth(page, true);

  await openKeybindings(page);
  await page.keyboard.press('d');
  await expect.poll(() => textOf(page)).toContain('Every key is back to its default.');
  await page.evaluate(() => (window as unknown as { __deepholm: KeysHook }).__deepholm.settled());
  await closeKeybindings(page);
  await useBoth(page, false);

  await openFortress(page);
  await useBoth(page, false);
  expect(errors).toEqual([]);
});
