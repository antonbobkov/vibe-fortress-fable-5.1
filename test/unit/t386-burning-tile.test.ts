/** T-386: fire that spreads under a creature that does not move is not a creature on an impassable tile. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { TileFlag } from '@core/map3d';
import { TestWorld } from '../scenarios/test-world';
import { checkInvariants } from '../scenarios/invariants';

const names = (w: TestWorld): string[] => checkInvariants(w.game).map((f) => f.inv);

describe('T-386 a creature on a tile that burns', () => {
  it('is not reported while the tile burns, and a tile that is impassable for another reason still is', () => {
    const w = new TestWorld({ seed: 't386-burning-tile', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const burning = w.index(10, 10, Z);
    const deep = w.index(14, 10, Z);
    const boar = w.spawnCreature('boar', burning, 'wild');
    const deer = w.spawnCreature('deer', w.index(12, 10, Z), 'wild');
    expect(names(w)).not.toContain('creature.on-impassable');
    // The fire spreads to the tile of a boar that does not move: the walker graph calls the tile impassable.
    w.map.setFlag(burning, TileFlag.Burning, true);
    expect(w.game.pathing.graph.passable(burning, 'walker')).toBe(false);
    expect(w.game.world.entities.alive(boar)).toBe(true);
    expect(names(w)).not.toContain('creature.on-impassable');
    // A tile that is impassable to a walker for another reason is a finding.
    w.game.movement.teleport(deer, deep);
    w.setFluid(deep, 7);
    w.step(1);
    w.game.movement.teleport(deer, deep);
    expect(w.game.pathing.graph.passable(deep, 'walker')).toBe(false);
    expect(names(w)).toContain('creature.on-impassable');
  });
});
