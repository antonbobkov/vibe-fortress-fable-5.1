/**
 * T-755: the tutorial's steps pass only when their job is done (a stockpile that takes something,
 * a farm plot with a crop for the season), time is taught third, and each text's keys work from
 * where the step before leaves the player (`ui-screens/menus-and-world.md` § Tutorial;
 * `03-content/ui-keymap-and-screens.md` § Tutorial).
 */
import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { PlantsReader } from '@systems/plants';
import { Keymap, type KeySpec } from '@ui/keymap';
import { readTutorialFacts, Tutorial, tutorialCheck, type TutorialMemo, type TutorialStep } from '@ui/tutorial';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, registry, strings } from './ui-fixture';

const steps = registry.derived<readonly TutorialStep[]>('tutorial');

async function paused(seed: string): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), seed, registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  return g;
}

function cell(g: Game, col: number, row: number): { x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean } {
  const c = g.cellCenter(col, row);
  return { x: c.x, y: c.y, button: 0, shift: false, ctrl: false, alt: false, meta: false };
}

function drag(g: Game, from: [number, number], to: [number, number]): void {
  g.pointerDown(cell(g, from[0], from[1]));
  g.pointerMove(cell(g, to[0], to[1]));
  g.pointerUp(cell(g, to[0], to[1]));
}

/** The map cell of the top-left of a `w` × `h` rectangle of tiles that may all join a new zone of `type`. */
function rectFor(g: Game, type: string, w: number, h: number): [number, number] {
  const map = g.host.readers.map;
  const z = g.ui.z;
  for (let y = g.ui.camY + 2; y < g.ui.camY + 40; y += 1) {
    for (let x = g.ui.camX + 2; x < g.ui.camX + 40; x += 1) {
      let ok = true;
      for (let dy = 0; dy < h && ok; dy += 1) for (let dx = 0; dx < w && ok; dx += 1) ok = g.fortress.zones.tileOk(g.fortress.ctx, type, map.index(x + dx, y + dy, z));
      if (ok) return [x - g.ui.camX, y - g.ui.camY];
    }
  }
  throw new Error(`no ${w}x${h} rectangle for ${type}`);
}

/** The step's check against the fortress as it is now, with the memo of the step so far. */
function holds(g: Game, check: string, memo: TutorialMemo): boolean {
  const facts = readTutorialFacts({ readers: g.host.readers, registry, camX: g.ui.camX, camY: g.ui.camY, z: g.ui.z,
    viewCols: 10, viewRows: 10, lookTile: null, speed: 0, saves: 0 });
  return tutorialCheck(check, facts, memo);
}

/** A stockpile drawn as the stockpile step says: Zones, the stockpile kind, a drag over open floor. */
function drawStockpile(g: Game): number {
  g.handleKey(press('z'));
  g.handleKey(press('s'));
  const at = rectFor(g, 'stockpile', 3, 2);
  drag(g, at, [at[0] + 2, at[1] + 1]);
  const piles = g.host.readers.of<BuildingsReader>('14').zonesOfType('stockpile');
  expect(piles).toHaveLength(1);
  return piles[0] as number;
}

function spec(k: string, mods: Partial<KeySpec> = {}): KeySpec {
  return { key: k, ctrl: false, shift: false, ...mods };
}

function bindingIndex(keys: Keymap, context: string, id: string): number {
  const index = keys.bindings.findIndex((b) => b.context === context && b.id === id);
  expect(index, `${context} ${id}`).toBeGreaterThanOrEqual(0);
  return index;
}

describe('T-755 the tutorial: the order', () => {
  it('teaches time third, after looking and before the first job, and the dig text says how to start the work', () => {
    expect(steps.map((s) => s.id)).toEqual(['view', 'look', 'speed', 'dig', 'stairs', 'stockpile', 'workshop', 'order', 'farm', 'labors', 'save']);
    expect(steps.map((s) => s.check)).toEqual(['view_moved', 'looked', 'paused_and_sped', 'dig_designated', 'stairs_designated',
      'stockpile_made', 'workshop_placed', 'order_queued', 'farm_plot_made', 'labors_changed', 'saved']);
    const dig = strings.get('tutorial.dig');
    expect(dig).toContain('They start once time runs: [Space].');
    // The dig stays on the surface: no level change before the box (the stairs step teaches going down).
    expect(dig).not.toContain('[<]');
  });
});

