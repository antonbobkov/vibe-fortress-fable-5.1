/**
 * T-M8-04 golden renders: designate tool, remaining fortress panels, and full fortress screen wireframes.
 *
 * Wireframes from `04-implementation/ui-screens/panels.md` and `fortress-screen.md`.
 * Updated via `npm run golden:update -- render/m8-panels`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { drawCalendarPanel } from '@ui/panels/calendar';
import { type DebugHost, drawDebugPanel } from '@ui/panels/debug';
import { drawDesignatePanel } from '@ui/panels/designate';
import { drawHelpPanel } from '@ui/panels/help';
import { drawOverlaysPanel } from '@ui/panels/overlays';
import { MockCanvas, mockCanvasFactory } from '../../unit/render/canvas-mock';
import { cellRows, strings, surface } from '../../unit/ui/ui-fixture';

const GOLDEN_NAME = 'render/m8-panels';
const file = fileURLToPath(new URL('./m8-panels.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === GOLDEN_NAME || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';

export interface PanelGolden {
  text: string[];
  cells: string[][];
}

export const PANELS = [
  'designate',
  'overlays',
  'help_keys',
  'help_legend',
  'debug',
  'calendar',
  'fortress_closed',
  'fortress_sidebar',
] as const;

export type PanelName = typeof PANELS[number];

let game: Game;
let golden: Record<string, PanelGolden> = existsSync(file)
  ? (JSON.parse(readFileSync(file, 'utf8')) as { panels: Record<string, PanelGolden> }).panels
  : {};

function renderPanel(name: PanelName): PanelGolden {
  const f = game.fortress;

  switch (name) {
    case 'designate': {
      const s = surface(36, 32);
      const rect = { col: 0, row: 0, cols: 36, rows: 32 };
      f.tool.choose('d');
      drawDesignatePanel(s, rect, f.tool, strings);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'overlays': {
      const s = surface(36, 32);
      const rect = { col: 0, row: 0, cols: 36, rows: 32 };
      drawOverlaysPanel(s, rect, f.overlayMenu, game.ui.overlays);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'help_keys': {
      const s = surface(40, 30);
      const rect = { col: 0, row: 0, cols: 40, rows: 30 };
      f.help.tab = 0;
      drawHelpPanel(s, rect, f.help);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'help_legend': {
      const s = surface(40, 30);
      const rect = { col: 0, row: 0, cols: 40, rows: 30 };
      f.help.tab = 1;
      drawHelpPanel(s, rect, f.help);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'debug': {
      const s = surface(40, 30);
      const rect = { col: 0, row: 0, cols: 40, rows: 30 };
      const debugHost: DebugHost = {
        stats: () => game.host.world.stats(),
        seed: () => game.host.world.seed,
        dumpSave: () => {},
        replaySeasonLog: () => {},
        hashWorld: () => {},
      };
      drawDebugPanel(s, rect, f.debugPanel, f.ctx, debugHost);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'calendar': {
      const s = surface(36, 24);
      const rect = { col: 0, row: 0, cols: 36, rows: 24 };
      drawCalendarPanel(s, rect, game.host.readers, strings);
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'fortress_closed': {
      game.ui.panel = null;
      game.ui.sidebar = false;
      game.render();
      const s = game.uiSurface;
      if (!s) throw new Error('game surface missing after render');
      return { text: s.lines(), cells: cellRows(s) };
    }

    case 'fortress_sidebar': {
      game.ui.panel = 'units';
      game.ui.sidebar = true;
      game.render();
      const s = game.uiSurface;
      if (!s) throw new Error('game surface missing after render');
      return { text: s.lines(), cells: cellRows(s) };
    }
  }
}

describe('T-M8-04 golden: designate, overlays, help, debug, calendar, and full fortress screens', () => {
  beforeAll(async () => {
    game = new Game({
      canvas: new MockCanvas(),
      seed: 'm8-panels',
      registry: loadContent(),
      createCanvas: mockCanvasFactory(),
      devicePixelRatio: 1,
      width: 1280,
      height: 800,
    });
    await game.start({ embark: 'default' });

    if (update) {
      const next: Record<string, PanelGolden> = {};
      for (const name of PANELS) next[name] = renderPanel(name);
      writeFileSync(
        file,
        `${JSON.stringify({ $note: 'npm run golden:update -- render/m8-panels', panels: next }, null, 2)}\n`,
        'utf8',
      );
      golden = next;
    }
  });

  for (const name of PANELS) {
    it(`${name} matches test/golden/render/m8-panels.json`, () => {
      expect(golden[name]).toBeDefined();
      expect(renderPanel(name)).toEqual(golden[name]);
    });
  }
});
