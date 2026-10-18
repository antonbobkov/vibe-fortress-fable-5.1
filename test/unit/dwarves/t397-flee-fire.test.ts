/**
 * T-397: a dwarf on a tile that burns, or on burnable ground beside one, leaves for the nearest
 * ground that cannot burn (10 § Behavior selection step 1); it does not stand in the fire.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { CombatReader } from '@systems/combat';
import type { EntityId } from '@core/types';
import { FIELD_X, FIELD_Y, Z, burnedTiles, setupField } from '../../scenarios/fire-field';
import { TestWorld } from '../../scenarios/test-world';

function field(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  setupField(w); // a 10x10 grass field in a ring of granite floor; the tile at (+4,+4) is set alight
  return w;
}

function burns(w: TestWorld, id: EntityId): number {
  return w.events('BurnDamage').filter((e) => e['id'] === id).length;
}

describe('T-397 a dwarf flees a burning tile', () => {
  it('an idle dwarf beside the first burning tile leaves the grass and takes no burn', () => {
    const w = field('t397-idle');
    const id = w.spawnDwarf({ at: w.index(FIELD_X + 3, FIELD_Y + 4, Z) });
    w.step(600);
    expect(burns(w, id)).toBe(0);
    const at = w.game.movement.tileOf(id);
    expect(w.materials.fire.burnableTile(at), 'it stands on ground that cannot burn').toBe(false);
    expect(w.game.world.entities.alive(id)).toBe(true);
  });

  it('a sleeping dwarf wakes and leaves', () => {
    const w = field('t397-sleep');
    const start = w.index(FIELD_X + 7, FIELD_Y + 4, Z);
    const id = w.spawnDwarf({ at: start });
    w.setNeed(id, 'rest', 95);
    w.step(5);
    expect(w.game.world.entities.get(id, C.Brain)?.activity).toBe('sleep');
    w.step(900);
    expect(burnedTiles(w).has(start), 'the fire reached the tile it slept on').toBe(true);
    expect(burns(w, id)).toBe(0);
    expect(w.materials.fire.burnableTile(w.game.movement.tileOf(id))).toBe(false);
  });

  it('a dwarf on stone beside burning grass stays where it is', () => {
    const w = field('t397-stone');
    const stone = w.index(FIELD_X - 1, FIELD_Y + 4, Z);
    const id = w.spawnDwarf({ at: stone });
    w.step(600);
    expect(burns(w, id)).toBe(0);
    expect(w.game.movement.tileOf(id)).toBe(stone);
  });

  it('with no ground that cannot burn in reach, a dwarf walks to ground out of danger', () => {
    // A grass plain of 80 by 80 tiles: more than FIRE_FLEE_NODE_LIMIT tiles of grass in every direction.
    const w = new TestWorld({ seed: 't397-plain', world: 'flat-test', embark: 'none' });
    for (let y = 5; y < 85; y += 1) for (let x = 5; x < 85; x += 1) w.map.setFlag(w.index(x, y, Z), TileFlag.Grass, true);
    const start = w.index(45, 40, Z);
    const id = w.spawnDwarf({ at: start });
    w.materials.fire.pendingIgnite.add(w.index(46, 40, Z));
    w.step(600);
    expect(burnedTiles(w).size, 'the fire spread over the plain').toBeGreaterThan(3);
    expect(burns(w, id)).toBe(0);
    expect(w.game.world.entities.alive(id)).toBe(true);
  });

  it('a soldier on duty with a hostile in sight is not steered back into the fire by combat', () => {
    const w = field('t397-soldier');
    const station = w.index(FIELD_X + 5, FIELD_Y + 4, Z);
    const id = w.spawnDwarf({ at: station });
    const world = w.game.world;
    expect(world.applyCommand({ type: 'CreateSquad', name: 'Guard', leaderId: id }).ok).toBe(true);
    const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'active' }).ok).toBe(true);
    expect(world.applyCommand({ type: 'SetAlert', level: 'watchful' }).ok).toBe(true);
    // The hostile stands beyond the fire, on the far side of the field from the soldier's way out.
    w.spawnCreature('gloam_warrior', w.index(FIELD_X - 2, FIELD_Y + 4, Z), 'hostile:gloam');
    w.step(600);
    expect(burns(w, id)).toBe(0);
  });
});