describe('T-755 the tutorial: a step passes when its job is done', () => {
  it('a stockpile with the Nothing preset leaves the stockpile step open; Everything, by [p] from its settings, passes it', async () => {
    const g = await paused('t755-pile');
    const memo: TutorialMemo = {};
    expect(holds(g, 'stockpile_made', memo)).toBe(false);
    const pile = drawStockpile(g);
    expect(g.fortress.zones.selected, 'the new stockpile\'s settings show').toBe(pile);
    expect(holds(g, 'stockpile_made', memo), 'a stockpile that takes nothing').toBe(false);
    // As the text says, from where the drag leaves the player: [p], then Everything (the last preset).
    g.handleKey(press('p'));
    g.handleKey(press('↑'));
    g.handleKey(press('Enter'));
    expect(g.host.readers.of<ItemsReader>('13').stockpile(pile)?.filter.categories.length).toBeGreaterThan(0);
    expect(holds(g, 'stockpile_made', memo)).toBe(true);
  });

  it('a farm plot with no crop for this season leaves the farm step open; a crop chosen by Enter, ↓ and Enter passes it', async () => {
    const g = await paused('t755-farm');
    const memo: TutorialMemo = {};
    g.handleKey(press('z'));
    g.handleKey(press('f'));
    const at = rectFor(g, 'farm_plot', 2, 2);
    drag(g, at, [at[0] + 1, at[1] + 1]);
    const plots = g.host.readers.of<BuildingsReader>('14').zonesOfType('farm_plot');
    expect(plots).toHaveLength(1);
    const plot = plots[0] as number;
    const season = g.host.readers.calendar.season;
    expect(holds(g, 'farm_plot_made', memo), 'a plot with no crop').toBe(false);
    // A crop for another season only is not this season's crop.
    const next = (season + 1) % 4;
    const other = registry.table<{ id: string; kind: string; seasons?: readonly number[] }>('plants').rows
      .find((p) => p?.kind === 'crop' && p.seasons?.includes(next) === true && p.seasons.includes(season) === false);
    if (other !== undefined) {
      g.host.submit({ type: 'SetPlotCrop', zoneId: plot, season: next, speciesId: other.id });
      g.host.step(1);
      expect(g.host.readers.of<PlantsReader>('07').plotSettings(plot)[next]).not.toBe(0);
      expect(holds(g, 'farm_plot_made', memo), 'a crop for next season only').toBe(false);
    }
    // As the text says: Enter lists this season's crops, ↓ and Enter choose one.
    g.handleKey(press('Enter'));
    g.handleKey(press('↓'));
    g.handleKey(press('Enter'));
    g.host.step(1);
    expect(g.host.readers.of<PlantsReader>('07').plotSettings(plot)[season]).not.toBe(0);
    expect(holds(g, 'farm_plot_made', memo)).toBe(true);
  });
});

describe('T-755 the tutorial: the keys work from where the player is', () => {
  it('the workshop step: Esc twice from a zone\'s settings, or once from the Zones menu, then [b] opens Build', async () => {
    const g = await paused('t755-build');
    drawStockpile(g);
    // The old text's one Esc lands on the Zones menu, where b is Bedroom (the playtest's trouble).
    g.handleKey(press('Esc'));
    expect(g.ui.panel).toBe('zones');
    g.handleKey(press('b'));
    expect(g.ui.panel).toBe('zones');
    expect(g.fortress.zones.kind).toBe('bedroom');

    const h = await paused('t755-build-2');
    drawStockpile(h);
    h.handleKey(press('p'));
    h.handleKey(press('↑'));
    h.handleKey(press('Enter'));
    h.handleKey(press('Esc'));
    h.handleKey(press('Esc'));
    expect(h.ui.panel).toBeNull();
    h.handleKey(press('b'));
    expect(h.ui.panel).toBe('build');

    // From the Zones menu, one Esc closes it.
    h.handleKey(press('Esc'));
    h.handleKey(press('z'));
    expect(h.ui.panel).toBe('zones');
    h.handleKey(press('Esc'));
    h.handleKey(press('b'));
    expect(h.ui.panel).toBe('build');
  });

  it('a rebound [p] (the stockpile\'s preset) and [b] show as rebound; the pasture\'s [p] is not the preset; Esc is fixed', () => {
    const keys = new Keymap(keymap.bindings);
    expect(keys.rebind(bindingIndex(keys, 'zones_panel', 'pasture'), spec('v'))).toBeNull();
    const t = new Tutorial(steps, strings, keys);
    t.index = steps.findIndex((s) => s.id === 'stockpile');
    // Only the pasture moved: after [z] and [s] the [p] is the zone inspector's, which is not rebound.
    expect(t.text()).toContain('choose its Preset with [p]');
    expect(keys.rebind(bindingIndex(keys, 'zone_inspector', 'preset'), spec('j'))).toBeNull();
    expect(keys.rebind(bindingIndex(keys, 'fortress_panel', 'build'), spec('q'))).toBeNull();
    expect(t.text()).toContain('choose its Preset with [j]');
    t.index = steps.findIndex((s) => s.id === 'workshop');
    expect(t.text()).toContain('Close Zones with Esc (twice from a zone\'s settings), then open Build with [q] and [w]');
    expect(keys.fixed(bindingIndex(keys, 'global', 'cancel'))).toBe(true);
  });
});
