/**
 * T-403: a dwarf that fled a fire is offered no job worked near a fire, and starts no want near one,
 * for FIRE_AVOID_TICKS (10 § Behavior selection step 1, 11 § Assignment), so it does not walk back to
 * the fire's edge and flee again.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import { FIRE_AVOID_RADIUS, FIRE_AVOID_TICKS } from '@systems/dwarves/constants';
import { FIELD_X, FIELD_Y, Z, setupField } from '../../scenarios/fire-field';
import { TestWorld } from '../../scenarios/test-world';

/** A miner with a pick, a wall to dig two tiles from a tile that is made to burn, and the dwarf's own flight from fire at tick 0. */
function edge(seed: string, fled: boolean) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const wall = w.index(30, 30, Z);
  w.carve(wall, TileKind.Wall);
  const at = w.index(26, 30, Z);
  const dwarf = w.spawnDwarf({ at, skills: { mining: 10 } });
  const pick = w.spawnItem('pick', 'iron', at);
  w.items.attachToCarrier(pick, dwarf);
  w.game.world.entities.add(dwarf, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
  const equipment = w.game.world.entities.get(dwarf, C.Equipment)!;
  w.game.world.entities.add(dwarf, C.Equipment, { ...equipment, weapon: pick });
  const burning = w.index(30 + FIRE_AVOID_RADIUS, 30, Z);
  w.map.setFlag(burning, TileFlag.Burning, true);
  if (fled) w.game.world.entities.add(dwarf, C.Brain, { ...w.game.world.entities.get(dwarf, C.Brain)!, fireFlight: w.tick });
  expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [wall] }).ok).toBe(true);
  return { w, dwarf, wall, burning };
}

describe('T-403 a dwarf that fled a fire stays away from its edge', () => {
  it('takes no job worked within FIRE_AVOID_RADIUS of a burning tile for FIRE_AVOID_TICKS, then takes it', () => {
    const { w, dwarf, wall } = edge('t403-avoid', true);
    w.step(FIRE_AVOID_TICKS - 20);
    expect(w.game.world.entities.get(dwarf, C.Worker)?.jobId).toBe(0);
    expect(w.events('JobClaimed')).toHaveLength(0);
    // The avoidance survives a save.
    w.replaceGame(roundTrip(w.game).game);
    w.step(FIRE_AVOID_TICKS);
    expect(w.events('JobClaimed').length).toBeGreaterThan(0);
    w.until(() => w.map.kindAt(wall) === TileKind.Floor, 1500);
  });

  it('takes the job at once when the tile no longer burns, and a dwarf that did not flee takes it from the start', () => {
    const a = edge('t403-out', true);
    a.w.step(40);
    expect(a.w.events('JobClaimed')).toHaveLength(0);
    a.w.map.setFlag(a.burning, TileFlag.Burning, false);
    a.w.until((v) => v.events('JobClaimed').length > 0, 400);
    const b = edge('t403-never-fled', false);
    b.w.until((v) => v.events('JobClaimed').length > 0, 400);
  });

  it('a job farther than FIRE_AVOID_RADIUS from the burning tile is not avoided', () => {
    const { w, burning } = edge('t403-far', true);
    w.map.setFlag(burning, TileFlag.Burning, false);
    w.map.setFlag(w.index(30 + FIRE_AVOID_RADIUS + 1, 30, Z), TileFlag.Burning, true);
    w.until((v) => v.events('JobClaimed').length > 0, 400);
  });

  it('a dwarf that runs from a fire remembers it, one that never stood near one does not', () => {
    const w = new TestWorld({ seed: 't403-flight', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    setupField(w);
    const near = w.spawnDwarf({ at: w.index(FIELD_X + 3, FIELD_Y + 4, Z) });
    const far = w.spawnDwarf({ at: w.index(FIELD_X - 1, FIELD_Y + 4, Z) });
    w.step(600);
    expect(w.game.world.entities.get(near, C.Brain)?.fireFlight).toBeGreaterThan(0);
    expect(w.game.world.entities.get(far, C.Brain)?.fireFlight).toBeUndefined();
  });
});
