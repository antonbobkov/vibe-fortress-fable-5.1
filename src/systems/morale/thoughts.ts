/** `15` § Thoughts, driven by `03-content/personality-and-thoughts.md` / `thoughts.json`. */
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { Registry } from '@core/registry';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { DwarvesReader } from '@systems/dwarves';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';

export interface ThoughtDef {
  readonly id: string;
  readonly text: string;
  readonly value: number | { readonly formula: string };
  readonly hours: number | null;
  readonly decay: 'linear' | 'halflife' | 'standing';
  readonly cap: number;
  readonly group: string;
  readonly trigger: { readonly event?: string; readonly target?: string; readonly condition?: string };
  readonly announce: boolean;
}

export interface TraitDef {
  readonly id: string;
  readonly base: number;
  readonly scales: readonly { readonly group: string; readonly mult: number }[];
}

/** Content uses a single explicit event on the first row of a family; later rows abbreviate it. */
const ALIAS_EVENT: Readonly<Record<string, EventType>> = {
  ate_in_fine_hall: 'MealEaten', ate_in_grand_hall: 'MealEaten', ate_in_royal_hall: 'MealEaten',
  slept_in_decent_room: 'Slept', slept_in_fine_room: 'Slept', slept_in_grand_room: 'Slept', slept_in_royal_room: 'Slept',
  caught_in_storm: 'DwarfOutdoorsIn', snowed_on: 'DwarfOutdoorsIn', bitter_cold: 'DwarfOutdoorsIn', sweltering: 'DwarfOutdoorsIn',
  argued: 'SulkHappened', wept: 'SulkHappened', hoarded: 'SulkHappened',
  saw_sunlight: 'EntitiesMoved', admired_statue: 'EntitiesMoved', finished_big_job: 'JobCompleted',
};

export function triggerEvent(def: ThoughtDef): EventType | null {
  if (def.decay === 'standing' || def.id === 'ate_in_bare_hall' || def.id === 'slept_in_bare_room') return null;
  return (def.trigger.event ?? ALIAS_EVENT[def.id] ?? null) as EventType | null;
}

export function baseValue(def: ThoughtDef, event?: GameEvent): number {
  if (typeof def.value === 'number') return def.value;
  if (def.id === 'healed') return 5 + 2 * Math.max(0, Number(event?.['hospitalTier'] ?? 0));
  const match = /([+\-−]\d+)/u.exec(def.value.formula);
  return match === null ? 0 : Number(match[1]?.replace('−', '-'));
}

export function personalityBase(registry: Registry, traits: readonly number[]): number {
  const table = registry.table<TraitDef>('personality');
  return traits.reduce((sum, id) => sum + (table.byIndex(id)?.base ?? 0), 0);
}

export function personalityMultiplier(registry: Registry, traits: readonly number[], def: ThoughtDef, value: number): number {
  const table = registry.table<TraitDef>('personality');
  let factor = 1;
  for (const id of traits) {
    const trait = table.byIndex(id);
    if (trait === undefined) continue;
    for (const scale of trait.scales) {
      if (scale.group === def.id || scale.group === def.group || scale.group === (value < 0 ? 'negatives' : 'positives')) factor *= scale.mult / 1000;
    }
    // `personality-and-thoughts.md` names both pace traits for both need thoughts; the compact
    // content table records the `bored` scale, so share it with `restless` here.
    if (def.id === 'restless' && (trait.id === 'patient' || trait.id === 'restless')) factor *= (trait.scales.find((s) => s.group === 'bored')?.mult ?? 1000) / 1000;
  }
  return factor;
}

const n = (event: GameEvent, key: string): number => typeof event[key] === 'number' ? event[key] as number : 0;
const s = (event: GameEvent, key: string): string => typeof event[key] === 'string' ? event[key] as string : '';
const tier = (event: GameEvent): number => n(event, 'roomTier');

