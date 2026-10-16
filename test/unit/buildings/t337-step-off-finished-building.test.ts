/** T-337: a creature on a tile that a finished building makes impassable steps off it. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { BuildingsSystem } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

describe('T-337 nobody is shut inside a finished workshop', () => {
  it('moves a builder standing on a forge corner to the nearest passable tile beside it', () => {
    const w = new TestWorld({ seed: 't337-forge-corner', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const origin = w.index(20, 20, Z);
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'forge', origin, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    const system = world.scheduler.byId('14') as BuildingsSystem;
    const forge = system.lastPlacedBuilding;
    const footprint = world.entities.get(forge, C.Building)!.footprint;
    const corner = footprint[0]!;
    const builder = w.spawnDwarf({ at: corner });
    w.step(1);
    system.completeNow(forge, w.game.registry.table('materials').index('granite'), 0);
    const pos = world.entities.get(builder, C.Position)!;
    const at = w.index(pos.x, pos.y, pos.z);
    expect(footprint.includes(at), `builder still inside the forge at ${pos.x},${pos.y}`).toBe(false);
    expect(Math.max(Math.abs(pos.x - w.map.xOf(corner)), Math.abs(pos.y - w.map.yOf(corner)))).toBe(1);
    w.step(5);
    expect(w.game.world.readers.pathing.passable(w.game.movement.tileOf(builder), 'walker')).toBe(true);
  });
});
