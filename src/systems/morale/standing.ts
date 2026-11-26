/** `15` § Standing thoughts; condition values come from the authored thought table. */
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import type { DwarvesReader } from '@systems/dwarves';
import { CRITICAL } from '@systems/dwarves/needs';
import type { ItemsReader } from '@systems/items';
import { baseValue, type ThoughtDef } from './thoughts';

export const NEED_PRESSURE_THOUGHTS: ReadonlySet<string> = new Set(['hungry', 'thirsty', 'tired', 'lonely']);

/**
 * T-767: how far past its want threshold a survival need must be before its pressure lowers the
 * needs-met floor (15 § Mood): halfway to its critical threshold (10 § Needs). Below that it is the
 * ordinary daily cycle (an evening's tiredness, thirst on the way to a drink) and the floor holds
 * at 20; `lonely` has no critical threshold and always counts.
 */
export const FLOOR_MARGIN_SHARE = 0.5;

const NEEDS = [
  ['hungry', 'hunger', 50, 5, 10], ['thirsty', 'thirst', 50, 5, 10], ['tired', 'rest', 60, 5, 8],
  ['lonely', 'social', 50, 10, 5], ['uncomfortable', 'comfort', 55, 10, 4],
  ['restless', 'purpose', 60, 10, 4], ['bored', 'joy', 60, 10, 4],
] as const;

/** A standing thought; `withinMargin` marks need pressure that leaves the needs-met floor at 20 (T-767). */
export interface StandingThought { readonly id: string; readonly value: number; readonly withinMargin?: true }

export function standingThoughts(id: EntityId, ctx: TickContext, floorSleepers: ReadonlySet<EntityId>, defs: ReadonlyMap<string, ThoughtDef>): StandingThought[] {
  const entities = ctx.world.entities;
  const dwarves = ctx.readers.of<DwarvesReader>('10');
  const buildings = ctx.readers.of<BuildingsReader>('14');
  const items = ctx.readers.of<ItemsReader>('13');
  const result: StandingThought[] = [];
  const add = (name: string, value: number, withinMargin = false): void => { if (defs.has(name) && value !== 0) result.push(withinMargin ? { id: name, value, withinMargin } : { id: name, value }); };
  const needs = entities.get(id, C.Needs);
  // A soldier on duty (a squad in training or active, or any squad under an alert) has something to do: no `restless`.
  const onDuty = ctx.readers.has('16') && ctx.readers.of<CombatReader>('16').onDuty(id);
  if (needs !== undefined) for (const [name, need, threshold, divisor, limit] of NEEDS) {
    if (name === 'restless' && onDuty) continue;
    if (needs[need] < threshold) continue;
    const critical = CRITICAL[need];
    add(name, -Math.min(limit, (needs[need] - threshold) / divisor), critical !== undefined && needs[need] < threshold + (critical - threshold) * FLOOR_MARGIN_SHARE);
  }
  if (ctx.tick >= 14 * TICKS_PER_DAY && buildings.bedroomOf(id) === 0) add('no_bedroom', -2);
  if (dwarves.isUnclothed(id)) add('unclothed', -3);
  // T-572: the row is 0 (no thought): the floor's thought is `slept_on_floor`, as a pallet's and a bed's are.
  if (floorSleepers.has(id)) { const def = defs.get('slept_on_floor_last_night'); if (def !== undefined) add('slept_on_floor_last_night', baseValue(def)); }
  const body = entities.get(id, C.Body);
  if (body !== undefined && body.pain >= 20) add('in_pain', -Math.min(8, body.pain / 10));
  if (entities.get(id, C.Patient)?.bedId) add('bedridden', -6);
  const thane = dwarves.holder('thane');
  if (thane !== 0) {
    const bedroom = buildings.bedroomOf(thane);
    const tier = bedroom === 0 ? 0 : (buildings.room(bedroom)?.tier ?? 0);
    if (tier >= 4) add('thane_hall_grand', 2);
    else if (tier <= 1) add('thane_hall_bare', -1);
  }
  if (items.unburiedDead(ctx.tick)) add('unburied_dead', baseValue(defs.get('unburied_dead') as ThoughtDef));
  const position = entities.get(id, C.Position);
  if (position !== undefined && items.isMiasma(ctx.world.map.index(position.x, position.y, position.z))) add('in_miasma', baseValue(defs.get('in_miasma') as ThoughtDef));
  return result;
}
