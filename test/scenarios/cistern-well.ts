/**
 * T-663: water inside the gate. A cistern under the hearth hall fed from the brook through a
 * floodgate, with a well over it, laid out on a generated map from the brook's course as a player
 * reads it. Shared by `bd_cistern_well` and the three-year script.
 *
 * Seen from the brook, along one cardinal direction `d`:
 *
 * - `P`, the bank beside a brook tile: its surface is channelled last (the breach), which turns the
 *   bank's wall at the water's level into a ramp the brook flows into.
 * - `S`, the feed shaft beside `P`: channelled from the surface down to the cistern's level `L`,
 *   level by level, so the water falls through open tiles (04: nothing falls out of a stair).
 * - `T`, a stairwell beside `S` from the surface to `L`: the miner channelling `S` steps onto it
 *   rather than falling, and walks back up, and the miners come down it to dig the tunnel. After
 *   the breach it fills with water to the brook's level, too deep to walk.
 * - The feed tunnel at `L`, from under `S` along `d`, then across to the cistern, dug from `T`'s
 *   foot; its last tile, beside the cistern, holds the floodgate `F`, dug and built from the
 *   cistern's side.
 * - The cistern, a room at `L` under the hall; the well's column `W` is channelled from the hall's
 *   floor down to it, and an access stair `A` beside it joins the hall to the cistern while it is
 *   dug.
 *
 * Water lifts by pressure only into open tiles (04 § The four movement rules, rule 3), so a cistern
 * that is not full holds its water at `L`; a full one would lift it up the well's column into the
 * hall. The floodgate shuts the brook out once the cistern has water, and until the brook is let in
 * it shuts the tunnel, open to the surface by `T`, out of the halls.
 */

import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { Command } from '@core/commands';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { TestWorld } from './test-world';

/** Levels between the hall's floor and the cistern: the well's column is open on the two between. */
export const CISTERN_DEPTH = 3;
/** Ticks the shut cistern is left to settle before the floodgate is opened again for a dry well column. */
export const SETTLE_TICKS = 1200;

export interface Col { readonly x: number; readonly y: number }

export interface CisternPlan {
  /** The brook's water level. */
  readonly bz: number;
  /** The hall's level and the cistern's. */
  readonly hallZ: number;
  readonly cisternZ: number;
  /** Columns of the pieces. */
  readonly p: Col; readonly s: Col; readonly t: Col; readonly f: Col; readonly w: Col; readonly a: Col;
  /** The surface levels of the bank, the shaft and the stair, as they were when planned. */
  readonly tops: { readonly p: number; readonly s: number; readonly t: number };
  /** The feed tunnel at `cisternZ`, from `s` (first) to the tile before the cistern. */
  readonly tunnel: readonly Col[];
  /** The cistern's tiles at `cisternZ`: the 3 × 3 around the well's column. */
  readonly cistern: readonly Col[];
}

