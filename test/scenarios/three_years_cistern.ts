/**
 * T-663: water inside the gate for the three-year fortress. A player who has seen the fortress's
 * thirsty walk out to the brook under an alert brings the brook inside: a cistern fed through a
 * floodgate on a lever, and a well over it (`cistern-well.ts`, `bd_cistern_well`). Under a corner
 * of the hearth hall where the brook's water can reach it, else under a well room dug near the
 * brook on the hall level and joined to the halls' corridors underground. Planned on the first
 * look, so that no later dig comes beside its water (`keepOff`); built once the drink has run short,
 * as routine work, with a mechanic's workshop for the mechanisms.
 */

import { TICKS_PER_DAY } from '@core/constants';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { ItemsReader } from '@systems/items';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import { TileFlag, TileKind } from '@core/map3d';
import { cisternKeepOff, cisternWork, keepOffWhole, lookAtCistern, planCistern, wellWorks, type CisternPlan, type CisternWork, type Col } from './cistern-well';
import { command, exemptCommand, keepOff } from './script-commands';
import { placeEconomyBuilding, ROUTINE } from './three_years_economy';
import { note } from './three_years_measurements';
import type { FortressState } from './three_years_fortress';
import type { TestWorld } from './test-world';

/**
 * The longest feed tunnel to a cistern under the hearth hall. A level tunnel fed by the shaft's full
 * column carries the water and its pressure to its end (04 § The four movement rules, rule 3),
 * so the length is the script's choice: the twenty sweep maps' hearth halls lie 27 to 52 tiles of
 * tunnel from the brook where a corner suits (T-694), and the hall is where a sheltering dwarf
 * drinks at want. The well's column stays a ramp short of the cistern until it is filled
 * (`cistern-well.ts`), so the gate's open time does not flood the hall.
 */
export const HALL_TUNNEL_MAX = 60;
/** The farthest from the brook a well room is dug, and the longest feed tunnel to it. */
export const ROOM_TUNNEL_MAX = 10;
/**
 * The cistern is built once the drink has run short: under `SHORT_DRINK_DAYS` for the adults (0.77 a
 * day each, as `DRINK_RESERVE_DAYS`), the four days a raid's alert holds the fortress (T-656). Begun
 * on day 56 a step ahead of routine work, it took the miners and the mechanics for weeks of the
 * first year of fortresses that never ran short (T-663's first sweep).
 */
export const SHORT_DRINK_DAYS = 4;
/** A shortage counts from this day: in the first two months the wagon's drink runs down before the stills catch up. */
export const SHORT_FROM_DAY = 56;
/** The cistern's digging and building: routine work. */
const CISTERN_PRIORITY = ROUTINE;
/** Rejections the cistern's commands meet when the map has moved on since the look. */
const CISTERN_EXPECTED = ['precondition_failed', 'bad_placement', 'footprint_blocked', 'not_discovered', 'not_found', 'no_tag', 'not_linkable'];

/**
 * The well's corner of the hearth hall (x, y from the fortress's centre), the access stair beside
 * it, and the lever's corner across the hall: the hall's chairs and hearth stand in its middle.
 */
const CORNERS: readonly { well: [number, number]; across: [number, number]; lever: [number, number] }[] = [
  { well: [8, 8], across: [0, -1], lever: [13, 8] },
  { well: [8, 4], across: [0, 1], lever: [13, 4] },
  { well: [13, 8], across: [0, -1], lever: [8, 8] },
  { well: [13, 4], across: [0, 1], lever: [8, 4] },
];

