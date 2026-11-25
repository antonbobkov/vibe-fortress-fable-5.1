/**
 * The activity line of a creature's view (`ui-screens/fortress-screen.md` § Inspection panel): for
 * any creature in a cage or unconscious, that ("Caged", "Unconscious on the stairs"), over whatever
 * it was doing; a dwarf's activity as 10 gives it; for any other creature, what its behaviour is: a wild or hostile
 * creature's state ("Grazing", "Asleep", "Hunting"), a tame animal's place ("Following Ketil
 * Ironvein", "Keeping to Pasture #1", "Curled up in the pets' heap"). Never empty.
 */

import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import { CONDITION_MAX } from '@systems/animals';
import { capitalize, zoneName } from '../messages';
import type { Strings } from '../strings';
import { activityLabel } from './units';
import { stateWords } from './units-all';

interface ActivityContext {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  readonly strings: Strings;
}

/** Whether the creature is walking a path now. */
function walking(readers: ReaderSet, id: EntityId): boolean {
  return (readers.entities.get(id, C.Motion)?.pathId ?? 0) !== 0;
}

/** A creature's behaviour in words, when 10 gives it no activity. */
function behaviour(ctx: ActivityContext, id: EntityId): string {
  const { readers, strings } = ctx;
  const e = readers.entities;
  const state = e.get(id, C.Wild)?.state ?? e.get(id, C.Hostile)?.behaviorState ?? '';
  if (state !== '') return capitalize(stateWords(strings, state));
  const tame = e.get(id, C.Tame);
  if (tame !== undefined) {
    if (tame.curled === true) return strings.get('ui.look.creature.curled');
    if (tame.condition >= CONDITION_MAX) return strings.get('ui.look.creature.starving');
    if (tame.slaughter) return strings.get('ui.look.creature.slaughter');
    const followed = tame.assignedTo !== 0 && e.alive(tame.assignedTo) ? e.get(tame.assignedTo, C.Creature)?.name : undefined;
    if (followed !== undefined && followed !== '') return strings.get('ui.look.creature.following', { name: followed });
    const pasture = tame.pastureId !== 0 ? zoneName({ readers, strings }, tame.pastureId) : '';
    if (pasture !== '') return strings.get('ui.look.creature.pasture', { pasture });
  }
  return strings.get(walking(readers, id) ? 'ui.look.creature.wandering' : 'ui.look.creature.standing');
}

/** The words after `Activity:` in a creature's view; never empty. */
export function creatureActivity(ctx: ActivityContext, id: EntityId): string {
  const words = activityLabel(ctx, id);
  return words !== '' ? words : behaviour(ctx, id);
}
