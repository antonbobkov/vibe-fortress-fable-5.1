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
 * - The feed tunnel at `L`, from under `S` along `d`, then across to the cistern. The floodgate `F`
 *   stands midway on a straight stretch, dug and built from the cistern's side; the brook's side,
 *   dug from `T`'s foot, stops a tile short of it until it stands, so the two sides never meet
 *   but through the shut floodgate and the stair is never a way into the halls.
 * - The cistern, a room at `L` under the hall; the well's column `W` is channelled from the hall's
 *   floor down to the level above it, which it leaves a ramp until the cistern is filled, and an
 *   access stair `A` beside it joins the hall to the cistern while it is dug.
 *
 * Water lifts by pressure only into a tile with an open bottom (04 § The four movement rules, rule
 * 3), and the shaft's full column carries its pressure through the tunnel, so an open floodgate
 * fills the cistern to the brim and would lift the brook up an open well column into the hall. So
 * the column's last level, a ramp and solid-bottomed, is channelled only once the cistern is full
 * and the floodgate shut again: however long the gate stands open, the water stops under the ramp,
 * and once it is shut the cistern's water stands level, with nothing higher in its body to lift it.
 * Until the brook is let in the floodgate shuts the tunnel, open to the surface by `T`, out of the
 * halls.
 */

