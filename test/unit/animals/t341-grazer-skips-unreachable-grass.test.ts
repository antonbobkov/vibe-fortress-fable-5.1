/** T-341: a grazer does not loop on grass behind a no_pets door, and keeps or drops its walk target by its rules. */
import { describe, expect, it } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z as Z, HeadlessGame, FLAT_TEST_SPEC, FLAT_TEST_LAYERS } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import { roundTrip } from '@app/game-save';
import { GRAZE_SKIP_TICKS } from '@systems/animals/constants';
import type { AnimalsSystem } from '@systems/animals';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();

function field(seed: string): TestWorld {
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none', surfaceWildlife: 'none',
    systems: HeadlessGame.standardSystems(FLAT_TEST_SPEC, FLAT_TEST_LAYERS).filter((system) => system.id !== '21') });
}

function hungry(w: TestWorld, cow: number): void {
  const tame = w.game.world.entities.get(cow, C.Tame)!;
  w.game.world.entities.add(cow, C.Tame, { ...tame, condition: 80 });
}

/** A wall across x = 18 with a no_pets door at (18, 10); the cow stands west of it. */
function doorField(seed: string) {
  const w = field(seed);
  const granite = registry.table('materials').index('granite');
  for (let y = 0; y < w.map.h; y += 1) if (y !== 10) w.game.world.services.terrain.setKind(w.index(18, y, Z), TileKind.Wall, granite);
  const door = w.build('door', w.index(18, 10, Z), 'oak');
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'no_pets' }).ok).toBe(true);
  // Grass behind the door is the nearest; the only other grass is farther away, on the cow's side.
  const behind = w.index(20, 10, Z), side = w.index(11, 10, Z);
  w.map.setFlag(behind, TileFlag.Grass, true);
  w.map.setFlag(side, TileFlag.Grass, true);
  w.step(2);
  return { w, door, behind, side };
}

describe('T-341 a grazer passes over grass behind a no_pets door', () => {
  it('eats the grass on its own side instead of walking at the door again and again', () => {
    const { w, behind, side } = doorField('t341-no-pets');
    const cow = w.spawnTame('cow', w.index(16, 10, Z), { sex: 1 });
    hungry(w, cow);
    const requests0 = w.pathing.reader().requestsServed();
    w.step(900);
    const grazed = w.events('GrassGrazed').map((e) => e['tile']);
    expect(grazed).toContain(side);
    expect(grazed).not.toContain(behind);
    // One failed walk, then the skip: not a path request on every think.
    expect(w.pathing.reader().requestsServed() - requests0).toBeLessThan(20);
  });

  it('tries the tile again once the skip has run out, and keeps the skip through a save', () => {
    const { w, behind } = doorField('t341-skip-expires');
    const cow = w.spawnTame('cow', w.index(16, 10, Z), { sex: 1 });
    hungry(w, cow);
    const animals = w.game.world.scheduler.byId('08') as AnimalsSystem;
    w.until(() => animals.grazeSkips.get(cow)?.tile === behind, 600);
    const until = animals.grazeSkips.get(cow)!.until;
    expect(until - w.tick).toBeLessThanOrEqual(GRAZE_SKIP_TICKS);
    const loaded = roundTrip(w.game).game;
    expect((loaded.world.scheduler.byId('08') as AnimalsSystem).grazeSkips.get(cow)).toEqual({ tile: behind, until });
    w.replaceGame(loaded);
    // The skip holds through the load: the cow does not walk at the door again before it runs out.
    const requests = w.pathing.reader().requestsServed();
    w.step(Math.min(300, until - w.tick - 1));
    expect(w.pathing.reader().requestsServed() - requests).toBeLessThan(10);
  });
});

describe('T-341 the target a grazer keeps is dropped when it stops qualifying', () => {
  function walkingCow(seed: string) {
    const w = field(seed);
    const far = w.index(20, 10, Z), near = w.index(8, 10, Z);
    w.map.setFlag(far, TileFlag.Grass, true);
    w.step(2);
    const zoneId = w.zone('pasture', [far, near]);
    const cow = w.spawnTame('cow', w.index(10, 10, Z), { sex: 1 });
    expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: cow, zoneId }).ok).toBe(true);
    hungry(w, cow);
    w.until(() => w.game.movement.walkTarget(cow) === far, 30);
    return { w, far, near, cow, zoneId };
  }

  it('when another grazer claims the grass', () => {
    const { w, far, near, cow } = walkingCow('t341-claimed');
    (w.game.world.scheduler.byId('08') as unknown as { claimGraze(tile: number): boolean }).claimGraze(far);
    w.map.setFlag(near, TileFlag.Grass, true);
    w.until(() => w.game.movement.walkTarget(cow) === near, 400);
  });

  it('when its pasture is reassigned to another that does not hold the tile', () => {
    const { w, far, cow } = walkingCow('t341-reassigned');
    const other = w.index(6, 14, Z);
    w.map.setFlag(other, TileFlag.Grass, true);
    const zoneB = w.zone('pasture', [other]);
    expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: cow, zoneId: zoneB }).ok).toBe(true);
    w.until(() => w.events('GrassGrazed').length > 0, 600);
    expect(w.events('GrassGrazed')[0]!['tile']).toBe(other);
    expect(w.map.hasFlag(far, TileFlag.Grass)).toBe(true);
  });

  it('when trees shut the tile in, so that it is another region', () => {
    const { w, near } = walkingCow('t341-region');
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (dx !== 0 || dy !== 0) w.carve(w.index(20 + dx, 10 + dy, Z), TileKind.Tree);
    }
    w.map.setFlag(near, TileFlag.Grass, true);
    w.until(() => w.events('GrassGrazed').length > 0, 600);
    expect(w.events('GrassGrazed')[0]!['tile']).toBe(near);
  });

  it('with no pasture, when it lies beyond the six-tile search', () => {
    const w = field('t341-radius');
    const faraway = w.index(25, 10, Z), close = w.index(14, 10, Z);
    w.map.setFlag(faraway, TileFlag.Grass, true);
    w.map.setFlag(close, TileFlag.Grass, true);
    w.step(2);
    const cow = w.spawnTame('cow', w.index(10, 10, Z), { sex: 1 });
    hungry(w, cow);
    // Something else sent it that way; the far tile is grass, but not within its search.
    w.game.movement.walkTo(cow, faraway, 'wander', { tick: w.tick } as never);
    w.until(() => w.events('GrassGrazed').length > 0, 600);
    expect(w.events('GrassGrazed')[0]!['tile']).toBe(close);
  });
});
