/**
 * Why a container building's goods (the wagon's, 02 § Arrival) still wait in it (24 § Building panel, T-681): the
 * goods it holds that want hauling, counted by reason from 13's hauling state (`items.haulState`) and 11's haul jobs.
 *
 * - `no_stockpile`: no stockpile accepts them (the categories are named, so the player knows which to place);
 * - `full`: the stockpiles that accept them have no room;
 * - `container`: they wait for a wanted barrel, bag or bin;
 * - `no_hauler`: nobody has Hauling on;
 * - `unreachable`: their haul is blocked for want of a path;
 * - `hauling`: their haul is open, taken or about to be made.
 *
 * Goods count in units, as the panel's `Holds` lines do (a barrel counts the drink in it). Presentation only.
 */

import type { ReaderSet } from '@core/readers';
import type { EntityId } from '@core/types';
import { CATEGORY_TREE, type HaulState, type ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { Strings } from './strings';

export type GoodsWaitReason = 'no_stockpile' | 'full' | 'container' | 'no_hauler' | 'unreachable' | 'hauling';

/** The reasons in the order the line gives them. */
export const GOODS_WAIT_REASONS: readonly GoodsWaitReason[] = ['no_stockpile', 'full', 'container', 'no_hauler', 'unreachable', 'hauling'];

export interface GoodsWait {
  /** Units waiting, by reason. */
  readonly counts: ReadonlyMap<GoodsWaitReason, number>;
  /** The top categories of the goods no stockpile accepts, in the stocks tree's order. */
  readonly categories: readonly string[];
  readonly total: number;
}

/** The goods a building holds (its own container, and the item it is built from when that holds some), by reason. */
export function goodsWaiting(readers: ReaderSet, building: EntityId, itemId = 0): GoodsWait | null {
  if (!readers.has('13')) return null;
  const items = readers.of<ItemsReader>('13');
  const jobs = readers.has('11') ? readers.of<JobsReader>('11') : null;
  const noHauler = jobs !== null && jobs.workersWithLabor('hauling').length === 0;
  const counts = new Map<GoodsWaitReason, number>();
  const categories = new Set<string>();
  let total = 0;
  const reasonOf = (id: EntityId, state: HaulState): GoodsWaitReason | null => {
    switch (state) {
      case 'no_stockpile': case 'full': case 'container': return state;
      case 'job': {
        const job = jobs?.byKey(`haul:${id}`) ?? jobs?.byKey(`dump:${id}`);
        if (job?.state === 'blocked' && job.blockedReason === 'unreachable') return 'unreachable';
        if (noHauler || (job?.state === 'blocked' && job.blockedReason === 'no_worker')) return 'no_hauler';
        return 'hauling';
      }
      case 'wants': return noHauler ? 'no_hauler' : 'hauling';
      case 'none': return null;
    }
  };
  const top = (id: EntityId): string => items.itemCategory(id).split('/')[0] ?? '';
  for (const id of [...items.inContainer(building), ...(itemId === 0 ? [] : items.inContainer(itemId))]) {
    const it = items.get(id);
    if (it === undefined) continue;
    const inside = items.inContainer(id).filter((g) => items.get(g) !== undefined);
    const units = inside.length === 0 ? it.count : inside.reduce((n, g) => n + (items.get(g)?.count ?? 0), 0);
    let state = items.haulState(id);
    let subject = id;
    // A container with no home whose goods go by their stack (drink to a stockpile's barrels): the goods' state says it.
    if (state === 'no_stockpile' || state === 'full') {
      const moving = inside.find((g) => ['job', 'wants', 'container'].includes(items.haulState(g)));
      if (moving !== undefined) {
        subject = moving;
        state = items.haulState(moving);
      }
    }
    const reason = reasonOf(subject, state);
    if (reason === null) continue;
    counts.set(reason, (counts.get(reason) ?? 0) + units);
    total += units;
    if (reason === 'no_stockpile') categories.add(top(inside[0] ?? id));
  }
  if (total === 0) return null;
  const rank = (c: string): number => {
    const k = CATEGORY_TREE.indexOf(c);
    return k < 0 ? CATEGORY_TREE.length : k;
  };
  return { counts, total, categories: [...categories].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0)) };
}

/**
 * "12 goods wait: 8 have no stockpile that takes them (drink, tools), 4 wait for room" for the panel, or the short
 * form for the hover line ("12 goods wait: 8 no stockpile, 4 no room"); '' when nothing waits.
 */
export function goodsWaitText(strings: Strings, wait: GoodsWait | null, short: boolean): string {
  if (wait === null) return '';
  const parts: string[] = [];
  for (const reason of GOODS_WAIT_REASONS) {
    const n = wait.counts.get(reason) ?? 0;
    if (n === 0) continue;
    const key = `ui.goods_wait.${reason}${short ? '_short' : ''}`;
    parts.push(strings.get(key, { n, categories: wait.categories.join(', ') }));
  }
  return strings.get('ui.goods_wait.line', { n: wait.total, reasons: parts.join(', ') });
}
