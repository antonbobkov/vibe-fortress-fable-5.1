/**
 * T-663: water inside the gate for the three-year fortress. A player who has seen the fortress's
 * thirsty walk out to the brook under an alert brings the brook inside: a cistern under a corner of
 * the hearth hall, fed through a floodgate on a lever, and a well over it in the hall
 * (`cistern-well.ts`, `bd_cistern_well`). Planned on the first look, where the brook is near
 * enough (`CISTERN_TUNNEL_MAX`), so that no later dig comes beside its water (`keepOff`); built
 * from `CISTERN_DAY`, at routine priority, with a mechanic's workshop for the mechanisms.
 */

import { TICKS_PER_DAY } from '@core/constants';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { ItemsReader } from '@systems/items';
import type { BuildingsReader } from '@systems/buildings';
import { cisternKeepOff, cisternWork, keepOffWhole, lookAtCistern, planCistern, wellWorks, type CisternWork } from './cistern-well';
import { command, exemptCommand, keepOff } from './script-commands';
import { placeEconomyBuilding, ROUTINE } from './three_years_economy';
import { note } from './three_years_measurements';
import type { FortressState } from './three_years_fortress';
import type { TestWorld } from './test-world';

/** The longest feed tunnel the script digs: the brook is near enough within it. */
export const CISTERN_TUNNEL_MAX = 50;
/** The day the cistern's work starts, once the first mine and the halls have had the miners. */
export const CISTERN_DAY = 56;
/** Mechanisms the cistern uses: the lever, its link, and the well. */
const CISTERN_MECHANISMS = 3;
/** The cistern's digging and building: a step ahead of routine work, as the food chain is, or the miners never reach it. */
const CISTERN_PRIORITY = ROUTINE - 1;
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

/** The shortest whole plan over the hall's corners, or null where the brook is too far. */
function planFortressCistern(w: TestWorld, state: FortressState): CisternWork | null {
  const { cx, cy, hallZ } = state;
  const planned = new Set(state.bedroomPlans.flatMap((bp) => [...bp.tiles, w.index(bp.doorX, bp.doorY, hallZ)]));
  let best: CisternWork | null = null;
  for (const corner of CORNERS) {
    const plan = planCistern(w, { x: cx + corner.well[0], y: cy + corner.well[1] }, hallZ, { x: corner.across[0], y: corner.across[1] }, CISTERN_TUNNEL_MAX);
    if (plan === null || !keepOffWhole(w, plan)) continue;
    const kept = cisternKeepOff(w, plan);
    if ([...planned].some((t) => kept.has(t))) continue;
    // Nor the gate's stair nor the mine's shaft, whose stairs come later.
    const shafts = [[cx + 6, cy + 6], [cx + 6, Math.min(w.map.h - 3, cy + 15)]] as const;
    let crossed = false;
    for (const [sx, sy] of shafts) for (let z = plan.cisternZ; z <= hallZ; z += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (kept.has(w.index(sx + dx, sy + dy, z))) crossed = true;
    }
    if (crossed) continue;
    if (best === null || plan.tunnel.length < best.plan.tunnel.length) {
      best = cisternWork(plan, w.index(cx + corner.lever[0], cy + corner.lever[1], hallZ), CISTERN_PRIORITY);
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
  const mechanisms = CISTERN_MECHANISMS - (work.steps.has('lever') ? 1 : 0) - (work.steps.has('link') ? 1 : 0) - (work.steps.has('well') ? 1 : 0);
  order(built('mechanic'), 'make_mechanism', mechanisms - items.available('mechanism'));
  if (!work.steps.has('floodgate')) order(built('mason'), 'make_floodgate', 1 - items.available('floodgate'));
  if (!work.steps.has('well')) {
    if (items.available('chain') + items.available('rope') === 0) order(built('forge'), 'forge_chain', 1, { materialFilter: 'iron' });
    if (items.available('bucket') === 0) order(built('carpenter'), 'make_bucket', 1);
  }
}

/**
 * The cistern's look: planned on the first one, its work ordered from `CISTERN_DAY` until the well
 * stands over water. Called with the rooms (`checkFortressRooms`) and, while the floodgate is to
 * be opened and shut, every watch (`playThreeYears`), as a player keeps an eye on the lever.
 */
export function keepWaterInside(w: TestWorld, state: FortressState): void {
  if (state.waterInside === false) return;
  if (state.cistern === undefined) {
    state.cistern = planFortressCistern(w, state);
    const work = state.cistern;
    if (work === null) {
      note('three_years_cistern', { day: Math.floor(w.tick / TICKS_PER_DAY) + 1, plan: 'none' });
      return;
    }
    const kept = cisternKeepOff(w, work.plan);
    keepOff(w, (t) => kept.has(t));
    note('three_years_cistern', { day: Math.floor(w.tick / TICKS_PER_DAY) + 1, plan: 'planned', tunnel: work.plan.tunnel.length, brookZ: work.plan.bz,
      well: [work.plan.w.x, work.plan.w.y], feed: [work.plan.s.x, work.plan.s.y] });
    return;
  }
  const work = state.cistern;
  if (work === null || w.tick < CISTERN_DAY * TICKS_PER_DAY) return;
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
