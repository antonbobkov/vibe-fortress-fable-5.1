/**
 * Shared driving for the player-path scenarios (`docs/process/testing-strategy.md` § Player-path
 * scenarios, `docs/process/player-paths.md`; T-330).
 *
 * A player-path world is a compact generated region (03's whole local generation on a 48 × 48
 * map, as the three-year fortress uses) with a real embark. After the embark the scenario changes
 * the world only through commands: every helper here submits a command and fails loudly when the
 * game refuses it, as a player would see the refusal.
 */

import { expect } from 'vitest';
import { HeadlessGame, regionSpec, type HeadlessEmbark } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { LOCAL_MAP_Z, TICKS_PER_DAY } from '@core/constants';
import { Map3D, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { generateLocal } from '@systems/terrain/generate';
import type { RegionRecord } from '@systems/worldgen';
import { checkInvariants } from './invariants';
import { TestWorld } from './test-world';

/** The compact map side: the size of the three-year fortress, about a fifth of the standard map. */
export const PATH_MAP_SIZE = 48;

/**
 * The region every player path plays in unless it says otherwise: temperate forest (trees for
 * logs), a brook (water to drink), wealth 2 and mixed geology (stone and ore), peril 0. It is a
 * Serene Vale, the calm start a player picks on the region screen: its wild animals arrive as in
 * any game, but no wolves, bears or snow leopards (`regions-biomes-and-traits.md`). Wolves from
 * the second week kill dwarves of a seven-dwarf start before any chain but defence is played,
 * and how a fortress survives its predators is the defence chain and the wildlife instrument's
 * question, not food's or trade's.
 */
export const PATH_REGION: Partial<RegionRecord> = {
  peril: 0, wealth: 2, biome: 'temperate_forest', geology: 'mixed', traits: ['serene_vale'],
  river: { class: 'brook', inflow: ['w'], outflow: 's' },
};

/** A compact generated region with the given embark, wild animals on. */
export function pathWorld(seed: string, embark: HeadlessEmbark = 'default', region: Partial<RegionRecord> = {}, startTick?: number): TestWorld {
  const registry = contentRegistry();
  const spec = regionSpec(seed, { ...PATH_REGION, ...region }, registry);
  const map = new Map3D(PATH_MAP_SIZE, PATH_MAP_SIZE, LOCAL_MAP_Z);
  const local = generateLocal(spec, map, registry);
  const w = new TestWorld({ seed, registry, map, spec, systems: HeadlessGame.standardSystems(spec, local.layerStack, local), embark,
    ...(startTick === undefined ? {} : { startTick }) });
  // Events carry no tick: the day of each death is stamped as it arrives, for the trace.
  const days: number[] = [];
  deathDays.set(w, days);
  w.game.world.onEvents((batch) => {
    for (const e of batch) if (e.type === 'CreatureDied' && e['faction'] === 'fortress') days.push(day(w));
  });
  return w;
}

const deathDays = new WeakMap<TestWorld, number[]>();

/** Submit a command now and fail with the game's reason when it is refused. */
export function cmd(w: TestWorld, command: Command): void {
  const result = w.game.world.applyCommand(command);
  if (!result.ok) throw new Error(`${command.type} refused: ${result.reason}`);
}

export function buildings(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

/** The wagon's column: where the embark stood. */
export function wagon(w: TestWorld): { x: number; y: number; z: number } {
  const arrival = w.game.arrival;
  if (arrival === null) throw new Error('player path: no arrival');
  return arrival.wagon;
}

/** The walkable surface level of a column. */
export function surfaceZ(w: TestWorld, x: number, y: number): number {
  return w.map.columnSurfaceZ(x, y);
}

function creatureTiles(w: TestWorld): Set<TileIndex> {
  const tiles = new Set<TileIndex>();
  for (const id of w.game.world.entities.with(C.Creature, C.Position)) {
    const p = w.game.world.entities.get(id, C.Position)!;
    tiles.add(w.index(p.x, p.y, p.z));
  }
  return tiles;
}

/**
 * Place a building on the nearest surface site to (x, y) that the ghost accepts, outside every
 * zone and the tiles in `avoid`, as a player picks a free spot. Returns the building's id.
 */
export function placeNear(w: TestWorld, type: string, x: number, y: number, avoid: Set<TileIndex> = new Set()): EntityId {
  const b = buildings(w);
  const sites: TileIndex[] = [];
  for (let yy = 2; yy < w.map.h - 4; yy += 1) for (let xx = 2; xx < w.map.w - 4; xx += 1) sites.push(w.index(xx, yy, surfaceZ(w, xx, yy)));
  const distance = (t: TileIndex): number => Math.abs(w.map.xOf(t) - x) + Math.abs(w.map.yOf(t) - y);
  sites.sort((a, c) => distance(a) - distance(c) || a - c);
  const occupied = creatureTiles(w);
  for (const origin of sites) {
    const ghost = b.ghost(type, origin, 0);
    if (ghost.reason !== null) continue;
    if (!ghost.tiles.every((t) => b.zoneAt(t) === 0 && !avoid.has(t) && !occupied.has(t))) continue;
    cmd(w, { type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: 0 });
    const id = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
    // The footprint and a ring around it stay clear of the next building, so every workshop
    // keeps a free side to work from.
    for (const t of b.get(id)?.footprint ?? ghost.tiles) {
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const n = w.map.offset(t, dx, dy, 0);
        if (n >= 0) avoid.add(n);
      }
    }
    return id;
  }
  throw new Error(`placeNear: no site for ${type} near (${x}, ${y})`);
}

/** Place a building at one tile, as a player does for furniture in a dug room. */
export function placeAt(w: TestWorld, type: string, at: TileIndex): EntityId {
  cmd(w, { type: 'PlaceBuilding', buildingType: type, origin: at, orientation: 0, materialChoice: 0 });
  return (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
}

/** Zone the qualifying tiles of a rectangle; returns the zone's id. */
export function zoneRect(w: TestWorld, type: string, x0: number, y0: number, z: number, width: number, height: number): EntityId {
  const b = buildings(w);
  const tiles: TileIndex[] = [];
  for (let y = y0; y < y0 + height; y += 1) for (let x = x0; x < x0 + width; x += 1) {
    const t = w.index(x, y, z);
    if (b.zoneAt(t) === 0 && b.zoneTileQualifies(type, t)) tiles.push(t);
  }
  if (tiles.length === 0) throw new Error(`zoneRect ${type}: no qualifying tile at (${x0}, ${y0}, ${z})`);
  cmd(w, { type: 'CreateZone', zoneType: type, tiles });
  return (w.game.world.scheduler.byId('14') as BuildingsSystem).lastCreatedZone;
}

/**
 * Designate a stairwell from the surface down to `bottom(x, y, top)` at (x, y), or at the nearest
 * column the game accepts it on (not a tree, not water), as a player moves the cursor over.
 */
export function stairDown(w: TestWorld, x: number, y: number, bottom: (x: number, y: number, top: number) => number): { sx: number; sy: number; top: number; zBottom: number } {
  for (let r = 0; r < 6; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const sx = x + dx, sy = y + dy;
      const top = surfaceZ(w, sx, sy);
      const zBottom = bottom(sx, sy, top);
      if (w.game.world.applyCommand({ type: 'DesignateStairwell', x: sx, y: sy, zTop: top, zBottom }).ok) return { sx, sy, top, zBottom };
    }
  }
  throw new Error(`stairDown: no stairwell near (${x}, ${y})`);
}

/**
 * A stairwell from the surface down to the first level of stone, as a player reads the layers on
 * the map. `below` is the soil level just under the surface.
 */
export function stairToRock(w: TestWorld, x: number, y: number): { sx: number; sy: number; top: number; below: number; rockZ: number } {
  const materials = w.game.registry.table<{ id: string; class: string }>('materials');
  const { sx, sy, top, zBottom } = stairDown(w, x, y, (sx, sy, top) => {
    let rockZ = top - 1;
    while (rockZ > 1 && materials.byIndex(w.map.materialAt(w.index(sx, sy, rockZ)))?.class === 'soil') rockZ -= 1;
    return rockZ;
  });
  return { sx, sy, top, below: top - 1, rockZ: zBottom };
}

/** The tiles of a rectangle on one level. */
export function rect(w: TestWorld, x0: number, y0: number, z: number, width: number, height: number): TileIndex[] {
  const tiles: TileIndex[] = [];
  for (let y = y0; y < y0 + height; y += 1) for (let x = x0; x < x0 + width; x += 1) tiles.push(w.index(x, y, z));
  return tiles;
}

export function built(w: TestWorld, id: EntityId): boolean {
  return buildings(w).get(id)?.state === 'built';
}

export function dug(w: TestWorld, tiles: readonly TileIndex[]): boolean {
  return tiles.every((t) => w.map.kindAt(t) !== TileKind.Wall);
}

/** The fortress's living dwarves (adults and children). */
export function fortressDwarves(w: TestWorld): EntityId[] {
  const ent = w.game.world.entities;
  return ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress' && ent.alive(id));
}

export function day(w: TestWorld): number {
  return Math.floor(w.tick / TICKS_PER_DAY);
}

/**
 * Step in chunks of `chunk` ticks until `done` holds, calling `each` after every chunk (the
 * player's look at the screen). Returns false when `maxTicks` passed first.
 */
export function playUntil(w: TestWorld, done: () => boolean, maxTicks: number, each: () => void = () => {}, chunk = 20): boolean {
  const end = w.tick + maxTicks;
  while (w.tick < end) {
    if (done()) return true;
    w.step(Math.min(chunk, end - w.tick));
    each();
  }
  return done();
}

/** Counts of job blocks by type and reason, and open jobs by key prefix: the trace a failure prints. */
export function trace(w: TestWorld, label: string): string {
  const count = (type: 'JobBlocked' | 'JobCompleted'): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const e of w.events(type)) {
      const key = type === 'JobBlocked' ? `${String(e['jobType'])}:${String(e['reason'])}` : String(e['jobType']);
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  };
  const open: Record<string, number> = {};
  for (const job of w.readers.of<JobsReader>('11').list()) {
    const key = `${job.key.split(':')[0] ?? '?'}:${job.state}${job.blockedReason === null ? '' : `(${job.blockedReason})`}`;
    open[key] = (open[key] ?? 0) + 1;
  }
  const stamped = deathDays.get(w) ?? [];
  const deaths = w.events('CreatureDied').filter((e) => e['faction'] === 'fortress').map((e, n) => {
    const killer = Number(e['killerId'] ?? 0);
    const species = killer === 0 ? '' : w.game.registry.table<{ id: string }>('creatures').byIndex(w.game.world.entities.get(killer, C.Creature)?.species ?? -1)?.id ?? `#${killer}`;
    const creature = w.game.registry.table<{ id: string }>('creatures').byIndex(Number(e['species']))?.id ?? String(e['species']);
    return `${creature}:${String(e['cause'])}${species === '' ? '' : ` by ${species}`} day ${stamped[n] ?? '?'}`;
  });
  return `${label} day ${day(w)} tick ${w.tick}: dwarves ${fortressDwarves(w).length}; deaths ${JSON.stringify(deaths)}; ` +
    `completed ${JSON.stringify(count('JobCompleted'))}; blocked ${JSON.stringify(count('JobBlocked'))}; jobs ${JSON.stringify(open)}`;
}

/** The invariant checker at the end of a player path. */
export function expectNoInvariantFindings(w: TestWorld, label: string): void {
  const findings = checkInvariants(w.game);
  expect(findings, `${label} invariants: ${JSON.stringify(findings)}`).toEqual([]);
}
