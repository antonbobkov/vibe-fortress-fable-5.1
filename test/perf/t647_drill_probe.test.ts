/**
 * T-647's probe of a squad at drill that strikes a raider for nothing: plays a three-year seed
 * (`T647_SEED`, default `three-years-p4-6`) at `THREE_YEARS_SHIFT` (default 150) with the sweep's
 * loop (`three_years_seeds.test.ts`: the shift, the bootstrap in steps of 100 ticks, then 300) to
 * tick `T647_TO` (default 236,000), and from tick `T647_FROM` (default 232,000) prints each melee blow
 * a fortress creature lands on a hostile and each blow a hostile lands on it: the attacker's weapon
 * (its item, material and whether it is a training weapon), its squad's mode and the alert, the
 * defender's armour on the part struck, and the damage; then a count of blows and damage by weapon.
 * Local diagnosis only (set `T647_PROBE=1`); not part of `npm test`.
 */

import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat/reader';
import { weaponOf } from '@systems/combat/melee';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';

const SEED = process.env['T647_SEED'] ?? 'three-years-p4-6';
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '150');
const TO = Number(process.env['T647_TO'] ?? '236000');
const FROM = Number(process.env['T647_FROM'] ?? '232000');
const peril = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? '4');

describe('T-647 probe: soldiers at drill and a raider', () => {
  it.runIf(process.env['T647_PROBE'] === '1')(SEED, () => {
    const w = threeYearsWorld(SEED, peril(SEED));
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const reg = w.game.registry;
    const combat = w.readers.of<CombatReader>('16');
    const species = (id: number): string => reg.table<{ id: string }>('creatures').byIndex(ent.get(id, C.Creature)?.species ?? -1)?.id ?? '?';
    const material = (item: number): string => reg.table<{ id: string }>('materials').byIndex(ent.get(item, C.Item)?.material ?? -1)?.id ?? '?';
    const weapon = (id: number): string => {
      const wp = weaponOf(ent, reg, id);
      if (wp === null) return 'none';
      return `${wp.weaponDef.id}#${wp.item}/${material(wp.item)}${(wp.weaponDef as { training?: boolean }).training === true ? '/TRAINING' : ''}`;
    };
    const armour = (id: number): string => {
      const eq = ent.get(id, C.Equipment);
      if (eq === undefined) return 'no equipment';
      const names = Object.entries(eq.armor).filter(([, it]) => it !== 0).map(([slot, it]) => `${slot}:${reg.table<{ id: string }>('items').byIndex(ent.get(it, C.Item)?.type ?? -1)?.id ?? '?'}/${material(it)}`);
      return names.join(' ') || 'none';
    };
    const squadOf = (id: number): string => {
      const s = ent.get(id, C.Soldier);
      if (s === undefined || s.squadId === 0) return '-';
      const sq = combat.squads().find((q) => q.id === s.squadId);
      return `sq${s.squadId}:${sq?.mode ?? '?'}${s.onDuty ? ':duty' : ''}`;
    };
    const tally = new Map<string, { blows: number; hits: number; damage: number }>();
    const seen = new Set<number>();
    const out: string[] = [];
    let printed = 0;
    w.game.world.onEvents((events) => {
      if (w.tick < FROM) return;
      for (const e of events) {
        if (e.type !== 'AttackResolved') continue;
        const a = Number(e['attackerId']);
        const d = Number(e['defenderId']);
        const fa = ent.get(a, C.Creature)?.faction;
        const fd = ent.get(d, C.Creature)?.faction;
        if (fa === fd) continue;
        if (fa !== 'fortress' && fd !== 'fortress') continue;
        const key = `${fa}:${species(a)} ${weapon(a)} -> ${species(d)}`;
        const t = tally.get(key) ?? { blows: 0, hits: 0, damage: 0 };
        t.blows += 1;
        if (e['outcome'] === 'hit') t.hits += 1;
        t.damage += Number(e['amount'] ?? 0);
        tally.set(key, t);
        if (!seen.has(d) && fd !== 'fortress') {
          seen.add(d);
          out.push(`t${w.tick} defender ${d} ${species(d)} armour ${armour(d)} weapon ${weapon(d)}`);
        }
        if (printed < 60) {
          printed += 1;
          out.push(`t${w.tick} ${a} ${species(a)} [${squadOf(a)} ${weapon(a)}] -> ${d} ${species(d)} part ${String(e['part'])} ${String(e['damageType'])} ${String(e['outcome'])} ${String(e['amount'])}`);
        }
      }
    });
    const totalTicksBootstrap = 20 * TICKS_PER_DAY;
    while (w.tick < totalTicksBootstrap) {
      playThreeYears(w, state, Math.min(100, totalTicksBootstrap - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    let lastSquads = -1;
    while (w.tick < TO) {
      playThreeYears(w, state, Math.min(300, TO - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      if (w.tick >= FROM && w.tick - lastSquads >= 1200) {
        lastSquads = w.tick;
        for (const sq of combat.squads()) {
          out.push(`t${w.tick} squad ${sq.id} ${sq.name} mode ${sq.mode}: ${sq.members.map((m) => `${m} ${weapon(m)} armour[${armour(m)}]`).join('; ')}`);
        }
        const kit = ent.with(C.Item).filter((it) => {
          const row = reg.table<{ id: string }>('items').byIndex(ent.get(it, C.Item)?.type ?? -1);
          return row !== undefined && reg.table<{ id: string; launcher?: unknown }>('weapons').byId(row.id) !== undefined;
        }).map((it) => `${reg.table<{ id: string }>('items').byIndex(ent.get(it, C.Item)?.type ?? -1)?.id}/${material(it)}${ent.get(it, C.Item)?.carriedBy ? `@${ent.get(it, C.Item)?.carriedBy}` : ''}`);
        out.push(`t${w.tick} weapons in the world: ${kit.join(', ')}`);
      }
    }
    for (const line of out) console.log(`[t647] ${line}`);
    for (const [k, v] of tally) console.log(`[t647] tally ${k}: ${v.blows} blows, ${v.hits} hits, ${v.damage} damage`);
  });
});
