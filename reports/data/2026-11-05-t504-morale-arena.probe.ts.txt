/**
 * T-504 probe (not committed as a test; a copy is filed as
 * reports/data/2026-11-05-t504-morale-arena.probe.ts.txt; run from test/perf with
 * vitest.perf.config.ts). The combat-pace squad arena on the flat test map, through the real tick
 * loop: a squad at a station against a raid of ten (and its captain) in the open, with a pile of
 * twelve iron bars at the raid's goal (the map's centre, 12 tiles before the squad) for it to loot
 * if it wins, and three civilians eight tiles behind the squad.
 *
 * Kinds: `<squad>[-m2][-p4]`
 *  - `n3`: three Novice soldiers (skill 2) in full iron kit, T-466's open arena;
 *  - `n6`, `s6`, `p6`: six soldiers, Novice (2) in iron, Skilled (8) in iron, Proficient (10) in
 *    steel (helm, mail shirt, greaves, axe, shield);
 *  - `-m2`: two marksdwarves at the squad's skill (crossbow, dodge) in a helm and mail shirt of the
 *    squad's metal, with an oak crossbow and 25 iron bolts, in a ranged squad of their own stationed
 *    three tiles behind the soldiers;
 *  - `-p4`: the raid at peril 4 (gear tier 3) instead of peril 2.
 * Each trial runs until the party has ended or 6 days have passed. Writes T504_OUT (JSON lines).
 * Observation only.
 */
import { describe, it } from 'vitest';
import { appendFileSync, writeFileSync } from 'node:fs';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { arriveParty, spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../scenarios/test-world';

const OUT = process.env['T504_OUT'] ?? '.vite/t504-arena.jsonl';
const N = Number(process.env['T504_N'] ?? 24);
const ONLY = process.env['T504_ONLY'] ?? '';
const Z = FLAT_TEST_SURFACE_Z;

interface Kit { weapon?: [string, string]; shield?: [string, string]; body?: [string, string]; head?: [string, string]; legs?: [string, string] }

function equip(w: TestWorld, id: EntityId, at: number, kit: Kit): void {
  const items = w.game.registry.table('items');
  const mats = w.game.registry.table('materials');
  const make = (k?: [string, string]): EntityId => (k ? w.spawnItem(items.index(k[0]), mats.index(k[1]), at, 1, 1) : 0);
  const old = w.game.world.entities.get(id, C.Equipment);
  const eq: Equipment = {
    weapon: make(kit.weapon), shield: make(kit.shield),
    armor: { head: make(kit.head), body: make(kit.body), arms: 0, legs: make(kit.legs), feet: 0 },
    clothing: old?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
  };
  w.game.world.entities.add(id, C.Equipment, eq);
}

function makeSquad(w: TestWorld, name: string, members: EntityId[], station: number, ranged: boolean): void {
  w.game.world.applyCommand({ type: 'CreateSquad', name });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members });
  if (ranged) w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged: true } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: station });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
}

function standing(w: TestWorld, id: EntityId): boolean {
  const ent = w.game.world.entities;
  if (!ent.alive(id) || !ent.get(id, C.Position)) return false;
  return ent.get(id, C.Body)?.conscious !== false;
}

