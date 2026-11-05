/**
 * T-493: hexers cast Dread on dwarves, and `calm` armour answers it (`25-runecraft.md` § Hexers,
 * § Spells, § Enchantments in combat; `10` § Behavior selection, Dread; `threat-schedules.md` § Hostile
 * gear by tier).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, type Equipment, type Party } from '@core/components';
import { effectValue } from '@core/effects';
import { TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { FLEE_EFFECT_TILES } from '@systems/combat/constants';
import { isFleeing } from '@systems/combat/melee';
import { DREAD_FLEE_ACTIVITY } from '@systems/dwarves/fire';
import type { ItemsReader } from '@systems/items';
import { addEffect, applyEnchantOnHit, fearless, resists } from '@systems/magic/cast';
import { DREAD_MAX_TARGETS } from '@systems/magic/constants';
import { wornDazeResist } from '@systems/magic/enchant';
import { DREAD_HEXER_EVERY } from '@systems/threats/constants';
import { carriesDread } from '@systems/threats/gear';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const materials = registry.table<{ id: string }>('materials');

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld): TickContext {
  return {
    world: w.game.world, registry, tick: w.tick, readers: w.readers,
    emit: (e: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(e),
  } as unknown as TickContext;
}

function raidParty(w: TestWorld, goal: TileIndex): EntityId {
  const partyId = w.game.world.entities.create('party');
  const party: Party = {
    civ: 'gloam', purpose: 'raid', members: [], leaderId: 0, state: 'engage',
    goalTile: goal, goalEntity: 0, arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n', size: 1,
  };
  w.game.world.entities.add(partyId, C.Party, party);
  return partyId;
}

function hexer(w: TestWorld, partyId: EntityId, at: TileIndex): EntityId {
  return spawnHostileMember(w.game.world, registry, w.game.world.rngFor('18'), partyId, 'gloam_hexer', 'hexer', at, 3, false);
}

/** A hexer that holds a wand of dread, shut in a cell of fortifications: it casts through them and cannot leave. */
function dreadHexer(w: TestWorld, x: number, y: number): EntityId {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) if (dx !== 0 || dy !== 0) w.carve(w.index(x + dx, y + dy, Z), TileKind.Fortification);
  }
  const at = w.index(x, y, Z);
  const h = hexer(w, raidParty(w, at), at);
  const wand = w.game.world.entities.get(h, C.Equipment)!.weapon;
  const item = w.game.world.entities.get(wand, C.Item)!;
  w.game.world.entities.add(wand, C.Item, { ...item, stone: materials.index('sapphire') });
  return h;
}

function squad(w: TestWorld, members: EntityId[], station: TileIndex, stance: 'hold' | 'charge' = 'hold'): SquadWithId {
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members });
  w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged: false } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: station });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  w.step(1);
  if (stance === 'hold') for (const id of members) w.game.world.entities.add(id, C.Soldier, { ...w.game.world.entities.get(id, C.Soldier)!, stance: 'hold' });
  return s;
}

function willpower(w: TestWorld, id: EntityId, wil: number): void {
  const attrs = w.game.world.entities.get(id, C.Attributes)!;
  w.game.world.entities.add(id, C.Attributes, { ...attrs, wil });
}

/** A calm helm on the dwarf's head. */
function calmHelm(w: TestWorld, id: EntityId): EntityId {
  const p = w.game.world.entities.get(id, C.Position)!;
  const helm = w.spawnItem('helm', 'iron', w.index(p.x, p.y, p.z));
  w.items.attachToCarrier(helm, id);
  w.items.setOwner(helm, id);
  w.game.world.services.items!.setEnchant!(helm, { id: registry.table('enchants').index('calm'), tier: 1 });
  const eq = w.game.world.entities.get(id, C.Equipment) as Equipment;
  w.game.world.entities.add(id, C.Equipment, { ...eq, armor: { ...eq.armor, head: helm } });
  return helm;
}

function rest(w: TestWorld): void {
  for (const id of w.game.world.entities.with(C.Needs)) {
    for (const need of ['hunger', 'thirst', 'rest'] as const) w.setNeed(id, need, 0);
  }
}

