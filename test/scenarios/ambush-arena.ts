/**
 * T-600: the owner's squad against a sprung peril-4 ambush. T-544's wild-squad arena
 * (`wild-squad-arena.ts`) fields the squad; here the foe is a Gloam ambush, already sprung.
 *
 * A stepped `flat-test` arena through the real tick loop. One map serves both sites: a hall of
 * `HALL_W` × `HALL_H` dug one level below the surface, with a stair (the gate) at its west end up
 * to the surface.
 *
 * - `gate`: the squad's station is on the surface by the stair head; the ambush is strung out north
 *   of it in the open, its members 8 tiles away and then one every 2 tiles further along the path
 *   it came by (18 § Stealth: a party springs as a whole, its members strung out on the leader's
 *   path), each a few tiles to one side.
 * - `hall`: the ambush has come down the stair into the hall and springs there; its members stand
 *   at the hall's west end by the stair, the squad's station at its east end, 10 to 19 tiles away.
 *
 * The ambush is built as 18 builds one (`calculatePartyComposition`, `calculateGearTier`,
 * `spawnHostileMember`): peril 4, its archers `round(size × archerShare)` (0.4, the rule; 0.2 for
 * the lever T-593 named) and the rest warriors, gear tier 3 (iron), skill 8. It is created sprung
 * (`ambushSprung`, every member revealed) in `engage`, as `springAmbush` leaves it, and its members
 * are placed in a seeded order. Both squads are sent after every member, the nearest first, as the
 * three-year script sends its squad. The fight ends when the party breaks (its state `retreat`:
 * half its members down, or its morale gone, 18 § Morale) or is wiped (`gone`), or when no fighter
 * of the squad stands, or after `FIGHT_TICKS`; then a day passes, the squads still under their
 * orders, and the dead are counted. With `medics`, two Proficient medics wait in the hall with cloth
 * and bandage the wounded once no hostile is near (17 § Patients and hospitals); without, nobody
 * does, as T-544's arena counts.
 */
import { C, type Party } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { calculateGearTier, calculatePartyComposition, spawnHostileMember } from '@systems/threats';
import { MORALE_START } from '@systems/threats/constants';
import { TestWorld } from './test-world';
import { fieldSquad, onMap, standing, type ArenaSquad } from './wild-squad-arena';

export type AmbushSite = 'gate' | 'hall';

/** The longest a fight runs before it is called. */
export const FIGHT_TICKS = 2 * TICKS_PER_DAY;
/** The peril the ambush is built at. */
export const PERIL = 4;

const SURFACE = FLAT_TEST_SURFACE_Z;
const HALL_Z = SURFACE - 1;
/** The hall: its west end at `HALL_X`, rows `HALL_Y` to `HALL_Y + HALL_H - 1`. */
const HALL_X = 28;
const HALL_Y = 58;
const HALL_W = 29;
const HALL_H = 7;
/** The stair between the hall and the surface: the gate. */
const STAIR_X = HALL_X + 1;
const STAIR_Y = HALL_Y + 3;
/** The squad's station at each site. */
const STATION: Record<AmbushSite, { x: number; y: number; z: number }> = {
  gate: { x: STAIR_X + 3, y: STAIR_Y, z: SURFACE },
  hall: { x: HALL_X + 22, y: STAIR_Y, z: HALL_Z },
};

export interface AmbushArenaResult {
  readonly squad: ArenaSquad;
  readonly site: AmbushSite;
  readonly size: number;
  readonly archerShare: number;
  readonly seed: number;
  /** `won`: the ambush broke (retreat) or was wiped and a fighter stands; `lost`: no fighter stands; `timeout`. */
  readonly outcome: 'won' | 'lost' | 'timeout';
  /** The party's state when the fight ended. */
  readonly partyState: string;
  readonly fightTicks: number;
  readonly archers: number;
  readonly warriors: number;
  /** Members dead by the day's end, and those still on the map then. */
  readonly membersKilled: number;
  readonly membersOnMap: number;
  readonly fighters: number;
  /** Medics placed (`medics` > 0: first aid after the fight), and those dead a day later. */
  readonly medics: number;
  readonly medicsDead: number;
  /** Fighters dead a day after the fight, by role. */
  readonly soldiersDead: number;
  readonly marksDead: number;
  readonly casterDead: number;
  readonly dead: number;
  /** Fighters dead, and fighters alive but down, when the fight ended. */
  readonly deadAtEnd: number;
  readonly downAtEnd: number;
  /** Fighters alive a day later who took a wound from the ambush. */
  readonly wounded: number;
  /** Blows of the ambush that landed on the squad, their damage, and the squad's blows that landed. */
  readonly hitsTaken: number;
  readonly damageTaken: number;
  readonly hitsGiven: number;
  readonly shots: number;
  readonly casts: number;
  /** Each fighter's death: its role, the cause, its killer's role, and the damage it took from each side. */
  readonly deaths: readonly { role: string; cause: string; killer: string; byAmbush: number; byFortress: number }[];
}

