/**
 * Raid morale and raider nerve: `02-systems/18-threats-monsters-and-raids.md` § Party AI, Morale.
 *
 * A party's morale runs from 0 to 100 and starts by purpose. Its casualties, the loss of its
 * captains, traps and its own careless archers lower it; the foes it fells and the loot it takes
 * raise it. A party breaks when it falls to `MORALE_BREAK`, when half of it is lost (the floor of
 * the same scale), or, without a captain and out of a fight, below `MORALE_BREAK_LEADERLESS`. Each
 * raider's nerve is the morale below which it runs on its own; it comes from its species and its
 * entity id, so it draws on no stream.
 */

import { C, type Hostile, type Party } from '@core/components';
import type { EntityId } from '@core/types';
import type { TickContext } from '@core/system';
import {
  MORALE_BREAK,
  MORALE_BREAK_LEADERLESS,
  MORALE_CAPTAIN_LOST,
  MORALE_CASUALTY,
  MORALE_FOE_FELLED,
  MORALE_LOOT,
  MORALE_OWN_FIRE,
  MORALE_START,
  MORALE_TRAP,
  NERVE_BELOW_FLEE_BLOOD,
  NERVE_SPREAD,
} from './constants';

export type MoraleWord = 'steady' | 'shaken' | 'wavering' | 'breaking';
export type Casualty = keyof typeof MORALE_CASUALTY;

/** Purposes with a morale: the rest (thieves, the restless dead, caravans) never break on it. */
export function hasMorale(P: Party): boolean {
  return MORALE_START[P.purpose] !== undefined;
}

export function moraleOf(P: Party): number {
  return P.morale ?? MORALE_START[P.purpose] ?? 100;
}

export function moraleWord(value: number): MoraleWord {
  if (value >= 70) return 'steady';
  if (value >= 50) return 'shaken';
  if (value >= 30) return 'wavering';
  return 'breaking';
}

function setMorale(P: Party, value: number): void {
  P.morale = Math.max(0, Math.min(100, Math.round(value)));
}

/** A shock to the party's morale (negative lowers it); nothing for a party without morale. */
export function shake(P: Party, amount: number): void {
  if (!hasMorale(P) || P.state === 'retreat' || P.state === 'gone') return;
  setMorale(P, moraleOf(P) + amount);
}

/**
 * A member's casualty, by its worst so far: a member that falls and then dies costs the death's
 * share, not both. The share is for a party of ten, scaled by the party's size.
 */
export function countCasualty(P: Party, H: Hostile, kind: Casualty): void {
  const weight = MORALE_CASUALTY[kind];
  const counted = H.moraleLoss ?? 0;
  if (weight <= counted) return;
  H.moraleLoss = weight;
  const size = Math.max(1, P.members.length);
  shake(P, -((weight - counted) * 10) / size);
}

export function shakeByTrap(P: Party): void { shake(P, -MORALE_TRAP); }
export function shakeByOwnFire(P: Party): void { shake(P, -MORALE_OWN_FIRE); }
export function steadyByLoot(P: Party): void { shake(P, MORALE_LOOT); }
export function steadyByFoeFelled(P: Party): void { shake(P, MORALE_FOE_FELLED); }

/** The captains are gone: one large drop, once (`captainLost` is saved). */
export function countCaptainLoss(P: Party, lost: boolean): void {
  if (!lost || P.captainLost === true) return;
  P.captainLost = true;
  shake(P, -MORALE_CAPTAIN_LOST);
}

/** Whether morale alone breaks the party now. */
export function moraleBroken(P: Party, leaderless: boolean): boolean {
  if (!hasMorale(P)) return false;
  const m = moraleOf(P);
  return m <= MORALE_BREAK || (leaderless && P.state !== 'engage' && m < MORALE_BREAK_LEADERLESS);
}

/**
 * A fortress creature killed or downed: each party whose member killed it, or holds it as its
 * target, takes heart once.
 */
export function steadyPartiesThatFelled(ctx: TickContext, victim: EntityId, killer: EntityId): void {
  const entities = ctx.world.entities;
  const killerParty = killer === 0 ? 0 : entities.get(killer, C.Hostile)?.partyId ?? 0;
  for (const partyId of entities.with(C.Party)) {
    const P = entities.get(partyId, C.Party);
    if (P === undefined || !hasMorale(P) || P.state === 'retreat' || P.state === 'gone') continue;
    const felled = partyId === killerParty ||
      P.members.some((m) => entities.alive(m) && ctx.world.services.combat?.targetOf(m) === victim);
    if (felled) steadyByFoeFelled(P);
  }
}

/** A spread of 0 .. NERVE_SPREAD - 1 from the entity id (Knuth's multiplicative hash): no draw. */
function spreadOf(id: EntityId): number {
  return (Math.imul(id, 2654435761) >>> 0) % NERVE_SPREAD;
}

/**
 * The morale below which this raider runs on its own: its species' flee-at-blood percent less
 * `NERVE_BELOW_FLEE_BLOOD`, plus its spread. A captain never loses its nerve: it goes with its party.
 */
export function nerveOf(m: EntityId, H: Hostile, ctx: TickContext): number {
  if (H.role === 'captain') return -1;
  const creature = ctx.world.entities.get(m, C.Creature);
  const row = creature === undefined ? undefined
    : ctx.registry.table<{ id: string; fleeBloodPercent?: number | null }>('creatures').byIndex(creature.species);
  const base = (row?.fleeBloodPercent ?? 50) - NERVE_BELOW_FLEE_BLOOD;
  return base + spreadOf(m);
}
