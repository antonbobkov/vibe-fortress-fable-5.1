/** `15` § Standing thoughts; condition values come from the authored thought table. */
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import { baseValue, type ThoughtDef } from './thoughts';

export const NEED_PRESSURE_THOUGHTS: ReadonlySet<string> = new Set(['hungry', 'thirsty', 'tired', 'lonely']);

const NEEDS = [
  ['hungry', 'hunger', 50, 5, 10], ['thirsty', 'thirst', 50, 5, 10], ['tired', 'rest', 60, 5, 8],
  ['lonely', 'social', 50, 10, 5], ['uncomfortable', 'comfort', 55, 10, 4],
  ['restless', 'purpose', 60, 10, 4], ['bored', 'joy', 60, 10, 4],
] as const;

export function standingThoughts(id: EntityId, ctx: TickContext, floorSleepers: ReadonlySet<EntityId>, defs: ReadonlyMap<string, ThoughtDef>): { id: string; value: number }[] {
  const entities = ctx.world.entities;
  const dwarves = ctx.readers.of<DwarvesReader>('10');
  const buildings = ctx.readers.of<BuildingsReader>('14');
  const items = ctx.readers.of<ItemsReader>('13');
  const result: { id: string; value: number }[] = [];
  const add = (name: string, value: number): void => { if (defs.has(name) && value !== 0) result.push({ id: name, value }); };
  const needs = entities.get(id, C.Needs);
  if (needs !== undefined) for (const [name, need, threshold, divisor, limit] of NEEDS) {
    if (needs[need] >= threshold) add(name, -Math.min(limit, (needs[need] - threshold) / divisor));
  }
  if (ctx.tick >= 14 * TICKS_PER_DAY && buildings.bedroomOf(id) === 0) add('no_bedroom', -2);
  if (dwarves.isUnclothed(id)) add('unclothed', -3);
  if (floorSleepers.has(id)) add('slept_on_floor_last_night', -3);
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