import { C, ItemFlag } from '@core/components';
import { FLUID_MAX_LEVEL, TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { Command } from '@core/commands';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { LINK_DELAY_TICKS } from '@systems/buildings/constants';
import type { TestWorld } from './test-world';

/** Levels between the hall's floor and the cistern: the well's column is open on the two between. */
export const CISTERN_DEPTH = 3;

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
  /** The floodgate's place in the tunnel: the tiles before it are the brook's, the tiles after it the cistern's. */
  readonly gate: number;
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
        // The floodgate stands midway, on a straight stretch, so the tunnel is dug from both ends;
        // no tile of the brook's side comes within a step of the cistern's, so the shut floodgate
        // parts them for walkers too.
        if (tunnel.length < 3 || tunnel.length > maxTunnel) continue;
        if (!tunnel.every((c) => inMap(c) && solid(c, cisternZ, cisternZ))) continue;
        let gate = -1;
        for (let i = 1; i < tunnel.length - 1; i += 1) {
          const a = tunnel[i - 1] as Col, c = tunnel[i + 1] as Col;
          if ((a.x === c.x || a.y === c.y) && (gate < 0 || Math.abs(i - tunnel.length / 2) < Math.abs(gate - tunnel.length / 2))) gate = i;
        }
        if (gate < 0) continue;
        const brookSide = [...tunnel.slice(0, gate), t];
        const wellSide = [...cistern, ...tunnel.slice(gate + 1)];
        if (brookSide.some((u) => wellSide.some((v) => Math.max(Math.abs(u.x - v.x), Math.abs(u.y - v.y)) <= 1))) continue;
        if (best === null || tunnel.length < best.tunnel.length) {
          const tops = { p: map.columnSurfaceZ(p.x, p.y), s: map.columnSurfaceZ(s.x, s.y), t: map.columnSurfaceZ(t.x, t.y) };
          best = { bz, hallZ, cisternZ, p, s, t, f: tunnel[gate] as Col, gate, w: well, a: add(well, across), tops, tunnel, cistern };
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
    // The well's column and the access stair below the hall's level: on it they hold no water.
    { c: plan.w, z0: L, z1: H - 1 }, { c: plan.a, z0: L, z1: H - 1 },
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
  /** The well room's tiles and its passage on the hall's level, to dig first (none for a well in a hall). */
  readonly room: readonly TileIndex[];
  readonly priority: number;
  readonly steps: Set<string>;
  floodgateId: EntityId;
  leverId: EntityId;
  wellId: EntityId;
  /** The lever pulls so far: an odd count has asked for the floodgate open. */
  pulls: number;
  /** The tick the last pull was seen done (no pull job left), or -1 while one is pending. */
  pulledAt: number;
  /** The tick the floodgate was seen open, and the ticks it has stood open. */
  openedAt: number;
  openTicks: number;
  /** The tick the floodgate was last seen shut again. */
  shutAt: number;
  /** The most water seen on the hall's tiles over the cistern. */
  hallWater: number;
  readonly log: string[];
}

export function cisternWork(plan: CisternPlan, leverTile: TileIndex, priority: number, room: readonly TileIndex[] = []): CisternWork {
  return { plan, leverTile, priority, room, steps: new Set(), floodgateId: 0, leverId: 0, wellId: 0, pulls: 0, pulledAt: -1, openedAt: -1, openTicks: 0, shutAt: -1, hallWater: 0, log: [] };
}

/** The water in the cistern, behind the floodgate. */
export function cisternWater(w: TestWorld, work: CisternWork): number {
  const { plan } = work;
  let sum = 0;
  for (const c of [...plan.cistern, ...plan.tunnel.slice(plan.gate + 1)]) sum += w.map.fluidLevelAt(tileOf(w, c, plan.cisternZ));
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
  const place = (type: string, tile: TileIndex, buildPriority = priority): EntityId => {
    if (!send({ type: 'PlaceBuilding', buildingType: type, origin: tile, orientation: 0, materialChoice: 0, priority: buildPriority })) return 0;
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
  // From the hall: the access stair to the cistern, then the cistern and the tunnel up to the floodgate.
  // A well room and its passage on the hall's level, where the well does not stand in a hall already dug.
  once('room', true, () => {
    const tiles = work.room.filter((t) => map.kindAt(t) === TileKind.Wall);
    return tiles.length === 0 || send({ type: 'Designate', kind: 'dig', priority, tiles });
  });
  once('access', dug(plan.a, H), () => send({ type: 'DesignateStairwell', x: plan.a.x, y: plan.a.y, zTop: H, zBottom: L, priority }));
  // The two sides never meet but through a shut floodgate, or the stair would be a back door from the
  // brook into the halls: the hall's side digs the cistern, its half of the tunnel and the
  // floodgate's tile; the brook's side stops a tile short, and digs that tile only once the
  // floodgate stands, from the stair, so whoever digs it walks out that way.
  once('cistern', steps.has('access'), () => digAt([...plan.cistern.filter((c) => !(c.x === plan.a.x && c.y === plan.a.y)), ...plan.tunnel.slice(plan.gate)]));
  // From the surface: the stair down to the tunnel's level, and the tunnel from its foot.
  once('stair', true, () => send({ type: 'DesignateStairwell', x: plan.t.x, y: plan.t.y, zTop: plan.tops.t, zBottom: L, priority }));
  once('tunnel', steps.has('stair'), () => digAt(plan.tunnel.slice(0, plan.gate - 1)));
  once('near tile', built(work.floodgateId), () => digAt([plan.tunnel[plan.gate - 1] as Col]));
  // The well's column, a level at a time. Its last level stays a ramp, solid-bottomed, until the
  // cistern is filled and the floodgate shut again: water lifts by pressure only into a tile with an
  // open bottom (04 § The four movement rules, rule 3), so while the ramp stands an open floodgate
  // fills the cistern and no more, however long it stands open; and once the gate is shut the
  // cistern's water stands level, with nothing higher in its body to lift it up the opened column.
  once('well:0', kind(plan.w, H) === TileKind.Floor, () => channel(plan.w, H));
  for (let k = 1; k < CISTERN_DEPTH; k += 1) {
    const z = H - k;
    once(`well:${k}`, steps.has(`well:${k - 1}`) && kind(plan.w, z + 1) === TileKind.Open && kind(plan.w, z) === TileKind.Ramp &&
      (k < CISTERN_DEPTH - 1 || (dug(plan.w, L) && steps.has('filled'))), () => channel(plan.w, z));
  }
  once('floodgate', dug(plan.f, L), () => (work.floodgateId = place('floodgate_building', at(plan.f, L))) !== 0);
  once('lever', map.kindAt(work.leverTile) === TileKind.Floor, () => (work.leverId = place('lever', work.leverTile)) !== 0);
  // The link, ordered again whenever its job is gone and the two are not linked (a job given up);
  // its job takes the cistern's priority: given its own, it stood open for months behind routine work.
  const isLinked = built(work.leverId) && (b.get(work.leverId)?.linkedIds ?? []).includes(work.floodgateId);
  if (built(work.floodgateId) && built(work.leverId) && !isLinked) {
    const linkJobs = w.readers.of<JobsReader>('11').list().filter((job) => job.key.startsWith(`link_mechanism:${work.leverId}:`));
    if (linkJobs.length === 0 && send({ type: 'LinkMechanism', sourceId: work.leverId, targetId: work.floodgateId })) {
      steps.add('link');
      work.log.push(`link @${w.tick}`);
    }
    for (const job of linkJobs) if (job.priority > priority) send({ type: 'SetJobPriority', jobId: job.id, priority });
  }
  // The ground a channel opens: a floor, or the sapling or shrub grown on it since it was planned
  // (03 § Tile transitions); a tree grown there is felled first.
  const ground = (c: Col, z: number): boolean => {
    const k = kind(c, z);
    if (k === TileKind.Tree) send({ type: 'Designate', kind: 'chop', priority, tiles: [at(c, z)] });
    return k === TileKind.Floor || k === TileKind.Sapling || k === TileKind.Shrub;
  };
  // A channel column, a level at a time from the column's surface: each level is a ramp the one above
  // left, channelled once the stair beside it is dug to that level, so its miner steps onto the stair
  // and is never left over the open shaft.
  const stairAt = (z: number): boolean => [TileKind.StairsUp, TileKind.StairsDown, TileKind.StairsUpDown].includes(kind(plan.t, z));
  const column = (name: string, c: Col, top: number, bottom: number, ready: boolean): void => {
    for (let z = top; z >= bottom; z -= 1) {
      once(`${name}:${z}`, ready && (z === top ? !steps.has(`${name}:${z}`) && ground(c, z)
        : steps.has(`${name}:${z + 1}`) && kind(c, z + 1) === TileKind.Open && kind(c, z) === TileKind.Ramp && stairAt(z)), () => channel(c, z));
    }
  };
  // The shaft beside the stair, its last level once the tunnel's first tile is dug under it.
  column('shaft', plan.s, plan.tops.s, L + 2, steps.has('stair'));
  once(`shaft:${L + 1}`, steps.has(`shaft:${L + 2}`) && kind(plan.s, L + 2) === TileKind.Open && kind(plan.s, L + 1) === TileKind.Ramp && dug(plan.s, L) && stairAt(L + 1),
    () => channel(plan.s, L + 1));
  // The bank down to one level above the water; its last level, which lets the brook in, is the breach.
  column('bank', plan.p, plan.tops.p, bz + 2, steps.has('stair'));
  const linked = built(work.leverId) && (b.get(work.leverId)?.linkedIds ?? []).includes(work.floodgateId);
  const bankReady = !steps.has('breach') && (plan.tops.p === bz + 1 ? ground(plan.p, bz + 1) : steps.has(`bank:${bz + 2}`) && kind(plan.p, bz + 1) === TileKind.Ramp);
  // The stone dug on the brook's side is left where it lies, forbidden: hauling it would send the
  // haulers out to the brook and down the stair, and the water will cover it.
  const feedSide: TileIndex[] = plan.tunnel.slice(0, plan.gate).map((c) => at(c, L));
  for (let z = L; z <= plan.tops.t; z += 1) feedSide.push(at(plan.t, z));
  for (let z = L; z <= plan.tops.s; z += 1) feedSide.push(at(plan.s, z));
  for (let z = bz; z <= plan.tops.p; z += 1) feedSide.push(at(plan.p, z));
  for (const tile of feedSide) {
    for (const id of w.readers.entities.at(tile)) {
      const item = w.game.world.entities.get(id, C.Item);
      if (item !== undefined && (item.flags & ItemFlag.Forbidden) === 0 && item.carriedBy === 0) send({ type: 'ForbidItem', itemId: id, on: true });
    }
  }
  // Before the brook comes in, nobody is to walk in the tunnel or on its stair (a hauler after the
  // tunnel's stone would drown there): their traffic is forbidden, and the breach waits for them to
  // be empty.
  const flooded = plan.tunnel.slice(0, plan.gate).map((c) => at(c, L));
  for (let z = L; z < plan.tops.t; z += 1) flooded.push(at(plan.t, z));
  const ready = linked && bankReady && kind(plan.s, L + 1) === TileKind.Open && plan.tunnel.every((c) => dug(c, L));
  once('seal', ready, () => send({ type: 'SetTraffic', tiles: flooded, mode: 'forbidden' }));
  const empty = (tileList: readonly TileIndex[]): boolean => {
    const ent = w.game.world.entities;
    const tiles = new Set(tileList);
    return !ent.with(C.Labors, C.Position).some((id) => {
      const p = ent.get(id, C.Position);
      return p !== undefined && ent.alive(id) && tiles.has(w.index(p.x, p.y, p.z));
    });
  };
  once('breach', ready && steps.has('seal') && empty(flooded), () => channel(plan.p, bz + 1));
  // The brook stands at the floodgate: the cistern's side is forbidden to traffic in its turn (in
  // `three-years-p2-1` at shift 150 seven thirsty dwarves stood in it when the floodgate opened and
  // drowned), and once nobody is in it the lever is pulled to open the floodgate. The shaft's full
  // column carries its pressure through the tunnel (04 § The four movement rules, rule 3), so the
  // cistern fills to the brim, but the well column's last level is still a ramp and the water lifts
  // no higher: the gate may stand open as long as the dwarf who takes the shut pull walks. Once the
  // water stands full under the well (or, a day open, stands there at all: a frozen brook sends no
  // more), the lever is pulled to shut the floodgate. The gate follows each pull
  // `LINK_DELAY_TICKS` later (14); it is read, not the count of pulls, so a pull whose job was lost
  // is pulled again.
  const gate = work.floodgateId === 0 ? '' : b.mechanismState(work.floodgateId);
  if (gate === 'open' && work.openedAt < 0) work.openedAt = w.tick;
  if (gate === 'closed' && work.openedAt >= 0) { work.openTicks += w.tick - work.openedAt; work.openedAt = -1; work.shutAt = w.tick; }
  const filled = [...plan.cistern, ...plan.tunnel.slice(plan.gate + 1)].map((c) => at(c, L));
  const brookAtGate = linked && work.wellId === 0 && map.fluidLevelAt(at(plan.tunnel[plan.gate - 1] as Col, L)) > 0;
  once('cistern seal', brookAtGate, () => send({ type: 'SetTraffic', tiles: filled, mode: 'forbidden' }));
  const underWell = map.fluidLevelAt(at(plan.w, L));
  if (brookAtGate && steps.has('cistern seal') && !steps.has('filled')) {
    const pending = w.readers.of<JobsReader>('11').list().some((job) => job.key.startsWith(`pull_lever:${work.leverId}:`));
    if (pending) work.pulledAt = -1;
    else if (work.pulledAt < 0) work.pulledAt = w.tick;
    const reached = work.pulledAt >= 0 && w.tick - work.pulledAt > LINK_DELAY_TICKS;
    const columnShut = kind(plan.w, L + 1) === TileKind.Ramp;
    const full = underWell >= FLUID_MAX_LEVEL || (underWell > 0 && work.openedAt >= 0 && w.tick - work.openedAt >= TICKS_PER_DAY);
    if (reached && gate === 'closed' && work.pulls > 0 && underWell > 0) {
      steps.add('filled');
      work.log.push(`filled @${w.tick}`);
    } else {
      const open = reached && gate === 'closed' && columnShut && empty(filled);
      const shut = reached && gate === 'open' && full;
      if (!pending && (open || shut) && send({ type: 'PullLever', leverId: work.leverId })) {
        work.pulls += 1;
        work.log.push(`pull ${shut ? 'shut' : 'open'} @${w.tick}`);
      }
    }
  }
  // The well, over the water, once the column is open down to it.
  once('well', steps.has('filled') && gate === 'closed' && underWell > 0 && kind(plan.w, H) === TileKind.Open && kind(plan.w, L + 1) === TileKind.Open,
    () => (work.wellId = place('well', at(plan.w, H))) !== 0);
}
