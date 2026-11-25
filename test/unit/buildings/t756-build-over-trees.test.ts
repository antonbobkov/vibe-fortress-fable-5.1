import { describe, expect, it } from 'vitest';
import { Designation, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings } from '../ui/ui-fixture';

const Z = 32;
const bld = (w: TestWorld): BuildingsReader => w.readers.of<BuildingsReader>('14');
const materialOf = (w: TestWorld, id: string): number => w.game.registry.table('materials').index(id);
const world = (seed: string): TestWorld => new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
const jobs = (w: TestWorld): { byKey(k: string): unknown } => w.readers.of<{ byKey(k: string): unknown }>('11');

function plant(w: TestWorld, tile: TileIndex, kind: TileKind, species: string): void {
  w.game.world.services.terrain.setKind(tile, kind, materialOf(w, species));
}

function place(w: TestWorld, type: string, origin: TileIndex, priority = 5): { result: { ok: boolean; reason?: string }; id: number } {
  const result = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, priority }) as { ok: boolean; reason?: string };
  return { result, id: (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding };
}

/** A carpenter's workshop at (40, 40) over trees at its corners (40, 40) and (42, 42), a shrub at (41, 40), and a tree beside it at (44, 41). */
function site(seed: string): { w: TestWorld; origin: TileIndex; trees: TileIndex[]; shrub: TileIndex; beside: TileIndex } {
  const w = world(seed);
  const origin = w.index(40, 40, Z);
  const trees = [w.index(40, 40, Z), w.index(42, 42, Z)];
  const shrub = w.index(41, 40, Z);
  const beside = w.index(44, 41, Z);
  for (const t of trees) plant(w, t, TileKind.Tree, 'oak');
  plant(w, shrub, TileKind.Shrub, 'bramble');
  plant(w, beside, TileKind.Tree, 'oak');
  return { w, origin, trees, shrub, beside };
}

function screenOver(w: TestWorld): FortressScreen {
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(Z), submit: (cmd) => w.submit(cmd),
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => layout, precondition: () => true, registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 1000, confirm: (_id, _params, reply) => reply(true),
  };
  return new FortressScreen(host, keymap, strings);
}

describe('T-756 a building placed over grown trees fells them first', () => {
  it('a workshop over two trees and a shrub is accepted, marks both trees, and is built once they fall', () => {
    const { w, origin, trees, shrub, beside } = site('t756-build');
    expect(bld(w).ghost('carpenter', origin, 0)).toMatchObject({ reason: null, clears: [shrub], fells: trees });
    const { result, id } = place(w, 'carpenter', origin, 3);
    expect(result.ok).toBe(true);
    for (const t of trees) {
      expect(w.map.designationAt(t)).toBe(Designation.Chop);
      expect(w.map.designationPriorityAt(t)).toBe(3);
    }
    expect(w.map.designationAt(beside)).toBe(Designation.None);
    // The build is not offered while a tree stands.
    w.step(5);
    expect(jobs(w).byKey(`build:${id}`)).toBeUndefined();
    w.spawnItem('log', 'oak', w.index(45, 45, Z), 2);
    w.spawnItem('axe', 'iron', w.index(43, 39, Z));
    w.spawnDwarf({ at: w.index(43, 39, Z), skills: { woodcutting: 10 } });
    w.spawnDwarf({ at: w.index(39, 44, Z), skills: { carpentry: 10, building: 10 } });
    w.until(() => w.map.kindAt(trees[0] as TileIndex) === TileKind.Floor || w.map.kindAt(trees[1] as TileIndex) === TileKind.Floor, 4000);
    expect(trees.some((t) => w.map.kindAt(t) === TileKind.Tree)).toBe(true);
    expect(jobs(w).byKey(`build:${id}`)).toBeUndefined();
    w.until(() => trees.every((t) => w.map.kindAt(t) === TileKind.Floor), 4000);
    w.until(() => bld(w).get(id)?.state === 'built', 6000);
    expect(w.events('TreeFelled')).toHaveLength(2);
    // The tree beside the site is untouched.
    expect(w.map.kindAt(beside)).toBe(TileKind.Tree);
    expect(w.map.designationAt(beside)).toBe(Designation.None);
  });

  it('cancelling before the trees fall takes back the marks the placement made, not one the player made first', () => {
    const { w, origin, trees } = site('t756-cancel');
    const [mine, placed] = trees as [TileIndex, TileIndex];
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'chop', tiles: [mine], priority: 7 }).ok).toBe(true);
    const { result, id } = place(w, 'carpenter', origin, 3);
    expect(result.ok).toBe(true);
    expect(w.map.designationPriorityAt(mine)).toBe(7);
    expect(w.map.designationAt(placed)).toBe(Designation.Chop);
    w.step(2);
    expect(w.game.world.applyCommand({ type: 'CancelBuilding', buildingId: id }).ok).toBe(true);
    expect(w.map.designationAt(placed)).toBe(Designation.None);
    expect(w.map.designationAt(mine)).toBe(Designation.Chop);
    expect(w.map.kindAt(placed)).toBe(TileKind.Tree);
  });

  it('a wall over a tree, and a workshop over a wall, are still refused', () => {
    const w = world('t756-refused');
    const tree = w.index(40, 40, Z);
    plant(w, tree, TileKind.Tree, 'oak');
    expect(place(w, 'wall', tree).result).toEqual({ ok: false, reason: 'bad_placement' });
    expect(bld(w).ghost('wall', tree, 0)).toMatchObject({ rule: 'chop_first', fells: [] });
    expect(w.map.designationAt(tree)).toBe(Designation.None);
    const rock = w.index(50, 40, Z);
    w.game.world.services.terrain.setKind(rock, TileKind.Wall, materialOf(w, 'granite'));
    w.game.world.services.terrain.setKind(w.index(51, 41, Z), TileKind.Tree, materialOf(w, 'oak'));
    expect(place(w, 'carpenter', rock).result).toEqual({ ok: false, reason: 'bad_placement' });
    expect(bld(w).ghost('carpenter', rock, 0)).toMatchObject({ reason: 'bad_placement', bad: [rock], rule: 'floor' });
    expect(w.map.designationAt(w.index(51, 41, Z))).toBe(Designation.None);
  });

  it("the planned building's panel says it waits for its trees to be felled", () => {
    const { w, origin, trees } = site('t756-panel');
    const { id } = place(w, 'carpenter', origin);
    w.step(2);
    const screen = screenOver(w);
    screen.building.open(id);
    expect(screen.building.waiting(screen.ctx)).toBe('Waiting for 2 trees on its site to be felled');
    w.game.world.services.terrain.setKind(trees[0] as TileIndex, TileKind.Floor, materialOf(w, 'oak'));
    expect(screen.building.waiting(screen.ctx)).toBe('Waiting for a tree on its site to be felled');
  });
});
