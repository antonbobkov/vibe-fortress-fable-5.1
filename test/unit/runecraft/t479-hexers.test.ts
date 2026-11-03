/**
 * T-479: Gloam hexers in raids and sieges (`25-runecraft.md` § Hexers; `18` § Party composition;
 * `threat-schedules.md` § Party composition, § Hostile gear by tier).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, ItemFlag, type Equipment, type Party } from '@core/components';
import { TICKS_PER_HOUR, TICKS_PER_YEAR } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import { scoreWeapon, type CombatReader, type SquadWithId } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import type { MagicReader } from '@systems/magic';
import { HEXER_RUNE } from '@systems/magic/constants';
import { HEXER_FIRST_YEAR, HEXERS_PER_RAID, HEXERS_PER_SIEGE } from '@systems/threats/constants';
import { shootsFromRange } from '@systems/threats/ai';
import { arriveParty, calculatePartyComposition, hexerCount, spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const magic = (w: TestWorld): MagicReader => w.readers.of<MagicReader>('25');
const items = (w: TestWorld): ItemsReader => w.readers.of<ItemsReader>('13');

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** An engaged raid party with no member yet. */
function raidParty(w: TestWorld, goal: TileIndex): EntityId {
  const partyId = w.game.world.entities.create('party');
  const party: Party = {
    civ: 'gloam', purpose: 'raid', members: [], leaderId: 0, state: 'engage',
    goalTile: goal, goalEntity: 0, arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n', size: 1,
  };
  w.game.world.entities.add(partyId, C.Party, party);
  return partyId;
}

/** A hexer of `partyId` as 18 spawns one, at gear tier 3 (a peril-4 raid). */
function hexer(w: TestWorld, partyId: EntityId, at: TileIndex, tier = 3): EntityId {
  return spawnHostileMember(w.game.world, registry, w.game.world.rngFor('18'), partyId, 'gloam_hexer', 'hexer', at, tier, false);
}

function squad(w: TestWorld, members: EntityId[], station: TileIndex): SquadWithId {
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members });
  w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged: false } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: station });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  w.step(1);
  for (const id of members) w.game.world.entities.add(id, C.Soldier, { ...w.game.world.entities.get(id, C.Soldier)!, stance: 'hold' });
  return s;
}

/** A soldier on its post in iron helm, mail and greaves, so a long fight does not end with it. */
function guard(w: TestWorld, x: number, y: number): EntityId {
  const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { dodge: 0 } });
  squad(w, [id], w.index(x, y, Z));
  const piece = (type: string): EntityId => {
    const p = w.spawnItem(type, 'iron', w.index(x, y, Z));
    w.items.attachToCarrier(p, id);
    w.items.setOwner(p, id);
    return p;
  };
  const eq = w.game.world.entities.get(id, C.Equipment) as Equipment;
  w.game.world.entities.add(id, C.Equipment, { ...eq, armor: { head: piece('helm'), body: piece('mail_shirt'), arms: 0, legs: piece('greaves'), feet: 0 } });
  return id;
}

function cell(w: TestWorld, x: number, y: number): void {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx !== 0 || dy !== 0) w.carve(w.index(x + dx, y + dy, Z), TileKind.Fortification);
    }
  }
}

const hexers = (kind: string, peril: number, year: number): number =>
  calculatePartyComposition(kind, 12, 20, peril, false, year).filter((m) => m.role === 'hexer').length;

