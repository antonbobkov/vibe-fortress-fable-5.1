import { describe, expect, it } from 'vitest';
import { Designation, TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { TestWorld } from '../scenarios/test-world';
import {
  BARRACKS_H, BARRACKS_W, QUARTERS_H, QUARTERS_W, dormitorySite, hallBlockSite, keepQuarters, setupThreeYearsFortress, threeYearsWorld,
  type FortressState, type StrongSquad,
} from '../scenarios/three_years_fortress';

/**
 * T-619: the three-year script's soldiers slept in bedrooms 20 to 70 steps from their barracks and
 * walked there and back for every sleep, so the slow ones stood at drill a few percent of the day. As
 * a player does, the script now digs the squad's quarters beside the barracks, a single-bed room on
 * each tile given to a soldier or marksdwarf, entered from the barracks itself.
 */

/** The hall level as the script plans it, dug at once, and a barracks zoned on its own block. */
function fortressWithBarracks(): { w: TestWorld; state: FortressState; strong: StrongSquad } {
  const w = threeYearsWorld('three-years-p0-1', 0);
  const state = setupThreeYearsFortress(w);
  const map = w.map, z = state.hallZ;
  for (const bp of state.bedroomPlans) {
    bp.designated = true;
    for (const t of [...bp.tiles, w.index(bp.doorX, bp.doorY, z)]) map.setDesignation(t, Designation.Dig, 4);
  }
  const dig = (tiles: readonly number[]): void => {
    for (const t of tiles) { w.carve(t, TileKind.Floor); w.discover(t); map.setDesignation(t, Designation.None, 0); }
    w.step(1);
  };
  const designated: number[] = [];
  for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) {
    const t = w.index(x, y, z);
    if (map.designationAt(t) === Designation.Dig) designated.push(t);
  }
  dig(designated);
  const tiles = hallBlockSite(w, state, BARRACKS_W, BARRACKS_H)!;
  dig(tiles);
  expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'barracks', tiles }).ok).toBe(true);
  const zoneId = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastCreatedZone;
  const strong: StrongSquad = { marksSquadId: 0, trained: [], day: -1, barracks: { tiles, zoneId, targetId: 0 } };
  (state as { strong?: StrongSquad }).strong = strong;
  return { w, state, strong };
}

const middle = (w: TestWorld, tiles: readonly number[]): { x: number; y: number } => ({
  x: tiles.reduce((s, t) => s + w.map.xOf(t), 0) / tiles.length, y: tiles.reduce((s, t) => s + w.map.yOf(t), 0) / tiles.length,
});
const apart = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

describe('T-619 the squad\'s quarters beside the barracks', () => {
  it('three-years-p0-1: digs the quarters beside the barracks, entered from it', () => {
    const { w, state, strong } = fortressWithBarracks();
    const barracks = strong.barracks!.tiles;
    keepQuarters(w, state, strong);
    const quarters = strong.quarters!.tiles;
    expect(quarters.length).toBe(QUARTERS_W * QUARTERS_H);
    for (const t of quarters) {
      expect(w.map.kindAt(t), 'rock').toBe(TileKind.Wall);
      expect(w.map.designationAt(t), 'dug').toBe(Designation.Dig);
    }
    const inBarracks = new Set(barracks);
    const touching = quarters.filter((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inBarracks.has(w.map.offset(t, dx!, dy!, 0))));
    expect(touching.length, 'a side of the quarters lies along the barracks').toBeGreaterThan(0);
    expect(apart(middle(w, quarters), middle(w, barracks))).toBeLessThanOrEqual((BARRACKS_W + QUARTERS_W) / 2 + (BARRACKS_H + QUARTERS_H) / 2);
    // A dormitory is no longer planned on them.
    for (const t of dormitorySite(w, state) ?? []) expect(quarters.includes(t)).toBe(false);
  }, 120_000);

  it('furnishes a bedroom on each tile, gives each soldier one, and the room it owned goes back', () => {
    const { w, state, strong } = fortressWithBarracks();
    const buildings = w.readers.of<BuildingsReader>('14');
    keepQuarters(w, state, strong);
    const quarters = strong.quarters!.tiles;
    for (const t of quarters) { w.carve(t, TileKind.Floor); w.discover(t); w.map.setDesignation(t, Designation.None, 0); }
    w.step(1);
    // Dug: a bed and a bedroom on every tile. The beds but the first built here at once; the first is placed for the carpenter's bed.
    for (const t of quarters.slice(1)) w.build('bed', t);
    keepQuarters(w, state, strong);
    expect(buildings.get(buildings.at(quarters[0]!))?.typeId, 'a bed placed').toBe('bed');
    for (const t of quarters) {
      expect(buildings.zone(buildings.zoneAt(t))?.type, 'a bedroom of its own').toBe('bedroom');
      expect(buildings.zone(buildings.zoneAt(t))?.tiles.length).toBe(1);
    }
    const soldiers = Array.from({ length: 3 }, (_, i) => w.spawnDwarf({ at: strong.barracks!.tiles[i]! }));
    const plan = state.bedroomPlans.find((bp) => bp.tiles.length > 0)!;
    const bedTile = w.index(plan.bedX, plan.bedY, state.hallZ);
    w.build('bed', bedTile);
    expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'bedroom', tiles: plan.tiles }).ok).toBe(true);
    const oldRoom = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastCreatedZone;
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AssignRoom', zoneId: oldRoom, dwarfId: soldiers[0]! }).ok).toBe(true);
    strong.trained = soldiers;
    keepQuarters(w, state, strong);
    const rooms = quarters.map((t) => buildings.zoneAt(t));
    for (const id of soldiers) expect(rooms.includes(buildings.bedroomOf(id)), `soldier ${id} sleeps in the quarters`).toBe(true);
    expect(new Set(soldiers.map((id) => buildings.bedroomOf(id))).size, 'one room each').toBe(soldiers.length);
    expect(buildings.ownerOf(oldRoom), 'its bedroom of the halls is free for another').toBe(0);
    // A soldier who leaves the squads keeps the room until another needs it.
    const recruit = w.spawnDwarf({ at: strong.barracks!.tiles[5]! });
    strong.trained = [soldiers[1]!, soldiers[2]!, recruit];
    keepQuarters(w, state, strong);
    expect(rooms.includes(buildings.bedroomOf(recruit))).toBe(true);
  }, 120_000);
});