const DIRS: readonly Col[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

function add(c: Col, d: Col, k = 1): Col {
  return { x: c.x + d.x * k, y: c.y + d.y * k };
}

export function tileOf(w: TestWorld, c: Col, z: number): TileIndex {
  return w.index(c.x, c.y, z);
}

/**
 * The brook's feed for a cistern under the well column `well` at `hallZ`, with the access stair at
 * `well + across`: the brook tile and direction whose bank, shaft and stair columns stand dry and
 * solid and whose tunnel (straight along `d`, then across) runs through rock, the shortest tunnel
 * first. Null when no brook tile serves within `maxTunnel` tiles.
 */
export function planCistern(w: TestWorld, well: Col, hallZ: number, across: Col, maxTunnel: number): CisternPlan | null {
  const map = w.map;
  const cisternZ = hallZ - CISTERN_DEPTH;
  const inMap = (c: Col): boolean => c.x >= 2 && c.y >= 2 && c.x < map.w - 2 && c.y < map.h - 2;
  const water = (c: Col, z: number): boolean => map.fluidLevelAt(w.index(c.x, c.y, z)) > 0;
  const kind = (c: Col, z: number): TileKind => map.kindAt(w.index(c.x, c.y, z));
  // A dry floor on top of the column, above the brook's water, with rock from the water up to it.
  const surfaceOver = (c: Col, bz: number): boolean => {
    const top = map.columnSurfaceZ(c.x, c.y);
    return top > bz && kind(c, top) === TileKind.Floor && !water(c, top) && solid(c, bz, top - 1);
  };
  const solid = (c: Col, z0: number, z1: number): boolean => {
    for (let z = z0; z <= z1; z += 1) if (kind(c, z) !== TileKind.Wall || water(c, z)) return false;
    return true;
  };
  const dry = (c: Col, z: number): boolean => DIRS.every((d) => !water(add(c, d), z));
  const cistern: Col[] = [];
  for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= 1; i += 1) cistern.push({ x: well.x + i, y: well.y + j });
  const inCistern = (c: Col): boolean => Math.abs(c.x - well.x) <= 1 && Math.abs(c.y - well.y) <= 1;
  if (!cistern.every((c) => inMap(c) && solid(c, cisternZ, cisternZ))) return null;
  let best: CisternPlan | null = null;
  for (let by = 1; by < map.h - 1; by += 1) for (let bx = 1; bx < map.w - 1; bx += 1) {
    const b = { x: bx, y: by };
    // The brook's water: one level below its banks (03 § Local map generation).
    let bz = -1;
    for (let z = hallZ + 1; z < map.d - 1; z += 1) if (water(b, z) && !water(b, z + 1)) { bz = z; break; }
    if (bz < 0) continue;
    for (const d of DIRS) {
      const p = add(b, d);
      const s = add(b, d, 2);
      for (const e of [{ x: d.y, y: d.x }, { x: -d.y, y: -d.x }]) {
        const t = add(s, e);
        const cols = [p, s, t];
        if (!cols.every(inMap)) continue;
        if (!cols.every((c) => surfaceOver(c, bz))) continue;
        if (!solid(s, cisternZ, bz) || !solid(t, cisternZ, bz) || !dry(s, bz) || !dry(t, bz)) continue;
        // The tunnel: along d until level with the well, then across to it, stopping at the cistern.
        const tunnel: Col[] = [s];
        let at = s;
        const toward = (from: number, to: number): number => Math.sign(to - from);
        const alongWell = d.x !== 0 ? well.x : well.y;
        while ((d.x !== 0 ? at.x : at.y) !== alongWell && !inCistern(at)) {
          if (toward(d.x !== 0 ? at.x : at.y, alongWell) !== (d.x !== 0 ? d.x : d.y)) break;
          at = add(at, d);
          if (!inCistern(at)) tunnel.push(at);
        }
        if ((d.x !== 0 ? at.x : at.y) !== alongWell && !inCistern(at)) continue;
        const step = d.x !== 0 ? { x: 0, y: toward(at.y, well.y) } : { x: toward(at.x, well.x), y: 0 };
        while (!inCistern(at)) {
          at = add(at, step);
          if (!inCistern(at)) tunnel.push(at);
        }
        // The floodgate stands on the last tile, beside the cistern; no other tunnel tile comes
        // within a step of the cistern, so the shut floodgate parts them for walkers too.
        if (tunnel.length < 3 || tunnel.length > maxTunnel) continue;
        const f = tunnel[tunnel.length - 1] as Col;
        if (!tunnel.every((c) => inMap(c) && solid(c, cisternZ, cisternZ))) continue;
        const nearCistern = (c: Col): boolean => Math.abs(c.x - well.x) <= 2 && Math.abs(c.y - well.y) <= 2;
        if (tunnel.slice(0, -1).some(nearCistern) || nearCistern(t)) continue;
        if (best === null || tunnel.length < best.tunnel.length) {
          const tops = { p: map.columnSurfaceZ(p.x, p.y), s: map.columnSurfaceZ(s.x, s.y), t: map.columnSurfaceZ(t.x, t.y) };
          best = { bz, hallZ, cisternZ, p, s, t, f, w: well, a: add(well, across), tops, tunnel, cistern };
        }
      }
    }
  }
  return best;
}

