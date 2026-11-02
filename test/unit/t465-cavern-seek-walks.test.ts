/**
 * T-465: 18 says an aggressive monster follows a breach corridor into the fortress. It chose a target
 * anywhere on its label, 16 dropped it on the next tick as out of perception, and it stood still in `seek`.
 */
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import { CAVERN_1_Z_MAX } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();

function world(seed: string): TestWorld {
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 96, 96), embark: 'none', surfaceWildlife: 'none', spec: { ...FLAT_TEST_SPEC, traits: [] } });
}

/** A cavern floor at z, and a stair from it up to a hall at `hallZ`, 40 tiles from the monster. */
function breached(w: TestWorld, z: number, hallZ: number): { monster: EntityId; dwarf: EntityId } {
  w.digRoom(10, 40, z, 50, 3);
  for (let at = z + 1; at < hallZ; at += 1) w.carve(w.index(58, 41, at), TileKind.StairsUpDown);
  w.carve(w.index(58, 41, z), TileKind.StairsUp);
  w.carve(w.index(58, 41, hallZ), TileKind.StairsDown);
  w.digRoom(55, 39, hallZ, 3, 5);
  const dwarf = w.spawnDwarf({ at: w.index(55, 41, hallZ) });
  const monster = w.spawnCreature('cave_crawler', w.index(12, 41, z), 'hostile:cavern');
  w.game.world.entities.add(monster, C.Hostile, { partyId: 0, role: 'cavern_monster', behaviorState: 'wander', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0 });
  (w.game.world.scheduler.byId('18') as unknown as { monsterInfo: Map<EntityId, unknown> }).monsterInfo
    .set(monster, { tier: 1, species: 'cave_crawler', lairTile: w.index(12, 41, z), noTargetTicks: 0 });
  w.step(2);
  return { monster, dwarf };
}

describe('T-465 a seeking cavern monster walks to the fortress', () => {
  it('walks up a breach from far away and reaches the dwarf', () => {
    const w = world('t465-walk');
    const z = CAVERN_1_Z_MAX;
    const hallZ = Math.min(FLAT_TEST_SURFACE_Z - 2, z + 4);
    const { monster, dwarf } = breached(w, z, hallZ);
    const start = w.game.world.entities.get(monster, C.Position)!;
    const x0 = start.x;
    w.step(200);
    expect(w.game.world.entities.get(monster, C.Position)!.x, 'it has moved toward the stair').toBeGreaterThan(x0 + 5);
    w.until((tw) => tw.game.world.services.combat?.targetOf(monster) === dwarf && tw.game.world.entities.get(monster, C.Position)!.z === hallZ, 4000);
    expect(w.game.world.entities.get(monster, C.Position)!.z, 'it came up to the hall').toBe(hallZ);
  });
});
