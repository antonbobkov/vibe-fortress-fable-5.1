/**
 * T-493 probe (not committed as a test; a copy is filed as
 * reports/data/2026-11-05-t493-dread-arena.probe.ts.txt; run from test/perf). T-479's hexer arena on the
 * flat test map, through the real tick loop: six Novice soldiers in full iron kit (helm, mail shirt,
 * greaves, axe, shield) against a peril-4 raid of ten (gear tier 3) in the open.
 *  - `plain`: the raid as it comes in year 1, with no hexer;
 *  - `hexer`: the same raid in year 2, its hexer holding a wand of frost;
 *  - `dread`: the same, its hexer holding a wand of dread;
 *  - `dread-calm`: as `dread`, every soldier's iron helm set with `calm`;
 *  - `mixed`: two hexers, as a siege brings them, one of frost and one of dread (a stand-in: a siege of ten does not exist).
 * Each trial runs until one side is down or the party leaves (at most 4,800 ticks), then a day with
 * no medic. Writes T493_OUT (JSON lines). Observation only.
 */
import { describe, it } from 'vitest';
import { appendFileSync, writeFileSync } from 'node:fs';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { arriveParty, spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../scenarios/test-world';

type Kind = 'plain' | 'hexer' | 'dread' | 'dread-calm' | 'mixed';
const OUT = process.env['T493_OUT'] ?? '.vite/t493-dread-arena.jsonl';
const N = Number(process.env['T493_N'] ?? 24);
const Z = FLAT_TEST_SURFACE_Z;

interface Kit { weapon: [string, string]; shield?: [string, string]; body?: [string, string]; head?: [string, string]; legs?: [string, string] }
const FULL_KIT: Kit = { weapon: ['axe', 'iron'], shield: ['shield', 'iron'], body: ['mail_shirt', 'iron'], head: ['helm', 'iron'], legs: ['greaves', 'iron'] };
const NOVICE = { axe: 2, shield: 2, dodge: 2, armor_use: 2, hammer: 2 };

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

function standing(w: TestWorld, id: EntityId): boolean {
  const ent = w.game.world.entities;
  if (!ent.alive(id) || !ent.get(id, C.Position)) return false;
  return ent.get(id, C.Body)?.conscious !== false;
}

function trial(kind: Kind, i: number): Record<string, unknown> {
  const w = new TestWorld({ seed: `t479-arena-${i}`, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const reg = w.game.registry;
  const ent = w.game.world.entities;
  const sx = 46, sy = 60;
  const ids: EntityId[] = [];
  for (let k = 0; k < 6; k += 1) ids.push(w.spawnDwarf({ at: w.index(sx + k, sy, Z), skills: NOVICE }));
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const s = w.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members: ids });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: w.index(sx, sy, Z) });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  w.step(1);
  ids.forEach((id, k) => equip(w, id, w.index(sx + k, sy, Z), FULL_KIT));
  if (kind === 'dread-calm') {
    const calm = reg.table('enchants').index('calm');
    for (const id of ids) w.game.world.services.items!.setEnchant!(ent.get(id, C.Equipment)!.armor.head, { id: calm, tier: 1 });
  }
  const maxBlood = ent.get(ids[0]!, C.Body)!.maxBlood;
  const rng = w.game.world.rngFor('t366');
  const tick = kind === 'plain' ? w.tick : TICKS_PER_YEAR + w.tick;
  const { partyId, pendingSpawns } = arriveParty(w.game.world as never, reg, rng, 'raid', 'gloam', 10, 'n', tick, 15, 4, false);
  const spawns = [...pendingSpawns];
  if (kind === 'mixed') {
    const last = spawns[spawns.length - 1]!;
    spawns.push({ ...last, tile: spawns[spawns.length - 2]!.tile });
  }
  for (const p of spawns) spawnHostileMember(w.game.world as never, reg, rng, p.partyId, p.species, p.role, p.tile, p.gearTier, p.isCaptain);
  const members = [...ent.get(partyId, C.Party)!.members];
  const hexers = members.filter((m) => ent.get(m, C.Hostile)?.role === 'hexer');
  // The wand's stone by the kind, whatever the hexer's id would choose.
  const mats = reg.table('materials');
  hexers.forEach((hx, k) => {
    const stone = kind === 'hexer' || (kind === 'mixed' && k === 0) ? 'amethyst' : 'sapphire';
    const wand = ent.get(hx, C.Equipment)!.weapon;
    ent.add(wand, C.Item, { ...ent.get(wand, C.Item)!, stone: mats.index(stone) });
  });
  const archers = members.filter((m) => ent.get(m, C.Hostile)?.role === 'archers');
  const t = { casts: 0, dreads: 0, putToFlight: 0, soldiersFled: 0, frostHits: 0, frostDamage: 0, ownHits: 0, hexerBlows: 0, arrows: 0,
    soldierHitsTaken: 0, soldierDamageTaken: 0, hitsOnFleeing: 0, damageOnFleeing: 0 };
  const fledSoldiers = new Set<EntityId>();
  let ended = '';
  w.game.world.onEvents((ev) => {
    for (const e of ev) {
      if (e.type === 'SpellCast' && hexers.includes(Number(e['casterId']))) {
        t.casts += 1;
        if (e['spellId'] === 'dread') t.dreads += 1;
      } else if (e.type === 'PutToFlight' && ids.includes(Number(e['id']))) {
        t.putToFlight += 1;
        fledSoldiers.add(Number(e['id']));
      } else if (e.type === 'RaidEnded' && Number(e['partyId']) === partyId) ended = String(e['outcome']);
      else if (e.type === 'ProjectileFired' && archers.includes(Number(e['shooterId']))) t.arrows += 1;
      else if (e.type === 'DamageDealt' && hexers.includes(Number(e['attackerId'])) && e['damageType'] === 'frost' && Number(e['amount']) > 0) {
        if (ids.includes(Number(e['defenderId']))) { t.frostHits += 1; t.frostDamage += Number(e['amount']); } else t.ownHits += 1;
      } else if (e.type === 'AttackResolved') {
        const a = Number(e['attackerId']), d = Number(e['defenderId']);
        if (hexers.includes(a) && e['damageType'] !== 'frost') t.hexerBlows += 1;
        if (members.includes(a) && e['outcome'] === 'hit' && ids.includes(d)) {
          t.soldierHitsTaken += 1; t.soldierDamageTaken += Number(e['amount']);
          if (ent.get(d, C.Spellbound)?.effects.some((x) => x.kind === 'flee' && x.until > w.tick) === true) { t.hitsOnFleeing += 1; t.damageOnFleeing += Number(e['amount']); }
        }
      }
    }
  });
  let endTick = 0;
  let slowTicks = 0;
  let fleeTicks = 0;
  for (let k = 0; k < 4800; k += 1) {
    w.step(1);
    slowTicks += ids.filter((d) => ent.get(d, C.Spellbound)?.effects.some((x) => x.kind === 'slow' && x.until > w.tick) === true).length;
    fleeTicks += ids.filter((d) => ent.get(d, C.Spellbound)?.effects.some((x) => x.kind === 'flee' && x.until > w.tick) === true).length;
    if (ended !== '' || members.every((m) => !standing(w, m)) || ids.every((d) => !standing(w, d))) { endTick = w.tick; break; }
  }
  t.soldiersFled = fledSoldiers.size;
  const after = (): Record<string, unknown> => ({
    soldiersDead: ids.filter((d) => !ent.alive(d)).length,
    soldiersDown: ids.filter((d) => ent.alive(d) && !standing(w, d)).length,
    hostilesDead: members.filter((m) => !ent.alive(m)).length,
    hexersDead: hexers.filter((m) => !ent.alive(m)).length,
    soldierBlood: ids.reduce((sum, d) => { const b = ent.get(d, C.Body); return sum + (b ? b.maxBlood - b.blood : maxBlood); }, 0),
  });
  const atEnd = after();
  const runeLeft = hexers.map((m) => ent.get(m, C.Rune)?.current ?? -1);
  w.step(1200);
  return {
    kind, i, members: members.length, hexers: hexers.length,
    outcome: ended || (ids.every((d) => !standing(w, d)) ? 'squad_down' : members.every((m) => !standing(w, m)) ? 'raid_down' : 'timeout'),
    endTick, ...atEnd, runeLeft, slowTicks, fleeTicks, dayAfter: after(), ...t,
  };
}

describe('T-493 dread arena probe', () => {
  it('runs the arenas', () => {
    writeFileSync(OUT, '');
    const kinds = (process.env['T493_KINDS'] ?? 'plain,hexer,dread,dread-calm,mixed').split(',') as Kind[];
    for (const k of kinds) for (let i = 0; i < N; i += 1) appendFileSync(OUT, JSON.stringify(trial(k, i)) + '\n');
  }, 7_200_000);
});