/** Every authored event row has one predicate. No event row matches just because its type matches. */
export function eventPredicate(def: ThoughtDef, event: GameEvent, registry: Registry): boolean {
  if (triggerEvent(def) !== event.type) return false;
  switch (def.id) {
    case 'ate_easy_meal': return s(event, 'mealType') === 'easy_meal';
    case 'ate_fine_meal': return s(event, 'mealType') === 'fine_meal';
    case 'ate_lavish_meal': return s(event, 'mealType') === 'lavish_meal';
    case 'ate_raw_food': return s(event, 'kind') === 'raw';
    case 'ate_stale_food': return n(event, 'stage') >= 1;
    case 'ate_in_decent_hall': case 'ate_in_fine_hall': case 'ate_in_grand_hall': case 'ate_in_royal_hall': {
      const want = { ate_in_decent_hall: 2, ate_in_fine_hall: 3, ate_in_grand_hall: 4, ate_in_royal_hall: 5 }[def.id];
      return event['atTable'] === true && tier(event) === want;
    }
    case 'drank_ale': case 'drank_fine_drink': {
      const material = registry.table('materials').byIndex(n(event, 'material'))?.id ?? '';
      return def.id === 'drank_fine_drink' ? /wine|bellwine/.test(material) : /ale|beer/.test(material);
    }
    case 'drank_water': return event['outdoors'] !== true;
    case 'drank_from_puddle': return event['outdoors'] === true;
    case 'slept_in_modest_room': case 'slept_in_decent_room': case 'slept_in_fine_room': case 'slept_in_grand_room': case 'slept_in_royal_room': {
      const want = { slept_in_modest_room: 1, slept_in_decent_room: 2, slept_in_fine_room: 3, slept_in_grand_room: 4, slept_in_royal_room: 5 }[def.id];
      return event['ownBed'] === true && tier(event) === want;
    }
    case 'slept_in_shared_bed_room': return event['onFloor'] === false && event['ownBed'] === false;
    case 'slept_on_floor': return event['onFloor'] === true;
    case 'slept_outdoors': return event['outdoors'] === true;
    case 'well_rested': return n(event, 'restored') > 0;
    case 'talked_with_friend': return event['friends'] === true;
    case 'talked_with_someone': return event['friends'] !== true;
    case 'sat_in_fine_room': return tier(event) >= 3;
    case 'new_hearth_hall_tier': return n(event, 'tier') > n(event, 'oldTier') && event['roomType'] === 'hearth_hall';
    case 'made_fine_item': return n(event, 'quality') >= 3;
    case 'skill_milestone': return [5, 10, 15].includes(n(event, 'level'));
    case 'finished_big_job': return n(event, 'batchSize') >= 50 && s(event, 'jobType') === 'dig';
    case 'caught_in_rain': return s(event, 'weather') === 'rain';
    case 'caught_in_storm': return s(event, 'weather') === 'storm';
    case 'snowed_on': return s(event, 'weather') === 'snow';
    case 'bitter_cold': return s(event, 'weather') === 'cold_snap';
    case 'sweltering': return s(event, 'weather') === 'heatwave';
    case 'child_died': case 'dwarf_died': case 'friend_died':
      return n(event, 'species') === registry.table('creatures').index('dwarf');
    case 'saw_death': return s(event, 'faction') === 'fortress';
    case 'masterwork_lost': return n(event, 'quality') === 5 && n(event, 'crafterId') !== 0;
    case 'was_wounded': return ['serious', 'severe', 'critical'].includes(s(event, 'severity'));
    case 'raid_repelled': return ['repelled', 'wiped'].includes(s(event, 'outcome'));
    case 'memorial_placed': return n(event, 'coffinId') === 0;
    case 'killed_hostile': return event['hostile'] === true;
    case 'argued': return s(event, 'kind') === 'argue' && n(event, 'partnerId') !== 0;
    case 'wept': return s(event, 'kind') === 'weep' && n(event, 'targetTile') > 0;
    case 'hoarded': return s(event, 'kind') === 'hoard' && n(event, 'itemId') !== 0;
    default: return true;
  }
}

