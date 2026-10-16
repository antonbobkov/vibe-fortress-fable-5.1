/**
 * Layout smoke goldens of the fortress screen with the sidebar open: at 80 columns (a 1280×800
 * window) and at the wider default window (1600×900, 100 columns). They show that the screen is
 * laid out as before, not that its content is right: what each panel says is asserted by
 * `test/unit/ui/t332-panels-*.test.ts`.
 *
 * Wireframes from `04-implementation/ui-screens/fortress-screen.md`.
 * Updated via `npm run golden:update -- render/m8-panels`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { MockCanvas, mockCanvasFactory } from '../../unit/render/canvas-mock';
import { cellRows } from '../../unit/ui/ui-fixture';

const GOLDEN_NAME = 'render/m8-panels';
const file = fileURLToPath(new URL('./m8-panels.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === GOLDEN_NAME || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';

export interface PanelGolden {
  text: string[];
  cells: string[][];
}

export const PANELS = ['fortress_sidebar', 'fortress_wide'] as const;

export type PanelName = typeof PANELS[number];

let golden: Record<string, PanelGolden> = existsSync(file)
  ? (JSON.parse(readFileSync(file, 'utf8')) as { panels: Record<string, PanelGolden> }).panels
  : {};

async function renderPanel(name: PanelName): Promise<PanelGolden> {
  const game = new Game({
    canvas: new MockCanvas(),
    seed: 'm8-panels',
    registry: loadContent(),
    createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1,
    width: name === 'fortress_wide' ? 1600 : 1280,
    height: name === 'fortress_wide' ? 900 : 800,
  });
  await game.start({ embark: 'default' });
  game.fortress.tool.choose('d');
  // The tile cursor starts at the middle of the map the first time it is drawn, which is the middle
  // of the whole screen while the sidebar is shut; the sidebar then opens beside it.
  game.ui.panel = null;
  game.ui.sidebar = false;
  game.render();
  game.ui.panel = 'units';
  game.ui.sidebar = true;
  game.render();
  const s = game.uiSurface;
  if (!s) throw new Error('game surface missing after render');
  expect(game.viewCols).toBe(name === 'fortress_wide' ? 100 : 80);
  return { text: s.lines(), cells: cellRows(s) };
}

describe('layout smoke golden: the fortress screen with the sidebar open', () => {
  beforeAll(async () => {
    if (update) {
      const next: Record<string, PanelGolden> = {};
      for (const name of PANELS) next[name] = await renderPanel(name);
      writeFileSync(
        file,
        `${JSON.stringify({ $note: 'npm run golden:update -- render/m8-panels', panels: next }, null, 2)}
`,
        'utf8',
      );
      golden = next;
    }
  });

  for (const name of PANELS) {
    it(`${name} matches test/golden/render/m8-panels.json (${name === 'fortress_wide' ? '100' : '80'} columns)`, async () => {
      expect(golden[name]).toBeDefined();
      expect(await renderPanel(name)).toEqual(golden[name]);
    });
  }
});
