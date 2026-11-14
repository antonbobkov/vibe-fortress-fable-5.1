/**
 * 13 § Aging in a cellar: the `cellar` stockpile setting, the daily judgement of a cellar and the
 * aging of what lies in a working one (young, aged, vintage).
 *
 * A stockpile is a working cellar when the setting is on, every tile is dark (no `lit` flag and no
 * comfort light, 14's `comfortLightAt`) and every tile's temperature (05) lies from `CELLAR_MIN_C`
 * to `CELLAR_MAX_C`. The judgement is cached on the `Stockpile` record (`cellarOk`, or the reason
 * with the temperature that broke it). On each `DayPassed` every item in a working cellar that can
 * age gains a cellar day, and a stage when its days reach its span. No rng.
 */

import { C, type Stockpile } from '@core/components';
import { DAYS_PER_YEAR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemCore } from './api';
import { CELLAR_MAX_C, CELLAR_MIN_C } from './constants';
import type { StockpileStore } from './stockpiles';

/** The barrel material tag that ages its drink in one year rather than two (`materials.md`, oak). */
export const FINE_CASK_TAG = 'fine_cask';

export interface CellarHost {
  readonly core: ItemCore;
  readonly store: StockpileStore;
  /** The tile is dark: no `lit` flag and no comfort light (14's `comfortLightAt`). */
  dark(i: TileIndex): boolean;
  /** 05's `temperatureAt`. */
  temperature(i: TileIndex): number;
  emit(event: GameEvent): void;
}

export interface CellarJudgement {
  readonly ok: boolean;
  readonly reason?: 'lit' | 'too_warm' | 'too_cold';
  readonly c?: number;
}

/** Judge a stockpile's tiles as a cellar: dark first, then the warmest tile, then the coldest. */
export function judgeCellar(host: CellarHost, tiles: readonly TileIndex[]): CellarJudgement {
  let warmest = Number.NEGATIVE_INFINITY;
  let coldest = Number.POSITIVE_INFINITY;
  for (const tile of tiles) {
    if (!host.dark(tile)) return { ok: false, reason: 'lit' };
    const c = host.temperature(tile);
    if (c > warmest) warmest = c;
    if (c < coldest) coldest = c;
  }
  if (warmest > CELLAR_MAX_C) return { ok: false, reason: 'too_warm', c: warmest };
  if (coldest < CELLAR_MIN_C) return { ok: false, reason: 'too_cold', c: coldest };
  return { ok: true };
}

/** The `Stockpile` record without its cellar fields, then with the setting and a judgement. */
export function withCellar(sp: Stockpile, on: boolean, judgement: CellarJudgement | null): Stockpile {
  const { cellar: _cellar, cellarOk: _ok, cellarReason: _reason, cellarC: _c, ...rest } = sp;
  if (!on) return rest;
  const out: Stockpile = { ...rest, cellar: true };
  if (judgement === null) return out;
  if (judgement.ok) return { ...out, cellarOk: true };
  return { ...out, ...(judgement.reason === undefined ? {} : { cellarReason: judgement.reason }),
    ...(judgement.c === undefined ? {} : { cellarC: judgement.c }) };
}

/** Judge one cellar and store the judgement; returns whether it works. */
export function rejudge(host: CellarHost, spId: EntityId): boolean {
  const sp = host.store.stockpile(spId);
  if (sp === undefined || sp.cellar !== true) return false;
  const judgement = judgeCellar(host, host.store.tilesOf(spId));
  const next = withCellar(sp, true, judgement);
  if (next.cellarOk !== sp.cellarOk || next.cellarReason !== sp.cellarReason || next.cellarC !== sp.cellarC) {
    host.core.host.entities.add(spId, C.Stockpile, next);
  }
  return judgement.ok;
}

/**
 * The days an item in a working cellar needs for its next stage, or 0 when it cannot age: a stack of
 * `drink` in a barrel of a `wood` material (a year in a `fine_cask` barrel, two in any other wood),
 * and `cheese` (a year). A drink in a pot or a metal barrel, and anything vintage, never ages.
 */
export function agingSpan(core: ItemCore, itemId: EntityId): number {
  const it = core.get(itemId);
  if (it === undefined || (it.age ?? 0) >= 2) return 0;
  const facts = core.host.facts;
  const row = facts.row(it.type);
  if (row.id === 'cheese') return DAYS_PER_YEAR;
  if (row.id !== 'drink' || it.containerId === 0) return 0;
  const barrel = core.get(it.containerId);
  if (barrel === undefined || core.container(it.containerId)?.classId !== 'barrel') return 0;
  if (facts.materialClass(barrel.material) !== 'wood') return 0;
  return facts.materialHasTag(barrel.material, FINE_CASK_TAG) ? DAYS_PER_YEAR : 2 * DAYS_PER_YEAR;
}

/** The items in a stockpile, ascending: those lying on its tiles and the contents of containers there. */
function itemsIn(host: CellarHost, spId: EntityId): EntityId[] {
  const out: EntityId[] = [];
  for (const tile of host.store.tilesOf(spId)) {
    for (const id of host.store.host.itemsOn(tile)) {
      out.push(id);
      for (const inner of host.core.container(id)?.contents ?? []) out.push(inner);
    }
  }
  return out.sort((a, b) => a - b);
}

/** `DayPassed`: judge every cellar, then age what lies in the working ones. */
export function cellarDay(host: CellarHost): void {
  for (const spId of host.store.all()) {
    if (host.store.stockpile(spId)?.cellar !== true) continue;
    if (!rejudge(host, spId)) continue;
    for (const id of itemsIn(host, spId)) {
      const span = agingSpan(host.core, id);
      if (span <= 0) continue;
      const it = host.core.get(id);
      if (it === undefined) continue;
      const days = (it.cellarDays ?? 0) + 1;
      const age = it.age ?? 0;
      if (days < span) {
        host.core.setAge(id, age, days);
        continue;
      }
      const stage = (age + 1) as 1 | 2;
      host.core.setAge(id, stage, 0);
      host.emit({ type: 'ItemAged', id, stage });
    }
  }
}