/** A small seeded generator for the members' order and their offsets (test code; the game's streams are untouched). */
function lcg(seed: number): () => number {
  let s = (seed * 2654435761 + 12345) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The hall below the surface and its stair. */
function digHall(w: TestWorld): void {
  w.digRoom(HALL_X, HALL_Y, HALL_Z, HALL_W, HALL_H);
  w.carve(w.index(STAIR_X, STAIR_Y, HALL_Z), TileKind.StairsUp);
  w.carve(w.index(STAIR_X, STAIR_Y, SURFACE), TileKind.StairsDown);
  for (let dy = 0; dy < HALL_H; dy += 1) for (let dx = 0; dx < HALL_W; dx += 1) w.discover(w.index(HALL_X + dx, HALL_Y + dy, HALL_Z));
}

/**
 * `n` medics (Proficient `medicine`, that labor alone, no needs pressing) with cloth beside them, in
 * the hall: by the stair foot when the squad fights at the gate, behind the squad when it fights in
 * the hall.
 */
function placeMedics(w: TestWorld, site: AmbushSite, n: number): EntityId[] {
  if (n === 0) return [];
  const labors = w.game.registry.table<{ id: string }>('labors').ids();
  const x = site === 'gate' ? STAIR_X + 2 : HALL_X + HALL_W - 2;
  const ids: EntityId[] = [];
  for (let k = 0; k < n; k += 1) {
    const id = w.spawnDwarf({ at: w.index(x, STAIR_Y - 1 + k, HALL_Z), skills: { medicine: 10 } });
    for (const l of labors) w.setLabor(id, l, l === 'medicine');
    for (const need of MEDIC_NEEDS) w.setNeed(id, need, 0);
    ids.push(id);
  }
  w.spawnItem('cloth', 'flax_cloth', w.index(x, STAIR_Y + 2, HALL_Z), 20);
  return ids;
}
const MEDIC_NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** Where member `k` of `n` stands when the ambush springs. */
function memberTile(w: TestWorld, site: AmbushSite, k: number, rand: () => number): number {
  if (site === 'gate') {
    const st = STATION.gate;
    return w.index(st.x - 3 + Math.floor(rand() * 7), st.y - 8 - 2 * k, SURFACE);
  }
  return w.index(HALL_X + 3 + k, HALL_Y + Math.floor(rand() * HALL_H), HALL_Z);
}

/** One fight of `squad` against a sprung peril-4 ambush of `size` at `site`, on seed `t600-arena-<seed>`. */
export function ambushArenaTrial(squad: ArenaSquad, site: AmbushSite, size: number, seed: number, archerShare = 0.4, medics = 0): AmbushArenaResult {
  const w = new TestWorld({ seed: `t600-arena-${seed}`, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ent = w.game.world.entities;
  digHall(w);
  const st = STATION[site];
  const { soldiers, casters, marks, guard, bolts } = fieldSquad(w, squad, st.x, st.y, st.z);
  const medicIds = placeMedics(w, site, medics);

  // The ambush, sprung: built as 18 builds one, with the archer share given.
  const planned = archerShare === 0.4
    ? calculatePartyComposition('ambush', size, 0, PERIL)
    : [
      ...Array.from({ length: Math.round(size * archerShare) }, () => ({ role: 'archers', species: 'gloam_archer', isCaptain: false })),
      ...Array.from({ length: size - Math.round(size * archerShare) }, () => ({ role: 'warriors', species: 'gloam_warrior', isCaptain: false })),
    ];
  const partyId = ent.create('party');
  const party: Party = {
    civ: 'gloam', purpose: 'ambush', members: [], leaderId: 0, state: 'engage', goalTile: 0, goalEntity: 0,
    arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n', size, morale: MORALE_START['ambush']!, ambushSprung: true,
  };
  ent.add(partyId, C.Party, party);
  const rand = lcg(seed * 7919 + size);
  const order = planned.map((_, k) => k);
  for (let k = order.length - 1; k > 0; k -= 1) {
    const j = Math.floor(rand() * (k + 1));
    [order[k], order[j]] = [order[j]!, order[k]!];
  }
  const rng = w.game.world.rngFor('18');
  const members: EntityId[] = [];
  order.forEach((p, k) => {
    const m = planned[p]!;
    const id = spawnHostileMember(w.game.world, w.game.registry, rng, partyId, m.species, m.role, memberTile(w, site, k, rand),
      calculateGearTier(PERIL, 'ambush', false), false);
    if (id !== 0) members.push(id);
  });
  const archers = planned.filter((m) => m.role === 'archers').length;

  const fighters = [...soldiers, ...casters, ...marks];
  const fortress = new Set(fighters);
  const group = new Set(members);
  const tally = { hitsTaken: 0, damageTaken: 0, hitsGiven: 0, shots: 0, casts: 0, killed: 0 };
  const role = (id: EntityId): string => (soldiers.includes(id) ? 'soldier' : marks.includes(id) ? 'marks' : 'caster');
  const roles = new Map(members.map((id) => [id, ent.get(id, C.Hostile)?.role ?? 'ambush']));
  const hostileRole = (id: EntityId): string => roles.get(id) ?? 'ambush';
  const struck = new Map<EntityId, { byAmbush: number; byFortress: number }>();
  const deaths: { role: string; cause: string; killer: string; byAmbush: number; byFortress: number }[] = [];
  const unsub = w.game.world.onEvents((events) => {
    for (const e of events) {
      if (e.type === 'DamageDealt' && fortress.has(Number(e['defenderId']))) {
        const d = Number(e['defenderId']);
        const s0 = struck.get(d) ?? { byAmbush: 0, byFortress: 0 };
        if (group.has(Number(e['attackerId']))) s0.byAmbush += Number(e['amount'] ?? 0);
        else if (fortress.has(Number(e['attackerId']))) s0.byFortress += Number(e['amount'] ?? 0);
        struck.set(d, s0);
      }
      if (e.type === 'CreatureDied' && fortress.has(Number(e['id']))) {
        const d = Number(e['id']);
        const k = Number(e['killerId'] ?? 0);
        deaths.push({ role: role(d), cause: String(e['cause']), killer: group.has(k) ? hostileRole(k) : fortress.has(k) ? role(k) : String(k),
          ...(struck.get(d) ?? { byAmbush: 0, byFortress: 0 }) });
      }
      if (e.type === 'AttackResolved' && e['outcome'] === 'hit') {
        if (group.has(Number(e['attackerId'])) && fortress.has(Number(e['defenderId']))) {
          tally.hitsTaken += 1;
          tally.damageTaken += Number(e['amount'] ?? 0);
        } else if (fortress.has(Number(e['attackerId'])) && group.has(Number(e['defenderId']))) tally.hitsGiven += 1;
      } else if (e.type === 'ProjectileFired' && marks.includes(Number(e['shooterId']))) tally.shots += 1;
      else if (e.type === 'SpellCast' && casters.includes(Number(e['casterId']))) tally.casts += 1;
      else if (e.type === 'CreatureDied' && group.has(Number(e['id']))) tally.killed += 1;
    }
  });

  // The squads are sent after every member, the nearest first.
  const byDistance = [...members].sort((a, b) => {
    const pa = ent.get(a, C.Position)!, pb = ent.get(b, C.Position)!;
    const da = Math.max(Math.abs(pa.x - st.x), Math.abs(pa.y - st.y));
    const db = Math.max(Math.abs(pb.x - st.x), Math.abs(pb.y - st.y));
    return da - db || a - b;
  });
  for (const squadId of [guard, bolts].filter((id) => id !== 0)) {
    for (const targetId of byDistance) w.game.world.applyCommand({ type: 'SquadOrder', squadId, order: { kind: 'kill', targetId } });
  }

  let outcome: AmbushArenaResult['outcome'] = 'timeout';
  let fightTicks = FIGHT_TICKS;
  let partyState = party.state;
  for (let t = 1; t <= FIGHT_TICKS; t += 1) {
    w.step(1);
    partyState = ent.get(partyId, C.Party)?.state ?? 'gone';
    if (fighters.every((d) => !standing(w, d))) { outcome = 'lost'; fightTicks = t; break; }
    if (partyState === 'retreat' || partyState === 'gone') { outcome = 'won'; fightTicks = t; break; }
  }
  const deadAtEnd = fighters.filter((d) => !ent.alive(d)).length;
  const downAtEnd = fighters.filter((d) => ent.alive(d) && !standing(w, d)).length;
  w.step(TICKS_PER_DAY);
  unsub();

  const dead = (ids: EntityId[]): number => ids.filter((d) => !ent.alive(d)).length;
  const wounded = fighters.filter((d) => ent.alive(d) && (struck.get(d)?.byAmbush ?? 0) > 0).length;
  return {
    squad, site, size, archerShare, seed, outcome, partyState, fightTicks, archers, warriors: planned.length - archers,
    membersKilled: tally.killed, membersOnMap: members.filter((m) => onMap(w, m)).length, fighters: fighters.length,
    medics: medicIds.length, medicsDead: dead(medicIds),
    soldiersDead: dead(soldiers), marksDead: dead(marks), casterDead: dead(casters), dead: dead(fighters), deadAtEnd, downAtEnd, wounded,
    hitsTaken: tally.hitsTaken, damageTaken: tally.damageTaken, hitsGiven: tally.hitsGiven, shots: tally.shots, casts: tally.casts, deaths,
  };
}
