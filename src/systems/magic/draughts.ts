/**
 * Draughts: `02-systems/25-runecraft.md` § Draughts, rows in `03-content/items.md` § Draughts.
 *
 * One draught, then rest: a creature that drank one takes no other for `DRAUGHT_REST_DAYS`, and a
 * calming draught keeps its own longer rest, `CALM_REST_DAYS`. Both ticks live on `Spellbound`
 * (most soldiers have no `Rune`), which stays while either rest lasts. Soldiers drink on the events
 * of § Draughts, never on a scan; a medic gives one through the `give_draught` job. Drinking takes
 * no time and draws nothing.
 */

import { C, type ActiveEffect, type Spellbound } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { TickContext } from '@core/system';
import type { EntityId, Tick } from '@core/types';
import { QUALITY_COMBAT_MULT } from '@systems/combat/constants';
import type { ItemsReader } from '@systems/items';
import { DRAUGHT_REST_DAYS, DRAUGHT_TICKS } from './constants';
import { calmRestLasts, draughtRestLasts } from './cast';

/** When a draught is drunk (`items.md` § Draughts). */
export type DraughtTrigger = 'wounded' | 'raid' | 'miserable' | 'never';

/** A row of the `draughts` table: its id is the draught's item id. */
export interface DraughtDef {
  readonly id: string;
  readonly effects: readonly { readonly kind: string; readonly value: number }[];
  readonly trigger: DraughtTrigger;
}

/** A trigger a soldier drinks on, so a squad may list its draught; the others are a medic's or never. */
export function soldierTrigger(trigger: string | undefined): boolean {
  return trigger !== undefined && trigger !== 'never' && trigger !== 'miserable';
}

/** The draught row of an item type, or undefined for an item that is no draught. */
export function draughtOf(registry: Registry, itemType: number): DraughtDef | undefined {
  const itemId = registry.table<{ id: string }>('items').byIndex(itemType)?.id;
  return itemId === undefined ? undefined : registry.table<DraughtDef>('draughts').byId(itemId);
}

/** The draught rows with a trigger, in table order. */
export function draughtsWith(registry: Registry, trigger: DraughtTrigger): DraughtDef[] {
  return registry.table<DraughtDef>('draughts').rows.filter((row): row is DraughtDef => row !== undefined && row.trigger === trigger);
}

/** The creature may take a draught now: no draught within `DRAUGHT_REST_DAYS`. */
export function draughtRestAllows(entities: EntityStore, id: EntityId, tick: Tick): boolean {
  const last = entities.get(id, C.Spellbound)?.lastDraughtTick;
  return last === undefined || !draughtRestLasts(last, tick);
}

/** No calming draught within `CALM_REST_DAYS`. */
export function calmRestAllows(entities: EntityStore, id: EntityId, tick: Tick): boolean {
  const last = entities.get(id, C.Spellbound)?.lastCalmTick;
  return last === undefined || !calmRestLasts(last, tick);
}

/** Ticks until the creature may take a draught again; 0 when it may now. */
export function draughtRestLeft(entities: EntityStore, id: EntityId, tick: Tick): number {
  const last = entities.get(id, C.Spellbound)?.lastDraughtTick;
  return last === undefined ? 0 : Math.max(0, last + DRAUGHT_REST_DAYS * TICKS_PER_DAY - tick);
}

/**
 * Drink a draught item: one unit is consumed, its effects land (timed effects for
 * `DRAUGHT_TICKS × QUALITY_COMBAT_MULT[quality]`; `mend` as the Mend spell; `ease` the thought,
 * through `DraughtDrunk`), the rests start and `DraughtDrunk` is emitted. False, and nothing
 * happens, when the item is no draught that is ever drunk or the rest does not allow it.
 * `giverId` is the medic who gave it, or 0.
 */
export function drinkDraught(ctx: TickContext, drinkerId: EntityId, itemId: EntityId, giverId: EntityId = 0): boolean {
  const entities = ctx.world.entities;
  const item = entities.get(itemId, C.Item);
  const items = ctx.world.services.items;
  if (item === undefined || item.count <= 0 || items === null || !entities.alive(drinkerId)) return false;
  const row = draughtOf(ctx.registry, item.type);
  if (row === undefined || row.trigger === 'never' || !draughtRestAllows(entities, drinkerId, ctx.tick)) return false;
  const until = ctx.tick + Math.round(DRAUGHT_TICKS * (QUALITY_COMBAT_MULT[item.quality] ?? 1));
  const bound: Spellbound | undefined = entities.get(drinkerId, C.Spellbound);
  const effects: ActiveEffect[] = bound === undefined ? [] : bound.effects.slice();
  let calm = false;
  let mend = false;
  for (const effect of row.effects) {
    if (effect.kind === 'mend') mend = true;
    else if (effect.kind === 'ease') calm = true;
    else effects.push({ kind: effect.kind, value: effect.value, until, sourceId: drinkerId });
  }
  items.consume(itemId, 1);
  entities.add<Spellbound>(drinkerId, C.Spellbound, {
    ...(bound ?? {}),
    effects,
    lastDraughtTick: ctx.tick,
    ...(calm ? { lastCalmTick: ctx.tick } : {}),
  });
  if (mend) ctx.emit({ type: 'Mended', id: drinkerId, casterId: giverId });
  ctx.emit({ type: 'DraughtDrunk', id: drinkerId, draughtId: row.id, calm });
  return true;
}

/**
 * § Draughts, triggers: a soldier on duty whose squad lists draughts drinks the first listed one
 * whose trigger fired and which it carries, if its rest allows. True when it drank.
 */
export function soldierDrinks(ctx: TickContext, soldierId: EntityId, trigger: DraughtTrigger): boolean {
  const entities = ctx.world.entities;
  const soldier = entities.get(soldierId, C.Soldier);
  if (soldier === undefined || !soldier.onDuty || !entities.alive(soldierId)) return false;
  const list = entities.get(soldier.squadId, C.Squad)?.equipment.draughts;
  if (list === undefined || list.length === 0 || !draughtRestAllows(entities, soldierId, ctx.tick)) return false;
  if (!ctx.readers.has('13')) return false;
  const carried = ctx.readers.of<ItemsReader>('13').carriedItems(soldierId);
  const draughts = ctx.registry.table<DraughtDef>('draughts');
  const itemTable = ctx.registry.table<{ id: string }>('items');
  for (const draughtId of list) {
    if (draughts.byId(draughtId)?.trigger !== trigger || !itemTable.has(draughtId)) continue;
    const type = itemTable.index(draughtId);
    const held = carried.find((id) => {
      const it = entities.get(id, C.Item);
      return it !== undefined && it.type === type && it.count > 0;
    });
    if (held !== undefined) return drinkDraught(ctx, soldierId, held);
  }
  return false;
}

/** Every soldier on duty in a squad, squads and members in ascending id order. */
export function soldiersOnDuty(entities: EntityStore): EntityId[] {
  const out: EntityId[] = [];
  for (const squadId of entities.with(C.Squad).slice().sort((a, b) => a - b)) {
    const squad = entities.get(squadId, C.Squad);
    if (squad === undefined || (squad.equipment.draughts?.length ?? 0) === 0) continue;
    for (const id of squad.members) if (entities.get(id, C.Soldier)?.onDuty === true) out.push(id);
  }
  return out;
}
