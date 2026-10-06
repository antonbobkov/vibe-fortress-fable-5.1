/**
 * The performance smoke's fortress: `01-architecture/performance-budget.md` § Reference scenario
 * and `M3-water-fire-sky.md` T-M3-09 — "synthetic builder: standard map from `generated` with seed
 * `perf-1`, 40-tile waterfall channel dug through `TestWorld`, 20 dwarves walking random routes".
 *
 * The saved fixture of the reference fortress is made at the M6 gate (`testing-strategy.md`
 * § Performance smoke); until then this builder stands in for it, with the parts M3 has: the
 * generated map, the embarked party grown to 20 dwarves, and a running waterfall.
 */

import { HeadlessGame, generatedSpec } from '@app/headless';
import { RngStream, stateFromSeed, hashString } from '@core/rng';
import type { EntityId, TileIndex } from '@core/types';
import { TestWorld } from '../scenarios/test-world';
import { digWaterfall, type Waterfall } from '../scenarios/waterfall';

export const PERF_SEED = 'perf-1';
/** "a 40-tile waterfall channel" (`performance-budget.md` § Reference scenario). */
export const CHANNEL_TILES = 40;
/** The fall of the channel's shaft, as `fl_waterfall_mist` has it. */
export const CHANNEL_DROP = 3;
/** "20 dwarves walking random routes". */
export const DWARVES = 20;

export interface ReferenceFortress {
  readonly w: TestWorld;
  readonly fall: Waterfall;
  readonly dwarves: EntityId[];
  /** Give every idle dwarf a new random destination; called every tick by the smoke. */
  walkRandomly(): void;
}

/** The map's walkable surface tiles, ascending, from which the routes are drawn. */
function surfaceTiles(w: TestWorld): TileIndex[] {
  const map = w.map;
  const out: TileIndex[] = [];
  for (let y = 2; y < map.h - 2; y += 3) {
    for (let x = 2; x < map.w - 2; x += 3) {
      const z = map.columnSurfaceZ(x, y);
      if (z < 0) continue;
      const i = map.index(x, y, z);
      if (w.readers.map.isWalkable(i, 'walker')) out.push(i);
    }
  }
  return out;
}

export function buildReferenceFortress(options: { readonly now?: () => number } = {}): ReferenceFortress {
  const spec = generatedSpec(PERF_SEED);
  const w = new TestWorld({
    seed: PERF_SEED,
    world: 'local',
    spec,
    embark: 'default',
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const wagon = w.game.arrival?.wagon;
  if (wagon === undefined) throw new Error('perf: no arrival');

  // The waterfall: a channel of 40 tiles under the surface beside the wagon, dropping three
  // levels into a basin wide enough to take 2,000 ticks of flow.
  const y = Math.min(w.map.h - 2, wagon.y + 6);
  const x0 = Math.max(1, Math.min(w.map.w - CHANNEL_TILES - 8, wagon.x - Math.floor(CHANNEL_TILES / 2)));
  let top = w.map.columnSurfaceZ(x0, y);
  for (let k = 0; k <= CHANNEL_TILES; k += 1) top = Math.min(top, w.map.columnSurfaceZ(Math.min(w.map.w - 1, x0 + k), y));
  const channelZ = Math.max(CHANNEL_DROP + 1, top - 2);
  const fall = digWaterfall(w, x0, y, channelZ, CHANNEL_TILES, CHANNEL_DROP);
  const basinZ = channelZ - CHANNEL_DROP;
  w.digRoom(Math.max(1, x0 + CHANNEL_TILES - 10), Math.max(1, y - 10), basinZ, 20, 20);

  // The party, grown to 20 dwarves around the wagon.
  const dwarves: EntityId[] = [...w.readers.of<{ list(): EntityId[] }>('10').list()];
  const map = w.map;
  for (let k = dwarves.length; k < DWARVES; k += 1) {
    const at = map.index(Math.min(map.w - 2, wagon.x + (k % 5) - 2), Math.min(map.h - 2, wagon.y + Math.floor(k / 5) - 2), wagon.z);
    dwarves.push(w.spawnDwarf({ at }));
  }

  const routes = surfaceTiles(w);
  const rng = new RngStream(stateFromSeed(hashString('perf-routes')));
  const world = w.game.world;
  const movement = w.game.movement;
  const walkRandomly = (): void => {
    if (routes.length === 0) return;
    const ctx = { tick: world.calendar.tick, emit: (e: Parameters<typeof world.emit>[0]) => world.emit(e) };
    for (const id of dwarves) {
      if (!world.entities.alive(id)) continue;
      const target = movement.walkTarget(id);
      if (target >= 0 && movement.walkTo(id, target, 'wander', ctx) !== 'arrived') continue;
      movement.walkTo(id, routes[rng.int(0, routes.length - 1)] as TileIndex, 'wander', ctx);
    }
  };
  return { w, fall, dwarves, walkRandomly };
}

/** The per-system averages and the worst tick of a run, in milliseconds. */
export interface PerfRun {
  readonly ticks: number;
  readonly averageTickMs: number;
  readonly worstTickMs: number;
  /** `host.stats()` averages by system id. */
  readonly systems: Record<string, number>;
  /** The core pathing phase (path requests and the connectivity relabel), averaged per tick. */
  readonly pathingMs: number;
  readonly relabelTicks: number;
}

/** Run the fortress for `ticks` ticks, timing every tick and the core pathing phase. */
export function runReferenceFortress(fortress: ReferenceFortress, ticks: number, now: () => number): PerfRun {
  const game: HeadlessGame = fortress.w.game;
  const pass = game.world.connectivityPass;
  let pathing = 0;
  let relabelTicks = 0;
  game.world.connectivityPass = (): void => {
    const started = now();
    pass?.();
    pathing += now() - started;
    if (game.pathing.connectivity.lastRebuilt().length > 0) relabelTicks += 1;
  };
  game.world.scheduler.resetStats();
  let worst = 0;
  const t0 = now();
  for (let k = 0; k < ticks; k += 1) {
    fortress.walkRandomly();
    const started = now();
    game.step(1);
    worst = Math.max(worst, now() - started);
  }
  const total = now() - t0;
  game.world.connectivityPass = pass;
  const systems: Record<string, number> = {};
  for (const s of game.world.stats().systems) systems[s.id] = s.totalMs / ticks;
  return { ticks, averageTickMs: total / ticks, worstTickMs: worst, systems, pathingMs: pathing / ticks, relabelTicks };
}