/** Resolve the event's subject to living dwarf ids; 10's relationship reader supplies friend and pet links. */
export function eventTargets(def: ThoughtDef, event: GameEvent, ctx: TickContext): EntityId[] {
  const dwarves = ctx.readers.of<DwarvesReader>('10');
  const all = dwarves.list();
  const dead = n(event, 'id') || n(event, 'dwarfId');
  if (def.id === 'dwarf_died' || def.id === 'child_died') return all.filter((id) => id !== dead);
  if (['hearth_lit', 'new_hearth_hall_tier', 'raid_arrived', 'raid_repelled', 'caravan_arrived',
    'immigrants_arrived', 'deep_stirred_dread'].includes(def.id)) return all;
  if (def.id === 'saw_death') return all.filter((id) => id !== dead);
  if (['friend_died', 'buried_friend', 'memorial_placed'].includes(def.id)) return all.filter((id) => dwarves.isFriend(id, dead));
  if (def.id === 'pet_died') return all.filter((id) => ctx.world.entities.get(id, C.Relationships)?.pets.includes(dead) === true);
  // `Relationships` has friends and spouse, not parent/child links. A friend is not family.
  if (def.id === 'came_of_age') return [];
  if (def.id === 'finished_big_job') return ctx.readers.of<JobsReader>('11').workersWithLabor('mining');
  if (def.id === 'talked_with_friend' || def.id === 'talked_with_someone') return [n(event, 'a'), n(event, 'b')].filter((id) => all.includes(id));
  if (def.id === 'argued') return [n(event, 'id'), n(event, 'partnerId')].filter((id) => all.includes(id));
  const target = def.id === 'made_masterwork' || def.id === 'made_fine_item' || def.id === 'masterwork_lost' ? n(event, 'crafterId')
    : def.id === 'first_vein' ? n(event, 'finderId')
      : def.id === 'harvest_in' ? n(event, 'farmerId')
        : def.id === 'killed_hostile' ? n(event, 'killerId')
          : def.id === 'thief_escaped_with_my_things' ? (ctx.world.entities.get(n(event, 'itemId'), C.Item)?.ownerId ?? n(event, 'ownerId')) : n(event, 'id');
  return all.includes(target) ? [target] : [];
}

/** A row's fixed condition has an existing event but may need world facts not present in the event. */
export function worldPredicate(def: ThoughtDef, event: GameEvent, ctx: TickContext, dwarf: EntityId): boolean {
  if (def.id === 'harvest_in') return true;
  if (def.id === 'saw_death') {
    const victim = ctx.world.entities.get(n(event, 'id'), C.Position);
    const witness = ctx.world.entities.get(dwarf, C.Position);
    const to = n(event, 'tile') || (victim === undefined ? -1 : ctx.world.map.index(victim.x, victim.y, victim.z));
    const from = witness === undefined ? -1 : ctx.world.map.index(witness.x, witness.y, witness.z);
    return from >= 0 && to >= 0 && ctx.world.map.zOf(from) === ctx.world.map.zOf(to)
      && Math.max(Math.abs(ctx.world.map.xOf(from) - ctx.world.map.xOf(to)), Math.abs(ctx.world.map.yOf(from) - ctx.world.map.yOf(to))) <= 8
      && ctx.readers.pathing.lineOfSight(from, to);
  }
  if (def.id === 'new_hearth_hall_tier') {
    const buildings = ctx.readers.of<BuildingsReader>('14');
    return buildings.zone(n(event, 'zoneId'))?.type === 'hearth_hall';
  }
  if (def.id === 'thane_hall_grand' || def.id === 'thane_hall_bare') return false;
  if (def.id === 'child_died') {
    const creature = ctx.world.entities.get(n(event, 'id'), C.Creature);
    return event['child'] === true || (typeof event['ageTicks'] === 'number' && event['ageTicks'] < ADULT_AGE_YEARS * TICKS_PER_YEAR) ||
      (creature !== undefined && creature.ageTicks < ADULT_AGE_YEARS * TICKS_PER_YEAR);
  }
  return true;
}
