/**
 * An animal's sections in its view (08's `creature › animal`, `ui-screens/fortress-screen.md` §
 * Inspection panel): species, state, owner, pasture, condition and training, each a dim label and
 * a value, in the Animals panel's words. A tame animal has `Species`, `State` (tame, young, pregnant,
 * marked for slaughter), `Owner` (the dwarf whose pet it is, else the fortress), `With` (the dwarf it
 * is assigned to), a grazer's `Pasture` and `Hunger` (08's condition, with the Animals panel's
 * words for it), and `Training`; a wild one `Species`, `State` (wild, dangerous, hungry) and `Hunted`.
 */

import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import type { AnimalsReader } from '@systems/animals';
import type { ForagingReader } from '@systems/foraging';
import { zoneName } from '../messages';
import type { Strings } from '../strings';
import { fedLevel, trainStatus } from './animals';
import type { Span } from './look-links';

/** One row of the animal's sections: its label's key, its value, and how it is drawn. */
export interface AnimalField {
  readonly name: AnimalFieldName;
  readonly value: readonly Span[];
  /** `alert` for a hungry grazer, `bad` for a starving one; the line's colour otherwise. */
  readonly tone: 'text' | 'alert' | 'bad';
}

/** Every label of the sections, in their order; `ui.look.animal.field.<name>`. */
export const ANIMAL_FIELDS = ['species', 'state', 'owner', 'with', 'pasture', 'hunger', 'training', 'hunted'] as const;
export type AnimalFieldName = (typeof ANIMAL_FIELDS)[number];

interface AnimalContext {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  readonly strings: Strings;
}

/** Whether Look draws the creature's view with the animal sections: a tame or a wild animal. */
export function isAnimal(readers: ReaderSet, id: EntityId): boolean {
  return readers.has('08') && (readers.entities.has(id, C.Tame) || readers.entities.has(id, C.Wild));
}

/** A creature by its name, a link to its view; none when it is gone. */
function creatureSpan(readers: ReaderSet, id: EntityId): Span[] | null {
  if (id === 0 || !readers.entities.alive(id)) return null;
  const name = readers.entities.get(id, C.Creature)?.name ?? '';
  return name === '' ? null : [{ text: name, target: { kind: 'creature', id } }];
}

/** The rows of an animal's sections, in the inspector list's order; none for a creature that is not an animal. */
export function animalFields(ctx: AnimalContext, id: EntityId): AnimalField[] {
  const { readers, strings } = ctx;
  if (!isAnimal(readers, id)) return [];
  const r = readers.of<AnimalsReader>('08');
  const species = readers.entities.get(id, C.Creature)?.species ?? 0;
  const def = r.def(species);
  const out: AnimalField[] = [];
  const row = (name: AnimalFieldName, value: readonly Span[], tone: AnimalField['tone'] = 'text'): void => { out.push({ name, value, tone }); };
  const text = (value: string): Span[] => [{ text: value }];
  row('species', text(def?.name ?? ''));
  const tame = readers.entities.get(id, C.Tame);
  if (tame === undefined) {
    const wild = readers.entities.get(id, C.Wild);
    const state = [strings.get('ui.look.animal.wild')];
    if (r.isDangerous(species)) state.push(strings.get('ui.look.animal.dangerous'));
    if (wild?.hungry === true) state.push(strings.get('ui.look.animal.hungry'));
    row('state', text(state.join(', ')));
    if (readers.has('09')) row('hunted', text(strings.get(readers.of<ForagingReader>('09').isHuntable(species) ? 'ui.animals.hunt_on' : 'ui.animals.hunt_off')));
    return out;
  }
  const now = readers.calendar.tick;
  const state = [strings.get('ui.look.animal.tame')];
  if (tame.juvenileUntil > now) state.push(strings.get('ui.look.animal.young'));
  if (tame.pregnantUntil > now) state.push(strings.get('ui.animals.detail.pregnant'));
  if (tame.slaughter) state.push(strings.get('ui.animals.detail.slaughter'));
  row('state', text(state.join(', ')));
  row('owner', creatureSpan(readers, tame.petOf) ?? text(strings.get('ui.look.animal.fortress')));
  const assigned = creatureSpan(readers, tame.assignedTo);
  if (assigned !== null) row('with', assigned);
  const fed = fedLevel(r, id, species);
  if (fed !== null) {
    // A grazer: its pasture, a link to the zone, and how fed it is (08's condition, hunger 0 to 100).
    const pasture = r.pastureOf(id);
    row('pasture', pasture === 0 ? text(strings.get('ui.look.pasture.none')) : [{ text: zoneName(ctx, pasture), target: { kind: 'zone', id: pasture } }]);
    const words = strings.get('ui.look.animal.hunger', { hunger: Math.round(r.condition(id)), fed: strings.get(`ui.animals.fed.${fed}`) });
    row('hunger', text(words), fed === 0 ? 'bad' : fed === 1 ? 'alert' : 'text');
  }
  const trainable = def?.trainable ?? def?.flags['trainable'];
  const status = trainStatus(ctx, id, tame.trained);
  const training = status === strings.get('ui.animals.training') ? 'ui.animals.detail.training'
    : tame.trained === 'war' ? 'ui.animals.detail.trained_war'
      : tame.trained === 'hunting' ? 'ui.animals.detail.trained_hunting'
        : typeof trainable === 'string' && trainable !== 'none' ? 'ui.look.animal.untrained' : 'ui.look.animal.untrainable';
  row('training', text(strings.get(training)));
  return out;
}
