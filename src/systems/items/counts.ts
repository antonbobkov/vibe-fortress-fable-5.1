/**
 * Stock counts: `02-systems/13-items-and-storage.md` § Stock counts and the stocks panel.
 *
 * ```
 * counts: Map<typeIndex, { total, byMaterialClass, byQuality, available (not forbidden, not reserved, not owned) }>
 * ```
 *
 * Maintained incrementally: every change to an item subtracts its old contribution and adds its
 * new one, and marks the type dirty for the batched `StocksChanged`. Counts are in units (a stack
 * of 25 bolts counts 25). A recount from the entities must always equal the incremental counts
 * (property `item accounting`).
 */

import { ItemFlag } from '@core/components';
import type { StockCountV1 } from './state';
import { sortedInsert } from './state';

/** What one item adds to the counts. */
export interface Contribution {
  readonly type: number;
  readonly units: number;
  readonly materialClass: string;
  readonly quality: number;
  readonly available: boolean;
}

const UNAVAILABLE = ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned;

/** Whether an item's flags leave it available (13: "not forbidden, not reserved, not owned"). */
export function isAvailable(flags: number): boolean {
  return (flags & UNAVAILABLE) === 0;
}

interface Count {
  total: number;
  available: number;
  byClass: Map<string, number>;
  byQuality: number[];
}

function emptyCount(): Count {
  return { total: 0, available: 0, byClass: new Map(), byQuality: [0, 0, 0, 0, 0, 0] };
}

export class StockCounts {
  private readonly counts = new Map<number, Count>();
  /** Types changed since the last flush, ascending. */
  readonly dirty: number[] = [];

  add(c: Contribution, sign: 1 | -1): void {
    let count = this.counts.get(c.type);
    if (count === undefined) {
      count = emptyCount();
      this.counts.set(c.type, count);
    }
    const n = c.units * sign;
    count.total += n;
    if (c.available) count.available += n;
    const cls = (count.byClass.get(c.materialClass) ?? 0) + n;
    if (cls === 0) count.byClass.delete(c.materialClass);
    else count.byClass.set(c.materialClass, cls);
    const q = Math.max(0, Math.min(5, c.quality));
    count.byQuality[q] = (count.byQuality[q] as number) + n;
    if (count.total === 0) this.counts.delete(c.type);
    sortedInsert(this.dirty, c.type);
  }

  total(type: number): number {
    return this.counts.get(type)?.total ?? 0;
  }

  available(type: number): number {
    return this.counts.get(type)?.available ?? 0;
  }

  byClass(type: number, materialClass: string): number {
    return this.counts.get(type)?.byClass.get(materialClass) ?? 0;
  }

  byQuality(type: number): readonly number[] {
    return (this.counts.get(type)?.byQuality ?? [0, 0, 0, 0, 0, 0]).slice();
  }

  /** The types with a non-zero count, ascending. */
  types(): number[] {
    return Array.from(this.counts.keys()).sort((a, b) => a - b);
  }

  /** Take and clear the dirty list. */
  takeDirty(): number[] {
    const out = this.dirty.slice();
    this.dirty.length = 0;
    return out;
  }

  serialize(): [number, StockCountV1][] {
    return this.types().map((t) => {
      const c = this.counts.get(t) as Count;
      const byClass = Array.from(c.byClass.keys())
        .sort()
        .map((k): [string, number] => [k, c.byClass.get(k) as number]);
      return [t, { total: c.total, available: c.available, byClass, byQuality: c.byQuality.slice() }];
    });
  }

  deserialize(rows: readonly [number, StockCountV1][]): void {
    this.counts.clear();
    for (const [t, c] of rows) {
      this.counts.set(t, {
        total: c.total,
        available: c.available,
        byClass: new Map(c.byClass.map(([k, v]) => [k, v])),
        byQuality: c.byQuality.slice(),
      });
    }
  }

  clear(): void {
    this.counts.clear();
    this.dirty.length = 0;
  }
}
