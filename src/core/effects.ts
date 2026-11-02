/**
 * Timed effects on a creature (`02-systems/25-runecraft.md` § Effects): the `Spellbound`
 * component holds them, 25 adds them and drops the expired ones hourly, and every reader compares
 * `until` with the tick, so expiry needs no tick of its own.
 */

import { C, type ComponentType, type Spellbound } from './components';
import type { EntityId, Tick } from './types';

interface EffectStore {
  get<T>(id: EntityId, type: ComponentType<T>): T | undefined;
}

/** The largest value among the unexpired effects of `kind` on `id`; 0 when there is none. */
export function effectValue(entities: EffectStore, id: EntityId, kind: string, tick: Tick): number {
  const bound = entities.get<Spellbound>(id, C.Spellbound);
  if (bound === undefined) return 0;
  let best = 0;
  for (const effect of bound.effects) {
    if (effect.kind === kind && effect.until > tick && effect.value > best) best = effect.value;
  }
  return best;
}

/**
 * An attack's or a drink's wait under `haste` (25 § Effects): `× 100 / (100 + haste)`, rounded
 * down, at least 1. With no haste the ticks are returned as they are.
 */
export function hastedTicks(entities: EffectStore, id: EntityId, ticks: number, tick: Tick): number {
  const haste = effectValue(entities, id, 'haste', tick);
  if (haste <= 0) return ticks;
  return Math.max(1, Math.floor((ticks * 100) / (100 + haste)));
}

/**
 * Under `fire_immune` (25 § Effects) a hit whose wound would be a burn (`ember`, or the wyrm's
 * `burn`) does nothing.
 */
export function immuneToBurn(entities: EffectStore, id: EntityId, damageType: string, tick: Tick): boolean {
  return (damageType === 'ember' || damageType === 'burn') && effectValue(entities, id, 'fire_immune', tick) > 0;
}

/**
 * A step's effort under `slow` and `haste` (25 § Effects): `× (100 − slow + haste) / 100`, never
 * below 1 when there was effort to scale.
 */
export function effortUnderEffects(entities: EffectStore, id: EntityId, effort: number, tick: Tick): number {
  const percent = 100 - effectValue(entities, id, 'slow', tick) + effectValue(entities, id, 'haste', tick);
  if (percent === 100 || effort <= 0) return effort;
  return Math.max(1, Math.trunc((effort * Math.max(0, percent)) / 100));
}