const DIRS: readonly Col[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Whether a plan suits the fortress: whole rock about it, no bedroom of the plan and no mine shaft beside its water. */
function suits(w: TestWorld, state: FortressState, plan: CisternPlan, planned: ReadonlySet<number>): Set<number> | null {
  if (!keepOffWhole(w, plan)) return null;
  const kept = cisternKeepOff(w, plan);
  if ([...planned].some((t) => kept.has(t))) return null;
  // Nor under a zone already laid out on the surface (the first field): its crops would stand by an open shaft.
  const zones = w.readers.of<BuildingsReader>('14');
  if ([...kept].some((t) => zones.zoneAt(t) !== 0)) return null;
  // The mine's shaft, whose stair is dug later down to the cistern's level, must not open on its water.
  const shaft = { x: state.cx + 6, y: Math.min(w.map.h - 3, state.cy + 15) };
  if ([...plan.cistern, ...plan.tunnel].some((c) => Math.abs(c.x - shaft.x) + Math.abs(c.y - shaft.y) <= 1)) return null;
  return kept;
}

/**
 * Where the water can reach: under a corner of the hearth hall when the tunnel is short enough to
 * carry it there (`HALL_TUNNEL_MAX`), else under a well room near the brook (`ROOM_TUNNEL_MAX`),
 * dug on the hall level and joined to the halls' corridors by a passage of its own, nearest first.
 * Null when neither serves.
 */
function planFortressCistern(w: TestWorld, state: FortressState): CisternWork | null {
  const { cx, cy, hallZ } = state;
  const map = w.map;
  const planned = new Set(state.bedroomPlans.flatMap((bp) => [...bp.tiles, w.index(bp.doorX, bp.doorY, hallZ)]));
  let best: CisternWork | null = null;
  for (const corner of CORNERS) {
    const plan = planCistern(w, { x: cx + corner.well[0], y: cy + corner.well[1] }, hallZ, { x: corner.across[0], y: corner.across[1] }, HALL_TUNNEL_MAX);
    if (plan === null || suits(w, state, plan, planned) === null) continue;
    if (best === null || plan.tunnel.length < best.plan.tunnel.length) {
      best = cisternWork(plan, w.index(cx + corner.lever[0], cy + corner.lever[1], hallZ), CISTERN_PRIORITY);
    }
  }
  if (best !== null) return best;
  // The halls' corridors on their level (`setupThreeYearsFortress`): the south one and the west one.
  const corridor = new Set<number>();
  for (let y = cy + 7; y <= Math.min(map.h - 3, cy + 45); y += 1) corridor.add(w.index(cx + 6, y, hallZ));
  for (let x = Math.max(1, cx - 13); x <= cx + 4; x += 1) corridor.add(w.index(x, cy + 6, hallZ));
  const brook: Col[] = [];
  for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) {
    for (let z = hallZ + 1; z < map.d; z += 1) if (map.fluidLevelAt(w.index(x, y, z)) > 0 && map.hasFlag(w.index(x, y, z), TileFlag.Outdoor)) { brook.push({ x, y }); break; }
  }
  const rock = (t: number): boolean => map.kindAt(t) === TileKind.Wall && map.designationAt(t) === 0 && map.fluidLevelAt(t) === 0 && !planned.has(t);
  let bestCost = Number.MAX_SAFE_INTEGER;
  for (let y = 3; y < map.h - 3; y += 1) for (let x = 3; x < map.w - 3; x += 1) {
    const toBrook = Math.min(...brook.map((b) => Math.max(Math.abs(b.x - x), Math.abs(b.y - y))));
    if (toBrook < 4 || toBrook > ROOM_TUNNEL_MAX) continue;
    const room: number[] = [];
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) room.push(w.index(x + dx, y + dy, hallZ));
    if (!room.every(rock)) continue;
    // The passage: to the nearest corridor tile, along one axis and then the other.
    let target = -1;
    for (const t of corridor) if (target < 0 || Math.abs(map.xOf(t) - x) + Math.abs(map.yOf(t) - y) < Math.abs(map.xOf(target) - x) + Math.abs(map.yOf(target) - y)) target = t;
    if (target < 0) continue;
    for (const across of DIRS) {
      const plan = planCistern(w, { x, y }, hallZ, across, ROOM_TUNNEL_MAX);
      if (plan === null) continue;
      const kept = suits(w, state, plan, planned);
      if (kept === null) continue;
      for (const xFirst of [true, false]) {
        const passage: number[] = [];
        let px = x, py = y;
        const tx = map.xOf(target), ty = map.yOf(target);
        const stepTo = (nx: number, ny: number): void => { px = nx; py = ny; const t = w.index(px, py, hallZ); if (!room.includes(t)) passage.push(t); };
        if (xFirst) { while (px !== tx) stepTo(px + Math.sign(tx - px), py); while (py !== ty) stepTo(px, py + Math.sign(ty - py)); }
        else { while (py !== ty) stepTo(px, py + Math.sign(ty - py)); while (px !== tx) stepTo(px + Math.sign(tx - px), py); }
        if (!passage.every((t) => (corridor.has(t) || rock(t)) && !kept.has(t))) continue;
        const cost = plan.tunnel.length + passage.length;
        if (cost >= bestCost) continue;
        bestCost = cost;
        best = cisternWork(plan, w.index(x - across.x, y - across.y, hallZ), CISTERN_PRIORITY, [...room, ...passage.filter((t) => !corridor.has(t))]);
      }
    }
  }
  return best;
}

