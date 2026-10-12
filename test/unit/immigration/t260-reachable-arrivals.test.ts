/** T-260: the wave enters a component from which it can join the fortress. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { ImmigrationSystem } from '@systems/immigration';
import { TestWorld } from '../../scenarios/test-world';

function world(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 28 * TICKS_PER_DAY - 2 });
  // An interior resident anchor isolates entry rules without obstructing an edge wagon.
  const anchor = w.index(12, 12, Z);
  for (let n = 0; n < 7; n += 1) w.spawnDwarf({ at: anchor });
  const tile = (x: number, y: number) => w.index(x, y, Z);
  const block = (x: number, y: number) => w.carve(tile(x, y), TileKind.Wall);
  const im = w.game.world.scheduler.byId('21') as ImmigrationSystem;
  return { w, anchor, tile, block, im };
}
function joined(a: ReturnType<typeof world>, id: number) {
  const at = a.w.game.movement.tileOf(id);
  expect(a.w.readers.pathing.reachable(at, a.anchor, 'walker')).toBe(true);
}

describe('T-260 reachable immigrant entry', () => {
  it('skips an isolated but otherwise valid first edge floor', () => {
    const a = world('t260-isolated');
    a.block(1, 0); a.block(0, 1);
    a.w.until(w => w.events('ImmigrantsArrived').length > 0, 200);
    const ids = a.w.events('ImmigrantsArrived')[0]!['ids'] as number[];
    for (const id of ids) joined(a, id);
  });

  it('checks unsampled edge floors when every spread candidate is disconnected', () => {
    const a = world('t260-dense');
    for (let x = 1; x < a.w.map.w; x += 1) if (x !== 2) a.block(x, 0);
    a.block(0, 1);
    a.w.until(w => w.events('ImmigrantsArrived').length > 0, 200);
    for (const id of a.w.events('ImmigrantsArrived')[0]!['ids'] as number[]) joined(a, id);
  });

  it('keeps a blocked wave queued across save/load, then admits it after a path opens', () => {
    const a = world('t260-queued');
    for (let x = 1; x < a.w.map.w; x += 1) a.block(x, 0);
    a.block(0, 1);
    a.w.step(100);
    expect(a.w.events('ImmigrantsArrived')).toHaveLength(0);
    expect(a.im.serialize().pending?.nextIndex).toBe(0);
    expect(a.w.game.world.entities.with(C.Labors)).toHaveLength(7);
    const loaded = roundTrip(a.w.game).game;
    expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < 50; tick += 1) {
      a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash());
    }
    const gate = a.tile(4, 0);
    for (const game of [a.w.game, loaded]) game.world.services.terrain.setKind(gate, TileKind.Floor, game.map.materialAt(gate));
    for (let tick = 0; tick < 150; tick += 1) {
      a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash());
    }
    const ids = a.w.events('ImmigrantsArrived')[0]!['ids'] as number[];
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const id of ids) joined(a, id);
  });

  it('does not replace a blocked saved wave at the next season evaluation', () => {
    const a = world('t260-next-season');
    for (let x = 1; x < a.w.map.w; x += 1) a.block(x, 0);
    a.block(0, 1);
    a.w.step(100);
    const before = a.im.serialize();
    expect(before.pending?.nextIndex).toBe(0);
    a.w.game.world.emit({ type: 'SeasonChanged', season: 2, year: 1 });
    a.w.step(1);
    const after = a.im.serialize();
    expect(after.pending?.planned).toEqual(before.pending?.planned);
    expect(after.wavesSoFar).toBe(before.wavesSoFar);
    expect(after.rng).toEqual(before.rng);
  });

  it('rechecks the saved entry between members of a staggered wave', () => {
    const a = world('t260-recheck');
    a.w.until(() => a.im.serialize().pending?.nextIndex === 1, 10);
    const wave = a.im.serialize().pending!;
    const entry = wave.planned[1]!.tile;
    const x = a.w.map.xOf(entry);
    expect(a.w.map.yOf(entry)).toBe(0);
    a.block(x - 1, 0); a.block(x + 1, 0); a.block(x, 1);
    a.w.until(w => w.events('ImmigrantsArrived').length > 0, 200);
    const ids = a.w.events('ImmigrantsArrived')[0]!['ids'] as number[];
    joined(a, ids[1]!);
  });
});
