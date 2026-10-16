/**
 * T-M8-04 golden renders: outside screens and modal dialogs.
 *
 * Wireframes from `04-implementation/ui-screens/menus-and-world.md`,
 * `embark.md`, and `fortress-screen.md` § Game menu.
 * Updated via `npm run golden:update -- render/m8-screens`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderScreen, SCREENS, type ScreenGolden } from '../../unit/ui/screen-fixtures';

const GOLDEN_NAME = 'render/m8-screens';
const file = fileURLToPath(new URL('./m8-screens.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === GOLDEN_NAME || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';

let golden: Record<string, ScreenGolden> = existsSync(file)
  ? (JSON.parse(readFileSync(file, 'utf8')) as { screens: Record<string, ScreenGolden> }).screens
  : {};

describe('T-M8-04 golden: outside screens and modal dialogs', () => {
  beforeAll(() => {
    if (update) {
      const next: Record<string, ScreenGolden> = {};
      for (const name of SCREENS) next[name] = renderScreen(name);
      writeFileSync(
        file,
        `${JSON.stringify({ $note: 'npm run golden:update -- render/m8-screens', screens: next }, null, 2)}\n`,
        'utf8',
      );
      golden = next;
    }
  });

  for (const name of SCREENS) {
    it(`${name} matches test/golden/render/m8-screens.json`, () => {
      expect(golden[name]).toBeDefined();
      expect(renderScreen(name)).toEqual(golden[name]);
    });
  }
});
