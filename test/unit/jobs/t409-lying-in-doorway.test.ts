/** T-409: a creature lying in a doorway (unconscious, or asleep on the floor) does not hold a job behind the door. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A wall across the map with a door in it, a dwarf on the door's tile, a miner south of it and a dig job north of it. */
function doorway(seed: string, removeBrain: boolean) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const doorTile = w.index(40, 20, Z);
  w.build('door', doorTile, 'oak');
  w.step(1);
  const lying = w.spawnDwarf({ at: doorTile });
  if (removeBrain) w.game.world.entities.remove(lying, C.Brain);
  const target = w.index(44, 15, Z);
  w.carve(target, TileKind.Wall);
  const at = w.index(40, 24, Z);
  const miner = w.spawnDwarf({ at, skills: { mining: 10 } });
  const pick = w.spawnItem('pick', 'iron', at);
  w.items.attachToCarrier(pick, miner);
  w.game.world.entities.add(miner, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
  const equipment = w.game.world.entities.get(miner, C.Equipment)!;
  w.game.world.entities.add(miner, C.Equipment, { ...equipment, weapon: pick });
  return { w, doorTile, lying, miner, target };
}

/** Knock a dwarf out where it lies; 17 is not told, so it stays out for the test. */
function knockOut(w: TestWorld, id: number): void {
  const body = w.game.world.entities.get(id, C.Body)!;
  body.blood = Math.floor(body.maxBlood * 0.3);
  body.conscious = false;
}

describe('T-409 a creature lying in a doorway', () => {
  it('lets the walk of a job behind the door pass an unconscious dwarf with no bed, and the job is worked within a day', () => {
    const { w, doorTile, lying, target } = doorway('t409-unconscious', false);
    knockOut(w, lying);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
    // `until` throws when the job is not worked within the day.
    w.until((v) => v.map.kindAt(target) === TileKind.Floor, TICKS_PER_DAY);
    // Nobody moved the patient: the miner passed it where it lies.
    expect(w.game.movement.tileOf(lying)).toBe(doorTile);
    expect(w.game.world.entities.get(lying, C.Body)?.conscious).toBe(false);
  });
});