/** The pieces of a plan as columns and the levels each spans. */
function pieces(plan: CisternPlan): { c: Col; z0: number; z1: number }[] {
  const { cisternZ: L, hallZ: H, bz, tops } = plan;
  return [
    { c: plan.s, z0: L, z1: tops.s }, { c: plan.t, z0: L, z1: tops.t }, { c: plan.p, z0: bz, z1: tops.p },
    { c: plan.w, z0: L, z1: H }, { c: plan.a, z0: L, z1: H },
    ...[...plan.tunnel, ...plan.cistern].map((c) => ({ c, z0: L, z1: L })),
  ];
}

/**
 * The tiles a dig must keep off for the cistern's sake: every tile of the cistern, its feed and its
 * columns, and the eight around each on its level. Water spreads on its level into any tile dug
 * beside it, and on the brook's side of the floodgate the brook would follow.
 */
export function cisternKeepOff(w: TestWorld, plan: CisternPlan): Set<TileIndex> {
  const out = new Set<TileIndex>();
  for (const { c, z0, z1 } of pieces(plan)) {
    for (let z = z0; z <= z1; z += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const x = c.x + dx, y = c.y + dy;
      if (x >= 0 && y >= 0 && x < w.map.w && y < w.map.h) out.add(w.index(x, y, z));
    }
  }
  return out;
}

/**
 * Whether the rock a plan keeps off is still whole: below the brook's water and off the hall's
 * level, every tile around the cistern's pieces is undug, undesignated natural rock, so nothing the
 * fortress has dug or means to dig already lies beside the water.
 */
export function keepOffWhole(w: TestWorld, plan: CisternPlan): boolean {
  const map = w.map;
  for (const { c, z0, z1 } of pieces(plan)) {
    const inHall = (c.x === plan.w.x && c.y === plan.w.y) || (c.x === plan.a.x && c.y === plan.a.y);
    for (let z = z0; z <= Math.min(z1, plan.bz - 1); z += 1) {
      if (inHall && z === plan.hallZ) continue;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const t = map.offset(w.index(c.x, c.y, z), dx, dy, 0);
        if (t < 0 || map.kindAt(t) !== TileKind.Wall || map.designationAt(t) !== 0 || map.fluidLevelAt(t) !== 0) return false;
      }
    }
  }
  return true;
}

/** Where the building of a cistern stands: each step is taken once, when the map allows it. */
export interface CisternWork {
  readonly plan: CisternPlan;
  /** The hall tile the lever stands on. */
  readonly leverTile: TileIndex;
  readonly priority: number;
  readonly steps: Set<string>;
  floodgateId: EntityId;
  leverId: EntityId;
  wellId: EntityId;
  /** The lever pulls so far: an odd count has asked for the floodgate open. */
  pulls: number;
  /** The tick the floodgate was seen open, and the ticks it has stood open. */
  openedAt: number;
  openTicks: number;
  /** The tick the floodgate was last seen shut again. */
  shutAt: number;
  /** The most water seen on the hall's tiles over the cistern. */
  hallWater: number;
  readonly log: string[];
}

export function cisternWork(plan: CisternPlan, leverTile: TileIndex, priority: number): CisternWork {
  return { plan, leverTile, priority, steps: new Set(), floodgateId: 0, leverId: 0, wellId: 0, pulls: 0, openedAt: -1, openTicks: 0, shutAt: -1, hallWater: 0, log: [] };
}

/** The water in the cistern, behind the floodgate. */
export function cisternWater(w: TestWorld, work: CisternWork): number {
  const { plan } = work;
  let sum = 0;
  for (const c of plan.cistern) sum += w.map.fluidLevelAt(tileOf(w, c, plan.cisternZ));
  return sum;
}

/** Whether the well stands built over water. */
export function wellWorks(w: TestWorld, work: CisternWork): boolean {
  const b = w.readers.of<BuildingsReader>('14');
  return work.wellId !== 0 && b.get(work.wellId)?.state === 'built' && b.wellWorking(work.wellId);
}