/** The cistern's goods, ordered where they are made while the well is not yet built. */
function orderGoods(w: TestWorld, state: FortressState, work: CisternWork): void {
  const buildings = w.readers.of<BuildingsReader>('14');
  const items = w.readers.of<ItemsReader>('13');
  const built = (key: string): number => {
    const id = state.placedIds[key] ?? 0;
    return id !== 0 && buildings.get(id)?.state === 'built' ? id : 0;
  };
  const ent = w.game.world.entities;
  // An order for what is short, unless one stands; the small one-offs go to the front of the queue.
  const order = (workshop: number, recipeId: string, remaining: number, extra: Record<string, unknown> = {}): void => {
    if (workshop === 0 || remaining <= 0) return;
    const orders = (): readonly { recipe: number }[] => ent.get(workshop, C.Workshop)?.orders ?? [];
    const recipe = w.game.registry.table('recipes').index(recipeId);
    if (orders().some((o) => o.recipe === recipe)) return;
    if (!command(w, { type: 'AddWorkOrder', workshopId: workshop, order: { recipeId, mode: 'once', remaining, priority: CISTERN_PRIORITY, ...extra } }).ok) return;
    if (orders().length > 1) command(w, { type: 'ReorderWorkOrder', workshopId: workshop, from: orders().length - 1, to: 0 });
  };
  placeEconomyBuilding(w, state, 'mechanic', 8, 16);
  // A mechanism for each of the lever, its link and the well still to be done.
  const done = (id: number): boolean => id !== 0 && buildings.get(id)?.state === 'built';
  const linked = done(work.leverId) && (buildings.get(work.leverId)?.linkedIds ?? []).includes(work.floodgateId);
  const mechanisms = (done(work.leverId) ? 0 : 1) + (linked ? 0 : 1) + (done(work.wellId) ? 0 : 1);
  order(built('mechanic'), 'make_mechanism', mechanisms - items.available('mechanism'));
  if (work.floodgateId === 0) order(built('mason'), 'make_floodgate', 1 - items.available('floodgate'));
  if (!done(work.wellId)) {
    if (items.available('chain') + items.available('rope') === 0) order(built('forge'), 'forge_chain', 1, { materialFilter: 'iron' });
    if (items.available('bucket') === 0) order(built('carpenter'), 'make_bucket', 1);
  }
}

/**
 * The cistern's look: planned on the first one, its work ordered once the drink has run short, until the well
 * stands over water. Called with the rooms (`checkFortressRooms`) and, while the floodgate is to
 * be opened and shut, every watch (`playThreeYears`), as a player keeps an eye on the lever.
 */
export function keepWaterInside(w: TestWorld, state: FortressState): void {
  // T-663: off unless asked for: on the twenty-seed sweep it cost more than it saved (the report).
  if (state.waterInside !== true) return;
  if (state.cistern === undefined) {
    state.cistern = planFortressCistern(w, state);
    const work = state.cistern;
    if (work === null) {
      note('three_years_cistern', { day: Math.floor(w.tick / TICKS_PER_DAY) + 1, plan: 'none' });
      return;
    }
    const kept = cisternKeepOff(w, work.plan);
    for (const t of work.room) kept.add(t);
    keepOff(w, (t) => kept.has(t));
    note('three_years_cistern', { day: Math.floor(w.tick / TICKS_PER_DAY) + 1, plan: work.room.length > 0 ? 'room' : 'hall', tunnel: work.plan.tunnel.length, passage: work.room.length, brookZ: work.plan.bz,
      well: [work.plan.w.x, work.plan.w.y], feed: [work.plan.s.x, work.plan.s.y] });
    return;
  }
  const work = state.cistern;
  if (work === null) return;
  if (!work.steps.has('started')) {
    const adults = w.readers.of<DwarvesReader>('10').adults().length;
    if (w.tick < SHORT_FROM_DAY * TICKS_PER_DAY || w.readers.of<ItemsReader>('13').available('drink') >= adults * 0.77 * SHORT_DRINK_DAYS) return;
    work.steps.add('started');
    note('three_years_cistern', { day: Math.floor(w.tick / TICKS_PER_DAY) + 1, step: 'started: the drink ran short' });
  }
  if (wellWorks(w, work)) {
    if (!work.steps.has('working')) {
      work.steps.add('working');
      note('three_years_cistern', { day: Math.floor(w.tick / TICKS_PER_DAY) + 1, step: 'well works', water: cisternWaterNow(w, work), openTicks: work.openTicks });
    }
    return;
  }
  orderGoods(w, state, work);
  lookCistern(w, state);
}

/** The cistern's own designations and buildings, past `keepOff`; a refusal waits for the next look. */
function lookCistern(w: TestWorld, state: FortressState): void {
  const work = state.cistern;
  if (work === undefined || work === null) return;
  const before = work.log.length;
  lookAtCistern(w, work, (c: Command) => exemptCommand(w, c, CISTERN_EXPECTED).ok);
  for (const line of work.log.slice(before)) {
    if (line.startsWith('pull') || line.startsWith('well @') || line.startsWith('breach')) note('three_years_cistern', { day: Math.floor(w.tick / TICKS_PER_DAY) + 1, step: line, water: cisternWaterNow(w, work) });
  }
}

function cisternWaterNow(w: TestWorld, work: CisternWork): number {
  let sum = 0;
  for (const c of work.plan.cistern) sum += w.map.fluidLevelAt(w.index(c.x, c.y, work.plan.cisternZ));
  return sum;
}

/** Every watch while the brook is let in: the lever is pulled as soon as the floodgate has moved. */
export function watchCistern(w: TestWorld, state: FortressState): void {
  const work = state.cistern;
  if (work === undefined || work === null || !work.steps.has('breach') || work.wellId !== 0) return;
  lookCistern(w, state);
}
