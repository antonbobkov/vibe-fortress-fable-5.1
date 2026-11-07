/**
 * T-502: a soldier on `hold` that holds a target it cannot strike from where it stands, more than a
 * tile from its post, walks back to its post and keeps the target (16 § Squads). Before, the squad
 * step left a soldier with a target alone and `hold` never approached, so it stood where it was.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** A raider shut in a cell of fortifications: seen through them, never reached. */
function caged(w: TestWorld, x: number, y: number): EntityId {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) if (dx !== 0 || dy !== 0) w.carve(w.index(x + dx, y + dy, Z), TileKind.Fortification);
  }
  return w.spawnCreature('gloam_warrior', w.index(x, y, Z), 'hostile:gloam');
}

function holdSquad(w: TestWorld, member: EntityId, station: TileIndex, stance: 'hold' | 'pursue'): SquadWithId {
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const s = w.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members: [member] });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: station });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  w.game.world.entities.add(member, C.Soldier, { ...w.game.world.entities.get(member, C.Soldier)!, stance });
  return s;
}

const tileOf = (w: TestWorld, id: EntityId): { x: number; y: number } => w.game.world.entities.get(id, C.Position)!;

describe('T-502 a hold soldier off its post with a target walks back to the post', () => {
  it('walks back from ten tiles off and keeps the target it cannot reach', () => {
    const w = new TestWorld({ seed: 't502-hold', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const raider = caged(w, 40, 50);
    // The soldier stands four tiles from the cell, its post ten tiles further north; both see the raider.
    const soldier = w.spawnDwarf({ at: w.index(40, 46, Z), skills: { dodge: 2 } });
    holdSquad(w, soldier, w.index(40, 38, Z), 'hold');
    w.step(2);
    const combat = w.readers.of<CombatReader>('16');
    expect(combat.targetOf(soldier), 'it takes the raider as its target where it stands').toBe(raider);
    w.step(300);
    const at = tileOf(w, soldier);
    expect([at.x, at.y], 'it stands at its post').toEqual([40, 38]);
    expect(combat.targetOf(soldier), 'and keeps its target').toBe(raider);
    expect(w.game.world.entities.get(soldier, C.Brain)!.behavior).toBe('duty');
  });

  it('a hold soldier at its post with a target out of reach stays there and keeps it', () => {
    const hold = new TestWorld({ seed: 't502-stay', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const raider = caged(hold, 40, 50);
    const keeper = hold.spawnDwarf({ at: hold.index(40, 44, Z) });
    holdSquad(hold, keeper, hold.index(40, 44, Z), 'hold');
    hold.step(200);
    expect([tileOf(hold, keeper).x, tileOf(hold, keeper).y]).toEqual([40, 44]);
    expect(hold.readers.of<CombatReader>('16').targetOf(keeper)).toBe(raider);
  });
});