const dist = (w: TestWorld, a: EntityId, b: EntityId): number => {
  const p = w.game.world.entities.get(a, C.Position)!;
  const q = w.game.world.entities.get(b, C.Position)!;
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
};
const fleeing = (w: TestWorld, id: EntityId): boolean => effectValue(w.game.world.entities, id, 'flee', w.tick) > 0;
/** The dwarf holds the thought (in its saved mood: a mild one may already read as 0 in the panel). */
const holds = (w: TestWorld, id: EntityId, thought: string): boolean =>
  (w.game.world.entities.get(id, C.Mood)?.thoughts ?? []).some((t) => t.thought === registry.table('thoughts').index(thought));

describe('T-493 content', () => {
  it('a calm enchantment of sapphire, its setting, the thought and the dread hexer kit, numbered last', () => {
    const enchants = registry.table<{ id: string; slot: string; stone: string; effects: { kind: string; value: number }[] }>('enchants');
    expect(enchants.byId('calm')).toMatchObject({ slot: 'armor', stone: 'sapphire', vials: 8, suffix: 'calm' });
    expect(enchants.byId('calm')!.effects.map((e) => [e.kind, e.value])).toEqual([['flee_immune', 1], ['daze_resist', 25]]);
    expect(enchants.ids().slice(-1)).toEqual(['calm']);
    expect(registry.table('recipes').byId('set_armor_calm')).toMatchObject({ transform: true });
    const thoughtRows = registry.table<{ id: string; text: string; value: unknown; hours: number; group: string; trigger: { event?: string } }>('thoughts');
    expect(thoughtRows.ids().slice(-1)).toEqual(['put_to_flight']);
    expect(thoughtRows.byId('put_to_flight')).toMatchObject({ text: 'Fear took my legs, and I ran.', hours: 12, group: 'fear', trigger: { event: 'PutToFlight' } });
    const tiers = registry.derived<readonly { tier: number; kits: Record<string, { item: string; stone?: string }[]> }[]>('gearTiers');
    for (const row of tiers.filter((r) => r.tier >= 1)) {
      expect(row.kits['hexerDread']!.map((k) => k.item)).toEqual(row.kits['hexer']!.map((k) => k.item));
      expect(row.kits['hexerDread']!.find((k) => k.item === 'wand')?.stone).toBe('sapphire');
      expect(row.kits['hexer']!.find((k) => k.item === 'wand')?.stone).toBe('amethyst');
    }
    expect(DREAD_HEXER_EVERY).toBe(3);
  });
});

