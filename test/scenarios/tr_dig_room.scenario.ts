/**
 * `tr_dig_room` of `04-implementation/acceptance-tests.md` § 03 Terrain: "designate a 3×3 dig into
 * the rock face; 1 miner | all 9 tiles `Floor` within 2,500 ticks; stone items dropped ≈ 30% (over
 * 100 runs, 20–40%)".
 *
 * `flat-test` is soil down to z = 30 and granite below, so the rock face is reached through a stair
 * shaft laid at setup; the room is the granite at z = 29 beside the shaft's foot. One dwarf keeps
 * `mining`. The scenario's own run is on the standard `flat-test` map; the 100 runs of the drop
 * rate use the same columns on a compact 32 × 32 map (every run is a fresh world, and the full
 * map's connectivity build dominates the cost; D-059). Stone items are recorded as intended drops
 * until the item system exists (M2).
 *
 * Resolved C-004 (2026-10-02): 2,500-tick limit per owner decision.
 */

import { expect } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { TileKind } from '@core/map3d';
import type { TerrainReader } from '@systems/terrain';
import type { Scenario } from './runner';
import { onlyMiner, rect, stairShaft } from './m1-helpers';
import { TestWorld } from './test-world';

const RUNS = 100;
const SCENARIO_LIMIT = 2_500;
const RUN_LIMIT = 2_500;
const ROCK_Z = 29;

function setupRoom(w: TestWorld, sx: number, sy: number): number[] {
  stairShaft(w, sx, sy, 32, ROCK_Z);
  onlyMiner(w);
  const room = rect(w, sx + 1, sy - 1, ROCK_Z, 3, 3);
  const r = w.game.world.applyCommand({ type: 'Designate', tiles: room, kind: 'dig', priority: 5 });
  if (!r.ok) throw new Error(`designate: ${r.reason}`);
  return room;
}

function digAll(w: TestWorld, room: readonly number[], limit: number): { ticks: number; stones: number } {
  const ticks = w.until((world) => room.every((t) => world.map.kindAt(t) === TileKind.Floor), limit);
  const drops = w.readers.of<TerrainReader>('03').intendedDrops().filter((d) => d.reason === 'dig');
  expect(drops.every((d) => d.type === 'raw_stone')).toBe(true);
  return { ticks, stones: drops.length };
}

let room: number[] = [];

const scenario: Scenario = {
  id: 'tr_dig_room',
  milestone: 1,
  seed: 'tr-dig-room',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    room = setupRoom(w, 48, 12);
  },
  run: (w) => {
    const first = digAll(w, room, SCENARIO_LIMIT);
    expect(first.ticks).toBeLessThanOrEqual(SCENARIO_LIMIT);
    // The room is open ground now: nine floors of granite.
    for (const t of room) expect(w.map.kindAt(t)).toBe(TileKind.Floor);
    let stones = 0;
    for (let k = 0; k < RUNS; k += 1) {
      const run = new TestWorld({ seed: `tr-dig-room-${k}`, map: buildFlatTestMap(w.game.registry, 32, 32), embark: 'default' });
      const r = digAll(run, setupRoom(run, 16, 12), RUN_LIMIT);
      expect(r.ticks).toBeLessThanOrEqual(RUN_LIMIT);
      stones += r.stones;
    }
    const rate = stones / (RUNS * 9);
    expect(rate).toBeGreaterThanOrEqual(0.2);
    expect(rate).toBeLessThanOrEqual(0.4);
  },
};

export default scenario;
