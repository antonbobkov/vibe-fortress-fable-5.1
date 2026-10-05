/** T-M4-17: fixed 36-cell buffers for the M4 fortress panels. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { WorkshopsReader } from '@systems/workshops';
import { drawAnimalsPanel } from '@ui/panels/animals';
import { drawMoodPanel } from '@ui/panels/mood';
import { drawPopulationPanel } from '@ui/panels/population';
import { drawOrdersPanel, drawWorkshopPanel } from '@ui/panels/orders';
import { drawZonesPanel } from '@ui/panels/zones';
import { MockCanvas, mockCanvasFactory } from '../../unit/render/canvas-mock';
import { cellRows, surface } from '../../unit/ui/ui-fixture';

const name = 'render/m4-panels';
const file = fileURLToPath(new URL('./m4-panels.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === name || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';
// U-03 (D-U5, S3): the "Add order" picker and the workshop panel joined the set.
const names = ['orders', 'picker', 'workshop', 'animals', 'wild', 'mood', 'population', 'farm'] as const;
type PanelName = typeof names[number];
interface PanelGolden { text: string[]; cells: string[][] }
let game: Game;
let carpenter = 0;
let golden: Record<string, PanelGolden> = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { panels: Record<string, PanelGolden> }).panels : {};

function render(which: PanelName): PanelGolden {
  const s = surface(36, 32);
  const rect = { col: 0, row: 0, cols: 36, rows: 32 };
  const f = game.fortress;
  if (which === 'orders') drawOrdersPanel(s, rect, f.orders, f.ctx);
  else if (which === 'picker') {
    f.orders.openPicker(f.ctx);
    drawOrdersPanel(s, rect, f.orders, f.ctx);
    f.orders.picker.open = false;
  } else if (which === 'workshop') drawWorkshopPanel(s, rect, carpenter, f.orders, f.ctx);
  else if (which === 'animals' || which === 'wild') {
    f.animals.tab = which === 'wild' ? 1 : 0;
    drawAnimalsPanel(s, rect, f.animals, f.ctx);
  } else if (which === 'mood') drawMoodPanel(s, rect, f.mood, f.ctx);
  else if (which === 'population') drawPopulationPanel(s, rect, f.ctx);
  else drawZonesPanel(s, rect, f.zones, f.ctx);
  return { text: s.lines(), cells: cellRows(s) };
}

describe('T-M4-17 golden: orders, animals, mood, population and farm settings', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 'm4-panels', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const map = game.host.readers.map;
    const tiles = [map.index(40, 30, game.ui.z), map.index(41, 30, game.ui.z)];
    game.host.submit({ type: 'CreateZone', zoneType: 'farm_plot', tiles });
    game.host.step(1);
    game.fortress.zones.selected = game.host.readers.of<BuildingsReader>('14').zoneAt(tiles[0] as number);
    const recipe = game.host.readers.of<WorkshopsReader>('12').recipesFor('still')[0];
    if (recipe === undefined) throw new Error('still recipe missing');
    game.host.submit({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId: recipe.id, mode: 'maintain', threshold: 20, remaining: 1, priority: 5 } });
    game.host.step(1);
    // A finished carpenter's workshop with one order for five doors (U-03).
    const buildings = game.host.readers.of<BuildingsReader>('14');
    const system = game.host.world.scheduler.byId('14') as BuildingsSystem;
    for (let y = 12; y < map.h - 12 && carpenter === 0; y += 1) for (let x = 12; x < map.w - 12 && carpenter === 0; x += 1) {
      const origin = map.index(x, y, game.ui.z);
      if (buildings.ghost('carpenter', origin, 0).reason !== null) continue;
      if (!game.host.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'carpenter', origin, orientation: 0, materialChoice: 0 }).ok) continue;
      carpenter = system.lastPlacedBuilding;
      system.completeNow(carpenter, game.host.headless.registry.table('materials').index('oak'));
    }
    if (carpenter === 0) throw new Error('no place for the carpenter');
    game.host.step(1);
    game.host.submit({ type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_door_wood', mode: 'once', threshold: 0, remaining: 5, priority: 5 } });
    game.host.step(1);
    if (update) {
      const next: Record<string, PanelGolden> = {};
      for (const panel of names) next[panel] = render(panel);
      writeFileSync(file, `${JSON.stringify({ $note: 'npm run golden:update -- render/m4-panels', panels: next }, null, 2)}\n`, 'utf8');
      golden = next;
    }
  });
  for (const panel of names) it(`${panel} matches its cell buffer`, () => {
    expect(golden[panel]).toBeDefined();
    expect(render(panel)).toEqual(golden[panel]);
  });
  it('shows the spec fields and the selected farm plot', () => {
    expect(render('orders').text.join('\n')).toContain('Standing orders');
    expect(render('orders').text.join('\n')).toContain('x5 Door · ');
    expect(render('picker').text.join('\n')).toContain('Add order');
    expect(render('workshop').text.join('\n')).toContain('[S-n] new order');
    expect(render('animals').text.join('\n')).toContain('Tame');
    expect(render('mood').text.join('\n')).toContain('Hall spirit');
    expect(render('farm').text.join('\n')).toContain('Spring');
  });
});