describe('T-493 a dread hexer', () => {
  it('is the hexer whose id is a multiple of DREAD_HEXER_EVERY; the choice draws nothing on 18\'s stream', () => {
    const w = arena('t493-kit');
    const at = w.index(30, 30, Z);
    const party = raidParty(w, at);
    const before = JSON.stringify(w.game.world.rngState());
    const stones = new Map<boolean, string>();
    for (let i = 0; i < 6; i += 1) {
      const h = hexer(w, party, at);
      const wand = w.game.world.entities.get(h, C.Equipment)!.weapon;
      const stone = materials.byIndex(w.game.world.entities.get(wand, C.Item)!.stone ?? 0)?.id ?? '';
      expect(stone).toBe(h % DREAD_HEXER_EVERY === 0 ? 'sapphire' : 'amethyst');
      expect(carriesDread(h)).toBe(stone === 'sapphire');
      stones.set(carriesDread(h), stone);
      if (stone === 'sapphire') expect(w.readers.of<{ spellOf(id: EntityId): { id: string } | null }>('25').spellOf(wand)).toMatchObject({ id: 'dread', range: 4 });
    }
    expect([...stones.keys()].sort()).toEqual([false, true]);
    expect(JSON.stringify(w.game.world.rngState())).toBe(before);
  });

  it('sends at most four dwarves running, soldiers on duty and civilians, and they come back', () => {
    const w = arena('t493-dread');
    const h = dreadHexer(w, 40, 50);
    // Three soldiers on their post four tiles north, and three civilians three tiles off, every one of Willpower 0.
    const station = w.index(40, 46, Z);
    const soldiers = [39, 40, 41].map((x) => w.spawnDwarf({ at: w.index(x, 46, Z), skills: { dodge: 2 } }));
    squad(w, soldiers, station, 'charge');
    const civilians = [[37, 50], [43, 50], [40, 53]].map(([x, y]) => w.spawnDwarf({ at: w.index(x!, y!, Z) }));
    const all = [...soldiers, ...civilians];
    for (const id of all) willpower(w, id, 0);
    rest(w);
    w.game.world.services.combat?.setTarget(h, soldiers[1]!);
    w.until(() => w.events('SpellCast').some((e) => e['spellId'] === 'dread'), 300);
    // Ten casts' worth of rune; take the rest so it casts once.
    w.game.world.entities.add(h, C.Rune, { ...w.game.world.entities.get(h, C.Rune)!, current: 0 });
    const fled = all.filter((id) => fleeing(w, id));
    expect(fled).toHaveLength(DREAD_MAX_TARGETS);
    expect(w.events('PutToFlight').map((e) => e['id']).sort()).toEqual([...fled].sort());
    expect(fled.some((id) => soldiers.includes(id))).toBe(true);
    expect(fled.some((id) => civilians.includes(id))).toBe(true);
    const until = w.game.world.entities.get(fled[0]!, C.Spellbound)!.effects[0]!.until;
    // The thought, mild and short, for those put to flight and no one else.
    w.step(1);
    for (const id of all) expect(holds(w, id, 'put_to_flight')).toBe(fled.includes(id));
    w.step(200);
    for (const id of fled) {
      const brain = w.game.world.entities.get(id, C.Brain)!;
      expect([brain.behavior, brain.activity]).toEqual(['flee', DREAD_FLEE_ACTIVITY]);
      expect(dist(w, id, h)).toBeGreaterThanOrEqual(FLEE_EFFECT_TILES - 2);
      expect(isFleeing(w.game.world.entities, id, w.tick)).toBe(true);
    }
    // A soldier in flight is not its squad's: it holds no target.
    for (const id of fled.filter((d) => soldiers.includes(d))) expect(w.readers.of<CombatReader>('16').targetOf(id)).toBe(0);
    // A save in the middle of the flight comes back the same.
    expect(roundTrip(w.game).game.hash()).toBe(w.hash());
    w.step(until - w.tick);
    rest(w);
    w.step(400);
    for (const id of fled) {
      const brain = w.game.world.entities.get(id, C.Brain)!;
      expect(brain.activity).not.toBe(DREAD_FLEE_ACTIVITY);
      expect(brain.behavior).not.toBe('flee');
    }
    // The soldiers are back on duty, their squad's again, and with the cell opened they close on the hexer.
    for (const id of soldiers) {
      expect(w.game.world.entities.get(id, C.Brain)!.behavior).toBe('duty');
      expect(w.readers.of<CombatReader>('16').targetOf(id)).toBe(h);
    }
    w.carve(w.index(40, 49, Z), TileKind.Floor);
    w.until(() => !w.game.world.entities.alive(h) || soldiers.every((id) => dist(w, id, h) <= 2), 600);
  });

  it('a hauler put to flight drops its load where it stands, its job goes back to the board, and it hauls again after', () => {
    const w = arena('t493-haul');
    const pile = w.zone('stockpile', [w.index(30, 20, Z)]);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'wood' }).ok).toBe(true);
    const log = w.spawnItem('log', 'oak', w.index(30, 34, Z));
    const hauler = w.spawnDwarf({ at: w.index(30, 33, Z) });
    w.setLabor(hauler, 'hauling', true);
    w.until(() => w.game.world.entities.get(hauler, C.Worker)?.carrying === log, 600);
    const jobId = w.game.world.entities.get(hauler, C.Worker)!.jobId;
    expect(jobId).not.toBe(0);
    // A raider in a cell to the north is the dread's source.
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) if (dx !== 0 || dy !== 0) w.carve(w.index(30 + dx, 27 + dy, Z), TileKind.Fortification);
    }
    const source = w.spawnCreature('gloam_warrior', w.index(30, 27, Z), 'hostile:gloam');
    addEffect(w.game.world.entities, hauler, { kind: 'flee', value: 1, until: w.tick + 280, sourceId: source }, registry);
    w.step(2);
    const worker = w.game.world.entities.get(hauler, C.Worker)!;
    expect([worker.jobId, worker.carrying]).toEqual([0, 0]);
    expect(w.readers.of<ItemsReader>('13').get(log)?.carriedBy).toBe(0);
    const brain = w.game.world.entities.get(hauler, C.Brain)!;
    expect([brain.behavior, brain.activity]).toEqual(['flee', DREAD_FLEE_ACTIVITY]);
    // It runs away from the source, south, and takes no job while it runs.
    w.step(100);
    expect(w.game.world.entities.get(hauler, C.Position)!.y).toBeGreaterThan(34);
    expect(w.game.world.entities.get(hauler, C.Worker)!.jobId).toBe(0);
    w.game.world.entities.destroy(source);
    w.step(200);
    rest(w);
    w.until(() => {
      const it = w.readers.of<ItemsReader>('13').get(log);
      const p = w.game.world.entities.get(log, C.Position);
      return it !== undefined && it.carriedBy === 0 && p !== undefined && p.x === 30 && p.y === 20;
    }, 2000);
  });

  it('a dwarf in a calm piece is never put to flight, by Dread or a fearsome blow, and draws nothing for it', () => {
    const w = arena('t493-calm');
    const h = dreadHexer(w, 40, 50);
    const calm = [[38, 50], [42, 50]].map(([x, y]) => w.spawnDwarf({ at: w.index(x!, y!, Z) }));
    const plain = [[40, 47], [40, 53]].map(([x, y]) => w.spawnDwarf({ at: w.index(x!, y!, Z) }));
    for (const id of [...calm, ...plain]) willpower(w, id, 0);
    for (const id of calm) calmHelm(w, id);
    const ctx = ctxOf(w);
    expect(calm.map((id) => fearless(ctx, id))).toEqual([true, true]);
    expect(plain.map((id) => fearless(ctx, id))).toEqual([false, false]);
    expect(addEffect(w.game.world.entities, calm[0]!, { kind: 'flee', value: 1, until: w.tick + 100, sourceId: h }, registry)).toBe(false);
    rest(w);
    w.game.world.services.combat?.setTarget(h, plain[0]!);
    w.until(() => w.events('SpellCast').some((e) => e['spellId'] === 'dread'), 300);
    expect(plain.every((id) => fleeing(w, id))).toBe(true);
    expect(calm.some((id) => fleeing(w, id))).toBe(false);
    // With only one dwarf it can take, Dread is not cast.
    const w2 = arena('t493-calm-alone');
    const h2 = dreadHexer(w2, 40, 50);
    const calm2 = [[38, 50], [42, 50]].map(([x, y]) => w2.spawnDwarf({ at: w2.index(x!, y!, Z) }));
    const lone = w2.spawnDwarf({ at: w2.index(40, 47, Z) });
    for (const id of calm2) calmHelm(w2, id);
    w2.game.world.services.combat?.setTarget(h2, lone);
    w2.step(300);
    expect(w2.events('SpellCast').filter((e) => e['spellId'] === 'dread')).toHaveLength(0);
    // A fearsome blow on a calm wearer draws nothing on stream 25.
    const before = JSON.stringify(w.game.world.rngState());
    const fearsome = [{ kind: 'flee', value: 1, chance: 0, ticks: 200, type: '' }] as unknown as Parameters<typeof applyEnchantOnHit>[1];
    applyEnchantOnHit(ctxOf(w), fearsome, h, calm[0]!, 'torso' as never, 0);
    expect(JSON.stringify(w.game.world.rngState())).toBe(before);
    expect(fleeing(w, calm[0]!)).toBe(false);
    // Its Daze resist: +25.
    expect(wornDazeResist(w.game.world.entities, registry, calm[0]!)).toBe(25);
    expect(wornDazeResist(w.game.world.entities, registry, plain[0]!)).toBe(0);
  });

  it('Willpower resists: at 0 never, at 100 half the time; a calm piece adds 25 against Daze', () => {
    const w = arena('t493-will');
    const ctx = ctxOf(w);
    const weak = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const strong = w.spawnDwarf({ at: w.index(32, 30, Z) });
    willpower(w, weak, 0);
    willpower(w, strong, 100);
    const count = (id: EntityId, bonus = 0): number => {
      let n = 0;
      for (let i = 0; i < 1000; i += 1) if (resists(ctx, id, bonus)) n += 1;
      return n;
    };
    expect(count(weak)).toBe(0);
    expect(Math.abs(count(strong) - 500)).toBeLessThan(60);
    expect(Math.abs(count(weak, 25) - 250)).toBeLessThan(50);
  });
});