/**
 * One look at the cistern's work, as a player watching the map: each designation and building is
 * ordered once the dug tiles allow it. `send` submits a command and returns whether it was taken.
 */
export function lookAtCistern(w: TestWorld, work: CisternWork, send: (command: Command) => boolean): void {
  const { plan, priority, steps } = work;
  const map = w.map;
  const b = w.readers.of<BuildingsReader>('14');
  const { hallZ: H, cisternZ: L, bz } = plan;
  const at = (c: Col, z: number): TileIndex => tileOf(w, c, z);
  const kind = (c: Col, z: number): TileKind => map.kindAt(at(c, z));
  const once = (key: string, ready: boolean, act: () => boolean): void => {
    if (steps.has(key) || !ready) return;
    if (act()) { steps.add(key); work.log.push(`${key} @${w.tick}`); }
  };
  const place = (type: string, tile: TileIndex): EntityId => {
    if (!send({ type: 'PlaceBuilding', buildingType: type, origin: tile, orientation: 0, materialChoice: 0 })) return 0;
    return (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
  };
  const built = (id: EntityId): boolean => id !== 0 && b.get(id)?.state === 'built';
  const dug = (c: Col, z: number): boolean => kind(c, z) !== TileKind.Wall;
  const channel = (c: Col, z: number): boolean => send({ type: 'Designate', kind: 'channel', priority, tiles: [at(c, z)] });

  for (const c of plan.cistern) work.hallWater = Math.max(work.hallWater, map.fluidLevelAt(at(c, H)));

  const digAt = (cols: readonly Col[]): boolean => {
    const tiles = cols.map((c) => at(c, L)).filter((t) => map.kindAt(t) === TileKind.Wall);
    return tiles.length === 0 || send({ type: 'Designate', kind: 'dig', priority, tiles });
  };
  // From the hall: the access stair to the cistern, then the cistern.
  once('access', dug(plan.a, H), () => send({ type: 'DesignateStairwell', x: plan.a.x, y: plan.a.y, zTop: H, zBottom: L, priority }));
  once('cistern', steps.has('access'), () => digAt(plan.cistern.filter((c) => !(c.x === plan.a.x && c.y === plan.a.y))));
  // From the surface: the stair down to the tunnel's level, and the tunnel from its foot.
  once('stair', true, () => send({ type: 'DesignateStairwell', x: plan.t.x, y: plan.t.y, zTop: plan.tops.t, zBottom: L, priority }));
  once('tunnel', steps.has('stair'), () => digAt(plan.tunnel.slice(0, -1)));
  // The floodgate's tile joins the two last, once the stair stands whole: whoever is on the
  // tunnel's side when the floodgate shuts walks out up the stair.
  let stairWhole = true;
  for (let z = L; z < plan.tops.t; z += 1) if (![TileKind.StairsUp, TileKind.StairsUpDown].includes(kind(plan.t, z))) stairWhole = false;
  once('gate tile', stairWhole && steps.has('cistern') && plan.tunnel.slice(0, -1).every((c) => dug(c, L)), () => digAt([plan.f]));
  // The well's column, a level at a time; its last level once the cistern is dug under it.
  once('well:0', kind(plan.w, H) === TileKind.Floor, () => channel(plan.w, H));
  for (let k = 1; k < CISTERN_DEPTH; k += 1) {
    const z = H - k;
    once(`well:${k}`, steps.has(`well:${k - 1}`) && kind(plan.w, z + 1) === TileKind.Open && kind(plan.w, z) === TileKind.Ramp &&
      (k < CISTERN_DEPTH - 1 || dug(plan.w, L)), () => channel(plan.w, z));
  }
  // The floodgate on the tunnel's last tile as soon as it is dug: until it stands, the tunnel joins
  // the halls to the surface by the stair.
  once('floodgate', dug(plan.f, L), () => (work.floodgateId = place('floodgate_building', at(plan.f, L))) !== 0);
  once('lever', map.kindAt(work.leverTile) === TileKind.Floor, () => (work.leverId = place('lever', work.leverTile)) !== 0);
  once('link', built(work.floodgateId) && built(work.leverId), () => send({ type: 'LinkMechanism', sourceId: work.leverId, targetId: work.floodgateId }));
  // A channel column, a level at a time from the column's surface: each level is a ramp the one above left.
  const column = (name: string, c: Col, top: number, bottom: number, ready: boolean): void => {
    for (let z = top; z >= bottom; z -= 1) {
      once(`${name}:${z}`, ready && (z === top ? kind(c, z) === TileKind.Floor
        : steps.has(`${name}:${z + 1}`) && kind(c, z + 1) === TileKind.Open && kind(c, z) === TileKind.Ramp), () => channel(c, z));
    }
  };
  // The shaft beside the stair, its last level once the tunnel's first tile is dug under it.
  column('shaft', plan.s, plan.tops.s, L + 2, steps.has('stair'));
  once(`shaft:${L + 1}`, steps.has(`shaft:${L + 2}`) && kind(plan.s, L + 2) === TileKind.Open && kind(plan.s, L + 1) === TileKind.Ramp && dug(plan.s, L),
    () => channel(plan.s, L + 1));
  // The bank down to one level above the water; its last level, which lets the brook in, is the breach.
  column('bank', plan.p, plan.tops.p, bz + 2, steps.has('stair'));
  const linked = built(work.leverId) && (b.get(work.leverId)?.linkedIds ?? []).includes(work.floodgateId);
  const bankReady = plan.tops.p === bz + 1 ? kind(plan.p, bz + 1) === TileKind.Floor : steps.has(`bank:${bz + 2}`) && kind(plan.p, bz + 1) === TileKind.Ramp;
  // Before the brook comes in, nobody is to walk in the tunnel or on its stair (a hauler after the
  // tunnel's stone would drown there): their traffic is forbidden, and the breach waits for them to
  // be empty.
  const flooded = [...plan.tunnel.slice(0, -1).map((c) => at(c, L))];
  for (let z = L; z < plan.tops.t; z += 1) flooded.push(at(plan.t, z));
  const ready = linked && bankReady && kind(plan.s, L + 1) === TileKind.Open && plan.tunnel.every((c) => dug(c, L));
  once('seal', ready, () => send({ type: 'SetTraffic', tiles: flooded, mode: 'forbidden' }));
  const empty = (): boolean => {
    const ent = w.game.world.entities;
    const tiles = new Set(flooded);
    return !ent.with(C.Creature, C.Position).some((id) => {
      const p = ent.get(id, C.Position);
      return p !== undefined && ent.get(id, C.Creature)?.faction === 'fortress' && tiles.has(w.index(p.x, p.y, p.z));
    });
  };
  once('breach', ready && steps.has('seal') && empty(), () => channel(plan.p, bz + 1));
  // The brook stands at the floodgate: open it, and shut it as soon as it has opened; again if no
  // water has reached the well's column a day after.
  const gate = work.floodgateId === 0 ? '' : b.mechanismState(work.floodgateId);
  if (gate === 'open' && work.openedAt < 0) work.openedAt = w.tick;
  if (gate === 'closed' && work.openedAt >= 0) { work.openTicks += w.tick - work.openedAt; work.openedAt = -1; work.shutAt = w.tick; }
  if (linked && work.wellId === 0 && map.fluidLevelAt(at(plan.s, L)) > 0) {
    const asked = work.pulls % 2 === 1 ? 'open' : 'closed';
    const dry = map.fluidLevelAt(at(plan.w, L)) === 0 && (work.pulls === 0 || w.tick - work.shutAt >= SETTLE_TICKS);
    if (gate === asked && (asked === 'open' || dry) && send({ type: 'PullLever', leverId: work.leverId })) {
      work.pulls += 1;
      work.log.push(`pull ${asked === 'open' ? 'shut' : 'open'} @${w.tick}`);
    }
  }
  // The well, over the water.
  once('well', gate === 'closed' && work.pulls > 0 && work.pulls % 2 === 0 && map.fluidLevelAt(at(plan.w, L)) > 0 && kind(plan.w, H) === TileKind.Open,
    () => (work.wellId = place('well', at(plan.w, H))) !== 0);
}