describe('T-479 who comes', () => {
  it('one hexer a raid and two a siege, at peril 3 from year 3 and peril 4 from year 2; none at peril 2 or below', () => {
    expect(HEXER_FIRST_YEAR).toEqual({ 3: 3, 4: 2 });
    expect([HEXERS_PER_RAID, HEXERS_PER_SIEGE]).toEqual([1, 2]);
    for (const peril of [0, 1, 2]) {
      for (const year of [1, 2, 3, 4, 6]) {
        for (const kind of ['thief', 'bandits', 'ambush', 'raid', 'siege']) expect(hexers(kind, peril, year)).toBe(0);
      }
    }
    expect([1, 2, 3, 4].map((year) => hexers('raid', 3, year))).toEqual([0, 0, 1, 1]);
    expect([1, 2, 3, 4].map((year) => hexers('siege', 3, year))).toEqual([0, 0, 2, 2]);
    expect([1, 2, 3].map((year) => hexers('raid', 4, year))).toEqual([0, 1, 1]);
    expect([1, 2, 3].map((year) => hexers('siege', 4, year))).toEqual([0, 2, 2]);
    expect([hexers('ambush', 4, 3), hexers('thief', 4, 3), hexerCount('ambush', 4, 3)]).toEqual([0, 0, 0]);
    // The default year is the first: a caller that names none gets the party of before.
    expect(calculatePartyComposition('siege', 20, 30, 4).some((m) => m.role === 'hexer')).toBe(false);
  });

  it('hexers come on top of the size and last, so every other member is planned as before', () => {
    for (const kind of ['raid', 'siege']) {
      const before = calculatePartyComposition(kind, 14, 25, 4, false, 1);
      const after = calculatePartyComposition(kind, 14, 25, 4, false, 2);
      const n = kind === 'raid' ? 1 : 2;
      expect(after).toHaveLength(before.length + n);
      expect(after.slice(0, before.length)).toEqual(before);
      expect(after.slice(before.length)).toEqual(new Array(n).fill({ role: 'hexer', species: 'gloam_hexer', isCaptain: false }));
    }
  });

  it('arriveParty reads the year from the tick; at peril 2 a raid in year 3 draws what it drew in year 1', () => {
    const plan = (peril: number, tick: number): { roles: string[]; rng: unknown } => {
      const w = arena('t479-arrive');
      const rng = w.game.world.rngFor('18');
      const { pendingSpawns } = arriveParty(w.game.world, registry, rng, 'raid', 'gloam', 10, 'n', tick, 20, peril, false);
      return { roles: pendingSpawns.map((s) => s.role), rng: w.game.world.rngState() };
    };
    const y1 = plan(4, 60 * 1200);
    const y2 = plan(4, TICKS_PER_YEAR + 60 * 1200);
    expect(y1.roles).not.toContain('hexer');
    expect(y2.roles.filter((r) => r === 'hexer')).toHaveLength(1);
    expect(y2.roles[y2.roles.length - 1]).toBe('hexer');
    const p2y1 = plan(2, 60 * 1200);
    const p2y3 = plan(2, 2 * TICKS_PER_YEAR + 60 * 1200);
    expect(p2y3.roles).toEqual(p2y1.roles);
    expect(p2y3.rng).toEqual(p2y1.rng);
  });
});

