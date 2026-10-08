/**
 * The side effects of a dwarf entering a tile: `02-systems/10-dwarves.md` § Movement ("A dwarf
 * entering a misty tile emits `DwarfFeltMist` (once per `MIST_THOUGHT_COOLDOWN`); entering an
 * outdoor tile during rain, storm, snow, heatwave or cold snap emits `DwarfOutdoorsIn { weather }`
 * once per hour") and `algorithms/creature-brains.md` § Dwarf brain ("warm spring adjacency →
 * `DwarfNearSpring`"). The thought consumers are 15's (M4); the events fire now. docs/archive/decisions-archive.md D-102.
 */

import { TICKS_PER_HOUR } from '@core/constants';
import type { Brain } from '@core/components';
import type { GameEvent } from '@core/events';
import type { EntityId, TileIndex } from '@core/types';
import { MIST_THOUGHT_COOLDOWN } from './constants';

/** The weather states in which being outdoors is an event (`10` § Movement). */
export const OUTDOOR_WEATHER: readonly string[] = ['rain', 'storm', 'snow', 'heatwave', 'cold_snap'];

export interface MoveFacts {
  isMisty(i: TileIndex): boolean;
  /** A warm spring on the tile or one of its eight neighbours on the level. */
  nearSpring(i: TileIndex): boolean;
  isOutdoor(i: TileIndex): boolean;
  /** 06's state, or null without a weather system. */
  weather(): string | null;
}

/**
 * The events of one move and the brain after it (the same object when nothing changed). A mist
 * cooldown counts from the last `DwarfFeltMist` (`lastMistTick`, 0 meaning never); the outdoor
 * event fires once per game hour (`lastOutdoorThoughtHour`, the hour index `tick / TICKS_PER_HOUR`);
 * `DwarfNearSpring` fires on stepping into a spring's neighbourhood from outside it.
 */
export function movementEffects(
  id: EntityId,
  from: TileIndex,
  to: TileIndex,
  tick: number,
  brain: Brain,
  facts: MoveFacts,
  emit: (event: GameEvent) => void,
): Brain {
  let next = brain;
  if (facts.isMisty(to) && (brain.lastMistTick === 0 || tick - brain.lastMistTick >= MIST_THOUGHT_COOLDOWN)) {
    emit({ type: 'DwarfFeltMist', id });
    next = { ...next, lastMistTick: tick };
  }
  if (facts.nearSpring(to) && (from < 0 || !facts.nearSpring(from))) emit({ type: 'DwarfNearSpring', id });
  const weather = facts.weather();
  const hour = Math.floor(tick / TICKS_PER_HOUR);
  if (weather !== null && OUTDOOR_WEATHER.includes(weather) && facts.isOutdoor(to) && brain.lastOutdoorThoughtHour !== hour) {
    emit({ type: 'DwarfOutdoorsIn', id, weather });
    next = { ...next, lastOutdoorThoughtHour: hour };
  }
  return next;
}
