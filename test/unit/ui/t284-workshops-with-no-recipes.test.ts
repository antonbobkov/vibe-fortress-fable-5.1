/**
 * T-284: a workshop that no recipe names is not offered in the build menu, is refused by PlaceBuilding,
 * and a kiln an older save already holds shows that it has nothing to make and can be taken apart.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { TileKind } from '@core/map3d';
import type { BuildingRow } from '@systems/buildings';
import type { WorkshopsReader } from '@systems/workshops';
import { rejectionText } from '@ui/messages';
import { BUILD_CATEGORIES } from '@ui/panels/build';
import { drawWorkshopPanel, OrdersPanel } from '@ui/panels/orders';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { registry, strings, surface } from './ui-fixture';

describe('T-284 the build menu', () => {
  it('lists exactly the workshops that a recipe or a job names, and every other building but the wagon', async () => {
    const g = new Game({ canvas: new MockCanvas(), seed: 't284-menu', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await g.start({ embark: 'default' });
    const reader = g.host.readers.of<WorkshopsReader>('12');
    const all = g.registry.table<BuildingRow>('buildings').rows;
    const offered = new Set<string>();
    for (const category of BUILD_CATEGORIES) {
      g.fortress.build.choose(category.key);
      for (const row of g.fortress.build.rows(g.fortress.ctx)) offered.add(row.id);
    }
    const workshops = all.filter((row) => row.category === 'workshop');
    expect(workshops.some((row) => reader.recipesFor(row.id).length === 0)).toBe(true);
    // A workshop is offered when a recipe names it or a job is worked at it: the butcher's shop and the kennel have no recipes.
    const jobs = g.registry.table<{ id: string; workshop?: string }>('jobTypes').rows;
    for (const row of workshops) expect(offered.has(row.id), row.id).toBe(reader.recipesFor(row.id).length > 0 || jobs.some((job) => job.workshop === row.id));
    expect(offered.has('butcher')).toBe(true);
    expect(offered.has('kennel')).toBe(true);
    expect(offered.has('magma_kiln')).toBe(false);
    for (const row of all.filter((r) => r.category !== 'workshop' && r.id !== 'wagon')) expect(offered.has(row.id), row.id).toBe(true);
    expect(offered.has('wagon')).toBe(false);
  });
});

describe('T-284 PlaceBuilding', () => {
  it('refuses a workshop no recipe or job names, and says "Nothing can be made there yet."', () => {
    const w = new TestWorld({ seed: 't284-refuse', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    const below = w.map.below(at);
    w.carve(below, TileKind.Open);
    w.setFluid(below, 7, 'magma', true);
    const command = { type: 'PlaceBuilding', buildingType: 'magma_kiln', origin: at, orientation: 0, materialChoice: 'granite' } as const;
    const before = w.game.hash();
    expect(w.game.world.applyCommand(command)).toEqual({ ok: false, reason: 'precondition_failed' });
    expect(w.game.hash()).toBe(before);
    expect(rejectionText({ readers: w.readers, registry, strings }, command, 'precondition_failed')).toBe('Nothing can be made there yet.');
    // A workshop with recipes is still placed.
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'carpenter', origin: w.index(25, 25, 32), orientation: 0, materialChoice: 'oak' }).ok).toBe(true);
  });
});

describe('T-284 a kiln that a save already holds', () => {
  it('loads, is listed with its type, and its panel says there are no recipes and offers only taking it apart', () => {
    const w = new TestWorld({ seed: 't284-old-kiln', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    const below = w.map.below(at);
    w.carve(below, TileKind.Open);
    w.setFluid(below, 7, 'magma', true);
    w.buildUnchecked('magma_kiln', at, 'granite');
    w.step(1);
    const loaded = roundTrip(w.game).game;
    const readers = loaded.world.readers;
    const kiln = readers.of<{ byType(type: string): number[] }>('14').byType('magma_kiln')[0] as number;
    expect(kiln).toBeGreaterThan(0);
    const ctx: PanelContext = { readers, registry, strings, submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
    const s = surface(36, 30);
    const acted: string[] = [];
    drawWorkshopPanel(s, { col: 0, row: 0, cols: 36, rows: 30 }, kiln, new OrdersPanel(), ctx, (action) => acted.push(action));
    const rows = s.lines().map((line) => line.trim());
    expect(rows[0]).toMatch(/^Magma kiln #\d+$/);
    expect(rows[1]).toBe('No recipes in this version.');
    expect(rows[3]).toBe('[x] take apart');
    expect(rows.filter((row) => row !== '')).toHaveLength(3);
    const at2 = s.lines()[3]!.indexOf('[x]');
    s.hitAt(at2 + 1, 3)?.action();
    expect(acted).toEqual(['deconstruct']);
  });
});