function trial(kind: string, i: number): Record<string, unknown> {
  const parts = kind.split('-');
  const sq = parts[0] as 'n3' | 'n6' | 's6' | 'p6';
  const marks = parts.includes('m2') ? 2 : 0;
  const peril = parts.includes('p4') ? 4 : 2;
  const w = new TestWorld({ seed: `t504-arena-${i}`, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const reg = w.game.registry;
  const ent = w.game.world.entities;
  const items = w.game.world.services.items!;
  const sx = 46, sy = 60;
  const size = sq === 'n3' ? 3 : 6;
  const level = sq === 's6' ? 8 : sq === 'p6' ? 10 : 2;
  const metal = sq === 'p6' ? 'steel' : 'iron';
  const skills = { axe: level, shield: level, dodge: level, armor_use: level, hammer: 2 };
  const ids: EntityId[] = [];
  for (let k = 0; k < size; k += 1) ids.push(w.spawnDwarf({ at: w.index(sx + k, sy, Z), skills }));
  makeSquad(w, 'Guard', ids, w.index(sx, sy, Z), false);
  const shooters: EntityId[] = [];
  for (let k = 0; k < marks; k += 1) shooters.push(w.spawnDwarf({ at: w.index(sx + k, sy + 3, Z), skills: { crossbow: level, dodge: level, armor_use: level, hammer: 2 } }));
  if (marks > 0) makeSquad(w, 'Bolts', shooters, w.index(sx + 2, sy + 3, Z), true);
  w.step(1);
  const kit: Kit = { weapon: ['axe', metal], shield: ['shield', metal], body: ['mail_shirt', metal], head: ['helm', metal], legs: ['greaves', metal] };
  ids.forEach((id, k) => equip(w, id, w.index(sx + k, sy, Z), kit));
  shooters.forEach((id, k) => {
    const at = w.index(sx + k, sy + 3, Z);
    equip(w, id, at, { body: ['mail_shirt', metal], head: ['helm', metal] });
    const bow = w.spawnItem('crossbow', 'oak', at, 1, 1);
    const bolts = w.spawnItem('bolt', 'iron', at, 25, 1);
    for (const it of [bow, bolts]) { items.attachToCarrier(it, id); items.setOwner(it, id); }
    const eq = ent.get(id, C.Equipment)!;
    ent.add(id, C.Equipment, { ...eq, weapon: bow, quiver: bolts });
  });
  // The loot: twelve iron bars, one a tile, around the raid's goal (the map's centre).
  const cx = Math.floor(w.map.w / 2), cy = Math.floor(w.map.h / 2);
  for (let k = 0; k < 12; k += 1) w.spawnItem('bar', 'iron', w.index(cx - 3 + (k % 6), cy + Math.floor(k / 6), Z), 1, 1);
  const civ: EntityId[] = [];
  for (let k = 0; k < 3; k += 1) civ.push(w.spawnDwarf({ at: w.index(sx + k, sy + 8, Z) }));
  const rng = w.game.world.rngFor('t366');
  const { partyId, pendingSpawns } = arriveParty(w.game.world as never, reg, rng, 'raid', 'gloam', 10, 'n', w.tick, 15, peril, false);
  for (const s of pendingSpawns) spawnHostileMember(w.game.world as never, reg, rng, s.partyId, s.species, s.role, s.tile, s.gearTier, s.isCaptain);
  const members = [...ent.get(partyId, C.Party)!.members];
  const captain = members.find((m) => ent.get(m, C.Hostile)?.role === 'captain') ?? 0;
  const fortress = new Set([...ids, ...shooters, ...civ]);
  const t = { captainFate: 'standing', nerveFlights: 0, bloodFlights: 0, fledBeforeBreak: 0, escapedLoot: 0, raiderFriendlyHits: 0,
    soldierKills: 0, shooterKills: 0, raidersDied: 0, friendlyBolts: 0, brokeTick: 0, brokeLosses: -1, brokeMorale: -1, firstBlood: 0 };
  let ended = '';
  let moraleMin = 100;
  w.game.world.onEvents((ev) => {
    for (const e of ev) {
      if (e.type === 'RaidEnded' && Number(e['partyId']) === partyId) ended = String(e['outcome']);
      else if (e.type === 'ThiefEscaped' && members.includes(Number(e['id']))) t.escapedLoot += 1;
      else if (e.type === 'HostileFled' && members.includes(Number(e['id']))) {
        if (e['nerve'] === true) t.nerveFlights += 1; else t.bloodFlights += 1;
        if (t.brokeTick === 0) t.fledBeforeBreak += 1;
      } else if (e.type === 'CreatureDied' && members.includes(Number(e['id']))) {
        t.raidersDied += 1;
        if (Number(e['id']) === captain && t.captainFate === 'standing') t.captainFate = 'died';
      }
      else if (e.type === 'CreatureUnconscious' && Number(e['id']) === captain && t.captainFate === 'standing') t.captainFate = 'down';
      else if (e.type === 'KillRecorded' && e['hostile'] === true) {
        if (ids.includes(Number(e['killerId']))) t.soldierKills += 1;
        if (shooters.includes(Number(e['killerId']))) t.shooterKills += 1;
      } else if (e.type === 'AttackResolved' && e['outcome'] === 'hit') {
        const a = Number(e['attackerId']), d = Number(e['defenderId']);
        if (members.includes(a) && members.includes(d)) t.raiderFriendlyHits += 1;
        if (shooters.includes(a) && fortress.has(d)) t.friendlyBolts += 1;
        if (t.firstBlood === 0 && (members.includes(a) || fortress.has(a))) t.firstBlood = w.tick;
      }
    }
  });
  const fighters = [...ids, ...shooters];
  let fightEnd = 0;
  for (let k = 0; k < 6 * TICKS_PER_DAY; k += 1) {
    w.step(1);
    const P = ent.get(partyId, C.Party);
    const morale = (P as { morale?: number } | undefined)?.morale;
    if (typeof morale === 'number') moraleMin = Math.min(moraleMin, morale);
    if (t.brokeTick === 0 && P !== undefined && P.state === 'retreat') {
      t.brokeTick = w.tick;
      t.brokeLosses = members.filter((m) => !standing(w, m)).length;
      t.brokeMorale = typeof morale === 'number' ? morale : -1;
    }
    if (fightEnd === 0 && (fighters.every((d) => !standing(w, d)) || members.every((m) => !standing(w, m)) || P?.state === 'retreat')) fightEnd = w.tick;
    if (ended !== '') break;
  }
  return {
    kind, i, peril, members: members.length,
    outcome: ended || 'active',
    squadDown: fighters.every((d) => !standing(w, d)),
    fightEnd, endTick: w.tick,
    soldiersDead: ids.filter((d) => !ent.alive(d)).length,
    shootersDead: shooters.filter((d) => !ent.alive(d)).length,
    civDead: civ.filter((d) => !ent.alive(d)).length,
    raidersDead: t.raidersDied,
    raidersKilled: t.soldierKills + t.shooterKills,
    moraleMin, ...t,
  };
}

describe('T-504 morale arena probe', () => {
  it('runs the arenas', () => {
    if (!ONLY) writeFileSync(OUT, '');
    const put = (r: Record<string, unknown>): void => appendFileSync(OUT, JSON.stringify(r) + '\n');
    const kinds = (ONLY || 'n3,n6,s6,p6,n6-m2,s6-m2,p6-m2,s6-p4').split(',');
    for (const k of kinds) for (let i = 0; i < N; i += 1) put(trial(k, i));
  }, 14_400_000);
});