describe('T-479 a hexer', () => {
  it('carries a wooden wand of frost, a dagger, a cap and a jerkin, all foreign, and HEXER_RUNE that never comes back', () => {
    const w = arena('t479-kit');
    const at = w.index(30, 30, Z);
    const party = raidParty(w, at);
    // Its kit is fixed: spawning it draws nothing on 18's stream.
    const before = JSON.stringify(w.game.world.rngState());
    const h = hexer(w, party, at);
    expect(JSON.stringify(w.game.world.rngState())).toBe(before);
    const ent = w.game.world.entities;
    const eq = ent.get(h, C.Equipment)!;
    const wand = ent.get(eq.weapon, C.Item)!;
    const typeOf = (id: EntityId): string | undefined => registry.table<{ id: string }>('items').byIndex(ent.get(id, C.Item)!.type)?.id;
    expect(typeOf(eq.weapon)).toBe('wand');
    expect(registry.table<{ id: string }>('materials').byIndex(wand.material)?.id).toBe('oak');
    expect(registry.table<{ id: string }>('materials').byIndex(wand.stone ?? 0)?.id).toBe('amethyst');
    expect(magic(w).spellOf(eq.weapon)).toMatchObject({ id: 'frostbind', kind: 'bolt', cost: 1, range: 8, damage: 6, type: 'frost' });
    const carried = items(w).carriedItems(h);
    expect(carried.map(typeOf).sort()).toEqual(['cap', 'dagger', 'leather_jerkin', 'wand']);
    for (const id of carried) {
      expect(ent.get(id, C.Item)!.flags & ItemFlag.Foreign).not.toBe(0);
      expect(items(w).get(id)?.carriedBy).toBe(h);
    }
    // Every skill at 2 + 2 × tier, runecraft too; a hexer is no captain.
    const runecraft = registry.table('skills').index('runecraft');
    expect(ent.get(h, C.Skills)!.level[runecraft]).toBe(8);
    expect(ent.get(h, C.Hostile)!.role).toBe('hexer');
    expect(shootsFromRange('hexer')).toBe(true);
    const view = magic(w).rune(h)!;
    expect(view.current).toBe(HEXER_RUNE * 1000);
    expect([view.max, view.regen, view.hoursToFull, view.vials]).toEqual([40_000, 0, -1, 0]);
    // Half a day of HourPassed: a hostile's rune is not regenerated.
    ent.add(h, C.Rune, { current: 5000 });
    w.step(12 * TICKS_PER_HOUR);
    expect(ent.get(h, C.Rune)!.current).toBe(5000);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
  });

  it('casts its twenty frost bolts, says nothing when they are gone, then closes to melee with the wand', () => {
    const w = arena('t479-twenty');
    const target = guard(w, 40, 44);
    const at = w.index(40, 50, Z);
    cell(w, 40, 50);
    const h = hexer(w, raidParty(w, at), at);
    const wand = w.game.world.entities.get(h, C.Equipment)!.weapon;
    w.game.world.services.combat?.setTarget(h, target);
    const casts = (): Record<string, unknown>[] => w.events('SpellCast').filter((e) => e['casterId'] === h);
    w.until(() => casts().length >= HEXER_RUNE, 3000);
    w.step(300);
    expect(casts()).toHaveLength(HEXER_RUNE);
    expect(casts().every((e) => e['spellId'] === 'frostbind' && e['targetId'] === target)).toBe(true);
    expect(w.game.world.entities.get(h, C.Rune)!.current).toBe(0);
    expect(magic(w).canCast(h)).toBe(false);
    // A hostile's spent rune is not announced, and with no vials nothing is drunk.
    expect(w.events('RuneSpent')).toHaveLength(0);
    expect(w.events('VialDrunk')).toHaveLength(0);
    expect(w.events('AttackResolved').filter((e) => e['attackerId'] === h && e['damageType'] !== 'frost')).toHaveLength(0);
    // The cell opens: out of rune it walks up and clubs with the wand, blunt.
    w.carve(w.index(40, 49, Z), TileKind.Floor);
    w.until(() => w.events('AttackResolved').some((e) => e['attackerId'] === h && e['damageType'] === 'blunt'), 1500);
    expect(casts()).toHaveLength(HEXER_RUNE);
    expect(w.events('DamageDealt').filter((e) => e['attackerId'] === h && e['damageType'] !== 'frost').every((e) => e['weaponId'] === wand)).toBe(true);
  });

  it('holds its bolt while one of its own stands on the line, and throws once the line is clear', () => {
    const w = arena('t479-line');
    const target = guard(w, 30, 37);
    const at = w.index(30, 30, Z);
    const h = hexer(w, raidParty(w, at), at);
    // A gloam archer of no party, idle, between the hexer and its target.
    const archer = w.spawnCreature('gloam_archer', w.index(30, 33, Z), 'hostile:gloam');
    w.game.world.services.combat?.setTarget(h, target);
    w.step(400);
    expect(w.events('SpellCast')).toHaveLength(0);
    const p = w.game.world.entities.get(h, C.Position)!;
    expect([p.x, p.y]).toEqual([30, 30]);
    expect(w.game.world.entities.get(h, C.Rune)!.current).toBe(HEXER_RUNE * 1000);
    w.game.world.services.movement!.teleport(archer, w.index(36, 30, Z));
    w.until(() => w.events('SpellCast').length >= 3, 600);
    expect(w.events('SpellCast').every((e) => e['casterId'] === h && e['targetId'] === target)).toBe(true);
  });

  it('its wand is stock only once a corpse is stripped, and only a squad member with runecraft claims it', () => {
    const w = arena('t479-strip');
    const at = w.index(30, 30, Z);
    const h = hexer(w, raidParty(w, at), at);
    const wand = w.game.world.entities.get(h, C.Equipment)!.weapon;
    expect(items(w).wealth()).toBe(0);
    w.game.world.emit({ type: 'Starvation', id: h });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === h), 60);
    const corpseId = w.events('CorpseCreated').find((e) => e['creatureId'] === h)!['id'] as number;
    expect(w.game.world.entities.get(corpseId, C.Corpse)!.wornItems).toContain(wand);
    expect(w.game.world.entities.get(wand, C.Item)!.flags & ItemFlag.Foreign).not.toBe(0);
    const hauler = w.spawnDwarf({ at: w.index(32, 32, Z) });
    w.setLabor(hauler, 'hauling', true);
    w.until(() => w.events('JobCompleted').some((e) => e['jobType'] === 'strip_corpse'), 2000);
    expect(w.game.world.entities.get(wand, C.Item)!.flags & ItemFlag.Foreign).toBe(0);
    expect(items(w).get(wand)?.carriedBy).toBe(0);
    expect(items(w).wealth()).toBeGreaterThan(0);
    // A soldier with no runecraft never takes it; a runecaster does, whatever the squad prefers.
    expect(scoreWeapon(registry, w.game.world.entities, wand, 'any', false)).toBe(-1);
    const plain = w.spawnDwarf({ at: w.index(34, 30, Z), skills: { sword: 3 } });
    squad(w, [plain], w.index(34, 30, Z));
    w.step(200);
    expect(w.game.world.entities.get(plain, C.Equipment)?.weapon).not.toBe(wand);
    const caster = w.spawnDwarf({ at: w.index(34, 32, Z), skills: { runecraft: 4 } });
    squad(w, [caster], w.index(34, 32, Z));
    w.until(() => w.game.world.entities.get(caster, C.Equipment)?.weapon === wand, 400);
    expect(w.game.world.entities.get(caster, C.Equipment)?.weapon).toBe(wand);
  });
});
