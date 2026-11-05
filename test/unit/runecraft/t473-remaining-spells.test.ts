/**
 * T-473: ward, mend, dread, firebloom, daze and vials (`25-runecraft.md` § Casting, § Spells,
 * § Effects, § Vials, § Morale).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, type Equipment } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { effectValue } from '@core/effects';
import { TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import { armorReduction, isFleeing, type CombatReader, type SquadWithId } from '@systems/combat';
import { FLEE_EFFECT_TILES } from '@systems/combat/constants';
import type { MagicReader } from '@systems/magic';
import {
  CASTER_HOLD_DISTANCE,
  CASTER_VIALS,
  DREAD_MAX_TARGETS,
  FIREBLOOM_DELAY_TICKS,
  MENTAL_IMMUNE_SIZE,
  VIAL_RUNE,
  VIALS_PER_DAY,
} from '@systems/magic/constants';
import { addEffect, canCastBolt, castSupport, mentallyImmune, spellOfItem } from '@systems/magic/cast';
import type { MoraleReader } from '@systems/morale/reader';
import { weaponOf } from '@systems/combat/melee';
import { assignHostileSkills } from '@systems/threats/gear';
import { arriveParty, spawnHostileMember } from '@systems/threats/parties';
import { effectsLine, spellLine, vialsLine } from '@ui/panels/look';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const strings = new Strings(registry);

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function channel(w: TestWorld, type: 'wand' | 'staff', material: string, stone: string, at: TileIndex, quality = 1): EntityId {
  const id = w.spawnItem(type, material, at, 1, quality);
  const item = w.game.world.entities.get(id, C.Item)!;
  w.game.world.entities.add(id, C.Item, { ...item, stone: registry.table('materials').index(stone) });
  return id;
}

function hold(w: TestWorld, id: EntityId, itemId: EntityId): void {
  const items = w.game.world.services.items!;
  items.attachToCarrier(itemId, id);
  items.setOwner(itemId, id);
  const eq = w.game.world.entities.get(id, C.Equipment) as Equipment;
  w.game.world.entities.add(id, C.Equipment, { ...eq, weapon: itemId });
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
  if (stance === 'hold') {
    for (const id of members) w.game.world.entities.add(id, C.Soldier, { ...w.game.world.entities.get(id, C.Soldier)!, stance: 'hold' });
  }
  return s;
}

/** A caster on its post, in a squad of its own, holding a channel of `stone` with `rune` milli-rune. */
function caster(w: TestWorld, x: number, y: number, kind: 'wand' | 'staff', stone: string, rune = 50_000, stance: 'hold' | 'charge' = 'hold'): EntityId {
  const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { runecraft: 10 } });
  squad(w, [id], w.index(x, y, Z), stance);
  w.game.world.entities.add(id, C.Rune, { current: rune });
  hold(w, id, channel(w, kind, kind === 'wand' ? 'oak' : 'iron', stone, w.index(x, y, Z)));
  return id;
}

/** A goblin shut in a stone cell whose sides are fortifications: it can be cast at, not reached. */
function cellGoblin(w: TestWorld, x: number, y: number, species = 'gloam_warrior'): EntityId {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx !== 0 || dy !== 0) w.carve(w.index(x + dx, y + dy, Z), TileKind.Fortification);
    }
  }
  const g = w.spawnCreature(species, w.index(x, y, Z), 'hostile:gloam');
  assignHostileSkills(w.game.world.entities, registry, g, 0, false);
  return g;
}

function ctxOf(w: TestWorld): TickContext {
  return {
    world: w.game.world, registry, tick: w.tick, readers: w.readers,
    emit: (e: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(e),
  } as unknown as TickContext;
}

const magic = (w: TestWorld): MagicReader => w.readers.of<MagicReader>('25');

/** Keep every dwarf fed, watered and rested, so a long arena is not broken off by a meal or a bed. */
function rest(w: TestWorld): void {
  for (const id of w.game.world.entities.with(C.Needs)) {
    for (const need of ['hunger', 'thirst', 'rest'] as const) w.setNeed(id, need, 0);
  }
}

/** `w.until`, resting every dwarf every 50 ticks. */
function untilRested(w: TestWorld, predicate: () => boolean, maxTicks: number): void {
  for (let t = 0; t < maxTicks; t += 1) {
    if (t % 50 === 0) rest(w);
    w.step(1);
    if (predicate()) return;
  }
  throw new Error(`untilRested: the predicate did not hold within ${maxTicks} ticks`);
}
const dist = (w: TestWorld, a: EntityId, b: EntityId): number => {
  const p = w.game.world.entities.get(a, C.Position)!;
  const q = w.game.world.entities.get(b, C.Position)!;
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
};

describe('T-473 content and constants', () => {
  it('five more spells, each with its stone, and their wands and staffs numbered last', () => {
    const spells = registry.table<{ id: string; stone: string; kind: string; cost: number; range?: number; base?: number; type?: string; ticks?: number; suffix: string }>('spells');
    expect(spells.byId('ward')).toEqual({ id: 'ward', name: 'Ward', stone: 'quartz', kind: 'ward', cost: 2, range: 3, base: 6, ticks: 600, suffix: 'of warding' });
    expect(spells.byId('mend')).toMatchObject({ stone: 'emerald', kind: 'mend', cost: 2, range: 4 });
    expect(spells.byId('dread')).toMatchObject({ stone: 'sapphire', kind: 'dread', cost: 2, range: 4, ticks: 400 });
    expect(spells.byId('firebloom')).toMatchObject({ stone: 'ruby', kind: 'burst', cost: 3, range: 8, base: 14, type: 'ember' });
    expect(spells.byId('daze')).toMatchObject({ stone: 'diamond', kind: 'single', cost: 3, range: 6, ticks: 150 });
    // T-475's `call` numbers after them.
    expect(spells.ids().slice(-6, -1)).toEqual(['ward', 'mend', 'dread', 'firebloom', 'daze']);
    const recipes = registry.table<{ id: string }>('recipes').ids();
    // T-471's rows number after these ten.
    const at = recipes.indexOf('make_wand_quartz');
    expect(recipes.slice(at, at + 10)).toEqual(['quartz', 'emerald', 'sapphire', 'ruby', 'diamond'].flatMap((s) => [`make_wand_${s}`, `make_staff_${s}`]));
    expect(at).toBeGreaterThan(recipes.indexOf('make_staff_amethyst'));
    const thoughts = registry.table<{ id: string; value: number; hours: number; group: string; trigger: { event?: string } }>('thoughts');
    expect(thoughts.byId('warded')).toMatchObject({ value: 1, hours: 12, group: 'comfort', trigger: { event: 'Warded' } });
    expect(thoughts.byId('mended_by_rune')).toMatchObject({ value: 3, hours: 48, group: 'none', trigger: { event: 'Mended' } });
    const ward = thoughts.ids().indexOf('warded');
    expect(thoughts.ids().slice(ward, ward + 2)).toEqual(['warded', 'mended_by_rune']);
    expect(registry.table<{ id: string }>('palette').byId('ward_cyan')).toBeDefined();
    expect([CASTER_HOLD_DISTANCE, CASTER_VIALS, VIAL_RUNE, VIALS_PER_DAY, FIREBLOOM_DELAY_TICKS, DREAD_MAX_TARGETS, MENTAL_IMMUNE_SIZE]).toEqual([4, 3, 5, 3, 20, 4, 180]);
  });

  it('the ward row of the worked numbers: an iron staff\'s Emberbolt does 10 to a bare leg under a ward of 6', () => {
    const w = arena('t473-worked');
    const at = w.index(30, 30, Z);
    const target = w.spawnDwarf({ at });
    w.game.world.entities.add(target, C.Attributes, { ...w.game.world.entities.get(target, C.Attributes)!, tou: 50 });
    const eq = w.game.world.entities.get(target, C.Equipment) as Equipment;
    w.game.world.entities.add(target, C.Equipment, { ...eq, clothing: { body: 0, legs: 0, feet: 0, over: 0 } });
    const raw = spellOfItem(w.game.world.entities, registry, channel(w, 'staff', 'iron', 'garnet', at))!.damage;
    expect(raw).toBe(22);
    expect(armorReduction(w.game.world.entities, registry, target, 'left_leg', 'ember', 100)).toBe(0);
    addEffect(w.game.world.entities, target, { kind: 'ward', value: 6, until: 200, sourceId: 0 });
    const red = armorReduction(w.game.world.entities, registry, target, 'left_leg', 'ember', 100);
    expect(red).toBe(12);
    expect(Math.round((Math.max(0, raw - red) * 95) / 100)).toBe(10);
    // Steel passes a ward at 1.0; at the tick it lapses it is gone.
    expect(armorReduction(w.game.world.entities, registry, target, 'head', 'edge', 100)).toBe(6);
    expect(armorReduction(w.game.world.entities, registry, target, 'left_leg', 'ember', 200)).toBe(0);
  });
});

describe('T-473 ward', () => {
  function warding(seed: string, kind: 'wand' | 'staff'): { w: TestWorld; mage: EntityId; near: EntityId[]; far: EntityId; castTick: number } {
    const w = arena(seed);
    const mage = caster(w, 30, 30, kind, 'quartz');
    const near = [w.spawnDwarf({ at: w.index(32, 30, Z) }), w.spawnDwarf({ at: w.index(30, 33, Z) })];
    const far = w.spawnDwarf({ at: w.index(30, 35, Z) });
    squad(w, [...near, far], w.index(31, 31, Z));
    for (const [id, x, y] of [[near[0]!, 32, 30], [near[1]!, 30, 33], [far, 30, 35]] as const) w.game.world.services.movement!.teleport(id, w.index(x, y, Z));
    cellGoblin(w, 30, 22);
    w.until(() => w.events('SpellCast').some((e) => e['spellId'] === 'ward'), 400);
    // `until` stops after the tick in which the ward was cast.
    return { w, mage, near, far, castTick: w.tick - 1 };
  }

  it.each([['wand', 4, 420], ['staff', 7, 720]] as const)('from a %s: %i armour on the caster and its own within 3, lapsing at %i ticks', (kind, value, ticks) => {
    const { w, mage, near, far, castTick } = warding(`t473-ward-${kind}`, kind);
    const warded = w.events('Warded').map((e) => e['id']);
    expect(warded.sort()).toEqual([mage, ...near].sort());
    expect(warded).not.toContain(far);
    for (const id of [mage, ...near]) {
      expect(magic(w).effects(id)).toEqual([{ kind: 'ward', value, until: castTick + ticks, sourceId: mage }]);
      expect(effectValue(w.game.world.entities, id, 'ward', castTick + ticks - 1)).toBe(value);
      expect(effectValue(w.game.world.entities, id, 'ward', castTick + ticks)).toBe(0);
    }
    expect(w.game.world.entities.get(mage, C.Rune)!.current).toBe(48_000);
    expect(effectsLine(w.readers, strings, near[0]!)).toBe(`Under: ward ${value} (${castTick + ticks - w.tick} ticks).`);
    // No second ward while the first lasts; a new one when it lapses.
    untilRested(w, () => w.tick === castTick + ticks, ticks);
    expect(w.events('SpellCast').filter((e) => e['spellId'] === 'ward')).toHaveLength(1);
    untilRested(w, () => w.events('SpellCast').filter((e) => e['spellId'] === 'ward').length === 2, 100);
    expect(w.tick - 1).toBe(castTick + ticks);
    // A dwarf warded feels it.
    const thoughts = w.readers.of<MoraleReader>('15').thoughts(near[0]!).map((t) => t.id);
    expect(thoughts).toContain('warded');
  });

  it('a ward caster stands CASTER_HOLD_DISTANCE from its target and never clubs it', () => {
    const w = arena('t473-hold-distance');
    const mage = caster(w, 30, 30, 'staff', 'quartz', 50_000, 'charge');
    const goblin = w.spawnCreature('gloam_warrior', w.index(30, 42, Z), 'hostile:gloam');
    w.step(400);
    expect(dist(w, mage, goblin)).toBe(CASTER_HOLD_DISTANCE);
    expect(w.events('AttackResolved').filter((e) => e['attackerId'] === mage)).toHaveLength(0);
    expect(spellLine(w.readers, strings, w.game.world.entities.get(mage, C.Equipment)!.weapon, false)).toBe('Ward: 7 armour on every part for 720 ticks, range 3.');
  });
});

describe('T-473 mend', () => {
  it('closes the light wounds of the nearest bleeding soldier, bandages the rest and cleans them', () => {
    const w = arena('t473-mend');
    const mage = caster(w, 30, 30, 'staff', 'emerald');
    const hurt = w.spawnDwarf({ at: w.index(33, 30, Z) });
    squad(w, [hurt], w.index(33, 30, Z));
    const body = w.game.world.entities.get(hurt, C.Body)!;
    const legHp = body.parts[4]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: hurt, part: 'left_leg', damageType: 'edge', amount: Math.ceil(legHp * 0.4), attackerId: 0, weaponId: 0 });
    w.game.world.emit({ type: 'DamageDealt', defenderId: hurt, part: 'left_arm', damageType: 'edge', amount: 2, attackerId: 0, weaponId: 0 });
    w.step(1);
    const wounds = (): { severity: string; bleed: number; bandaged: boolean; cleaned: boolean }[] => w.game.world.entities.get(hurt, C.Body)!.parts.flatMap((p) => p.wounds);
    expect(wounds().map((x) => x.severity).sort()).toEqual(['light', 'serious']);
    cellGoblin(w, 30, 22);
    w.until(() => w.events('Mended').length > 0, 400);
    expect(w.events('Mended')).toEqual([expect.objectContaining({ id: hurt, casterId: mage })]);
    w.step(1);
    expect(wounds()).toEqual([expect.objectContaining({ severity: 'serious', bleed: 0, bandaged: true, cleaned: true })]);
    expect(w.game.world.entities.get(hurt, C.Body)!.parts[2]!.hp).toBe(w.game.world.entities.get(hurt, C.Body)!.parts[2]!.maxHp);
    expect(w.readers.of<MoraleReader>('15').thoughts(hurt).map((t) => t.id)).toContain('mended_by_rune');
    // Nothing left to mend: no second cast.
    w.step(200);
    expect(w.events('Mended')).toHaveLength(1);
  });
});

describe('T-473 dread', () => {
  it('sends at most DREAD_MAX_TARGETS running, they come back, and the party\'s retreat count does not move', () => {
    const w = arena('t473-dread');
    const mage = caster(w, 40, 40, 'staff', 'sapphire');
    // Fortifications round the caster but one gap to the south: the raiders reach it one at a time.
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) if ((dx !== 0 || dy !== 0) && !(dx === 0 && dy === 1)) w.carve(w.index(40 + dx, 40 + dy, Z), TileKind.Fortification);
    const eq = w.game.world.entities.get(mage, C.Equipment) as Equipment;
    const plate = (type: string): EntityId => w.spawnItem(type, 'steel', w.index(40, 40, Z));
    w.game.world.entities.add(mage, C.Equipment, { ...eq, armor: { head: plate('helm'), body: plate('breastplate'), arms: plate('gauntlets'), legs: plate('greaves'), feet: 0 } });
    w.setSkill(mage, 'dodge', 15);
    const rng = w.game.world.rngFor('t473');
    const { partyId } = arriveParty(w.game.world as never, registry, rng, 'raid', 'gloam', 6, 'n', w.tick, 15, 2, false);
    const spots: [number, number][] = [[37, 37], [43, 37], [37, 43], [43, 43], [40, 37], [37, 40]];
    const members = spots.map(([x, y]) => spawnHostileMember(w.game.world as never, registry, rng, partyId, 'gloam_warrior', 'warrior', w.index(x, y, Z), 0, false));
    for (const m of members) w.game.world.services.combat?.setTarget(m, mage);
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    const before = party().members.slice();
    expect(before).toEqual(expect.arrayContaining(members));
    w.until(() => w.events('SpellCast').some((e) => e['spellId'] === 'dread'), 200);
    const castTick = w.tick - 1;
    const fled = members.filter((m) => effectValue(w.game.world.entities, m, 'flee', w.tick) > 0);
    expect(fled.length).toBeGreaterThan(0);
    expect(fled.length).toBeLessThanOrEqual(DREAD_MAX_TARGETS);
    for (const m of fled) {
      expect(magic(w).effects(m)).toEqual([{ kind: 'flee', value: 1, until: castTick + 480, sourceId: mage }]);
      expect(isFleeing(w.game.world.entities, m, w.tick)).toBe(true);
    }
    // A second Dread waits for the first to end.
    expect(w.game.world.entities.get(mage, C.Rune)!.nextDreadTick).toBe(castTick + 480);
    const attacks = (): number => w.events('AttackResolved').filter((e) => fled.includes(Number(e['attackerId']))).length;
    const attacksAtCast = attacks();
    w.step(150);
    for (const m of fled) {
      expect(dist(w, m, mage)).toBeGreaterThanOrEqual(FLEE_EFFECT_TILES - 2);
      expect(w.game.world.services.combat?.targetOf(m)).toBe(mage);
      expect(w.game.world.entities.alive(m) && w.game.world.entities.has(m, C.Position)).toBe(true);
    }
    expect(party().members).toEqual(before);
    expect(party().state).not.toBe('retreat');
    expect(attacks()).toBe(attacksAtCast);
    // The dread ends: they come back.
    w.step(castTick + 480 - w.tick);
    const back = new Set<EntityId>();
    for (let t = 0; t < 300 && back.size < fled.length; t += 1) {
      w.step(1);
      expect(w.game.world.entities.alive(mage)).toBe(true);
      for (const m of fled) if (w.game.world.entities.has(m, C.Position) && dist(w, m, mage) <= 2) back.add(m);
    }
    expect([...back].sort()).toEqual([...fled].sort());
    expect(party().state).not.toBe('retreat');
    expect(party().despawnedCount ?? 0).toBe(0);
  });

  it('mental spells never take a creature of size 180 or more, nor the deep', () => {
    const w = arena('t473-immune');
    const ctx = ctxOf(w);
    const wyrm = w.spawnCreature('magma_wyrm', w.index(20, 20, Z), 'wild');
    const mammoth = w.spawnCreature('mammoth', w.index(24, 20, Z), 'wild');
    const stalker = w.spawnCreature('hollow_stalker', w.index(28, 20, Z), 'deep');
    const troll = w.spawnCreature('trollkin', w.index(32, 20, Z), 'hostile:gloam');
    expect([wyrm, mammoth, stalker].map((id) => mentallyImmune(ctx, id))).toEqual([true, true, true]);
    expect(mentallyImmune(ctx, troll)).toBe(false);
    // A Dread caster among two immune foes and one that is not casts nothing: it needs two.
    const mage = caster(w, 40, 40, 'staff', 'sapphire');
    const foes = [w.spawnCreature('hollow_stalker', w.index(42, 40, Z), 'deep'), w.spawnCreature('hollow_stalker', w.index(40, 42, Z), 'deep'),
      w.spawnCreature('gloam_warrior', w.index(38, 40, Z), 'hostile:gloam')];
    const host = { cooldownUntil: new Map<EntityId, number>(), isHostile: () => true, lineOfSight: () => true };
    expect(castSupport(ctxOf(w), mage, weaponOf(w.game.world.entities, registry, mage), foes[2]!, host)).toBe(false);
    // A Daze staff will not take a deep captain or the wyrm.
    const dazer = caster(w, 20, 26, 'staff', 'diamond');
    w.game.world.entities.add(stalker, C.Hostile, { partyId: 0, role: 'captain', behaviorState: 'attack', stealthed: false, spotted: true, breakingDoorId: 0, breakingSince: 0 });
    const held = weaponOf(w.game.world.entities, registry, dazer);
    expect(canCastBolt(ctxOf(w), dazer, held, wyrm)).toBe(false);
    expect(canCastBolt(ctxOf(w), dazer, held, troll)).toBe(false);
    w.game.world.services.movement!.teleport(troll, w.index(24, 26, Z));
    expect(canCastBolt(ctxOf(w), dazer, held, troll)).toBe(true);
    w.game.world.services.movement!.teleport(stalker, w.index(24, 27, Z));
    expect(canCastBolt(ctxOf(w), dazer, held, stalker)).toBe(false);
    expect(MENTAL_IMMUNE_SIZE).toBe(180);
  });
});

describe('T-473 daze', () => {
  it('stuns a captain for round(150 × power) ticks unless it resists; a stunned raider lies there', () => {
    const w = arena('t473-daze');
    const mage = caster(w, 30, 30, 'staff', 'diamond');
    const captain = cellGoblin(w, 30, 25, 'gloam_captain');
    w.game.world.entities.add(captain, C.Hostile, { partyId: 0, role: 'captain', behaviorState: 'attack', stealthed: false, spotted: true, breakingDoorId: 0, breakingSince: 0 });
    w.until(() => w.events('CreatureStunned').some((e) => e['id'] === captain), 2000);
    const stun = w.events('CreatureStunned').find((e) => e['id'] === captain)!;
    expect(Number(stun['until']) - (w.tick - 1)).toBe(180);
    const casts = w.events('SpellCast').filter((e) => e['spellId'] === 'daze');
    expect(casts.length).toBeGreaterThanOrEqual(1);
    expect(casts.every((e) => e['targetId'] === captain && e['casterId'] === mage)).toBe(true);
    // No missile: a daze rolls no hit and spawns nothing.
    expect(w.events('ProjectileFired').filter((e) => e['shooterId'] === mage)).toHaveLength(0);
    w.step(1);
    expect(w.game.world.entities.get(captain, C.Body)!.conscious).toBe(false);
    // Not dazed again while it lies there; it wakes when the stun ends.
    const until = Number(stun['until']);
    const before = w.events('SpellCast').filter((e) => e['spellId'] === 'daze').length;
    w.until(() => w.events('CreatureConscious').some((e) => e['id'] === captain), 400);
    expect(w.tick).toBeGreaterThanOrEqual(until);
    expect(w.events('SpellCast').filter((e) => e['spellId'] === 'daze').length).toBe(before);
  });
});

describe('T-473 firebloom', () => {
  function bloomArena(seed: string): { w: TestWorld; mage: EntityId; ally: EntityId; goblin: EntityId } {
    const w = arena(seed);
    const mage = caster(w, 30, 30, 'staff', 'ruby');
    const goblin = w.spawnCreature('gloam_warrior', w.index(30, 24, Z), 'hostile:gloam');
    const ally = w.spawnDwarf({ at: w.index(31, 23, Z), skills: { dodge: 0 } });
    squad(w, [ally], w.index(31, 23, Z));
    w.game.world.services.movement!.teleport(ally, w.index(31, 23, Z));
    w.game.world.services.combat?.setTarget(mage, goblin);
    return { w, mage, ally, goblin };
  }

  it('is never cast while a fortress creature stands in the 3×3, and burns one that walks in during the delay', () => {
    const { w, mage, ally, goblin } = bloomArena('t473-bloom');
    const movement = w.game.world.services.movement!;
    for (let k = 0; k < 200; k += 1) {
      movement.teleport(ally, w.index(31, 23, Z));
      w.step(1);
    }
    expect(w.events('SpellCast')).toHaveLength(0);
    expect(w.game.world.entities.get(mage, C.Rune)!.current).toBe(50_000);
    // The square is clear: the bloom is cast, and the ally steps into it before it blooms.
    movement.teleport(ally, w.index(36, 23, Z));
    w.until(() => w.events('SpellCast').some((e) => e['spellId'] === 'firebloom'), 200);
    const cast = w.tick - 1;
    expect(w.events('SpellCast')[0]).toMatchObject({ casterId: mage, targetId: goblin, burned: false });
    movement.teleport(ally, w.index(31, 23, Z));
    expect(w.game.world.services.combat).not.toBeNull();
    w.until(() => w.events('DamageDealt').some((e) => e['damageType'] === 'ember'), FIREBLOOM_DELAY_TICKS + 2);
    expect(w.tick - 1 - cast).toBe(FIREBLOOM_DELAY_TICKS);
    const struck = w.events('AttackResolved').filter((e) => e['attackerId'] === mage).map((e) => e['defenderId']);
    expect(struck).toContain(ally);
    expect(struck).toContain(goblin);
    expect(w.events('SpellCast').filter((e) => e['burned'] === true)).toEqual([expect.objectContaining({ casterId: mage, targetId: ally, spellId: 'firebloom' })]);
    // Once a day per caster: a second bloom that catches the ally is not announced again today.
    movement.teleport(ally, w.index(36, 23, Z));
    w.until(() => w.events('SpellCast').filter((e) => e['spellId'] === 'firebloom' && e['burned'] === false).length === 2, 300);
    movement.teleport(ally, w.index(31, 23, Z));
    w.step(FIREBLOOM_DELAY_TICKS + 1);
    expect(w.events('SpellCast').filter((e) => e['burned'] === true)).toHaveLength(1);
  });

  it('a bloom waiting to bloom survives a save', () => {
    const { w, ally } = bloomArena('t473-bloom-save');
    w.game.world.services.movement!.teleport(ally, w.index(36, 23, Z));
    w.until(() => w.events('SpellCast').some((e) => e['spellId'] === 'firebloom'), 200);
    w.step(3);
    const { game } = roundTrip(w.game);
    expect(game.hash()).toBe(w.game.hash());
    game.step(FIREBLOOM_DELAY_TICKS);
    w.game.step(FIREBLOOM_DELAY_TICKS);
    expect(game.hash()).toBe(w.game.hash());
  });
});

describe('T-473 vials and running out', () => {
  it('a squad caster takes CASTER_VIALS vials, drinks below cost with a hostile held, three a day, and drinks again the next day', () => {
    const w = arena('t473-vials');
    w.spawnItem('rune_vial', 'rune', w.index(28, 30, Z), 10);
    const mage = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 10 } });
    w.spawnItem('wand', 'oak', w.index(29, 30, Z));
    const wand = w.game.world.entities.with(C.Item).find((id) => registry.table('items').idOf(w.game.world.entities.get(id, C.Item)!.type) === 'wand')!;
    w.game.world.entities.add(wand, C.Item, { ...w.game.world.entities.get(wand, C.Item)!, stone: registry.table('materials').index('garnet') });
    squad(w, [mage], w.index(30, 30, Z));
    w.game.world.entities.add(mage, C.Rune, { current: 0 });
    expect(w.game.world.entities.get(mage, C.Equipment)!.weapon).toBe(wand);
    expect(magic(w).rune(mage)!.vials).toBe(CASTER_VIALS);
    expect(vialsLine(w.readers, strings, mage)).toBe('Vials: 3 carried, 0 of 3 drunk today.');
    // No hostile held: no drink.
    w.step(100);
    expect(w.events('VialDrunk')).toHaveLength(0);
    const goblin = cellGoblin(w, 30, 38, 'trollkin');
    untilRested(w, () => w.events('VialDrunk').length >= 1, 200);
    expect(w.game.world.entities.get(mage, C.Rune)!.current).toBe(VIAL_RUNE * 1000);
    expect(w.game.world.entities.get(mage, C.Rune)!.vialsToday).toBe(1);
    untilRested(w, () => w.events('VialDrunk').length >= 3, 600);
    // The pouch is empty; the squad's next look tops it up from stock, but a fourth vial waits for tomorrow.
    expect(magic(w).rune(mage)!.vials).toBe(0);
    w.spawnItem('log', 'oak', w.index(10, 10, Z));
    w.step(2);
    expect(magic(w).rune(mage)!.vials).toBe(CASTER_VIALS);
    const days = w.events('DayPassed').length;
    untilRested(w, () => w.events('DayPassed').length > days, TICKS_PER_DAY);
    const today = w.events('VialDrunk').length;
    expect(today).toBe(VIALS_PER_DAY);
    // The out-of-rune note is given once, however often the vials lift it, until regen does.
    expect(w.events('RuneSpent').filter((e) => e['id'] === mage).length).toBeGreaterThanOrEqual(1);
    // A new day: it may drink again.
    expect(w.game.world.entities.get(mage, C.Rune)!.vialsToday).toBeUndefined();
    expect(w.game.world.entities.alive(goblin)).toBe(true);
    w.game.world.entities.add(mage, C.Rune, { ...w.game.world.entities.get(mage, C.Rune)!, current: 0 });
    untilRested(w, () => w.events('VialDrunk').length > today, 200);
    expect(w.events('VialDrunk').length).toBe(today + 1);
  });

  it('RuneSpent is given once a caster falls below cost, and again only after regen lifts it', () => {
    const w = arena('t473-rune-spent');
    const mage = caster(w, 30, 30, 'wand', 'garnet', 2000);
    cellGoblin(w, 30, 36);
    w.until(() => w.events('RuneSpent').length >= 1, 200);
    expect(w.events('SpellCast')).toHaveLength(2);
    expect(w.events('RuneSpent')).toEqual([expect.objectContaining({ id: mage })]);
    expect(w.game.world.entities.get(mage, C.Rune)!.outAnnounced).toBe(true);
    // Regen lifts it over the cost at the hour: one more bolt, and the note again.
    const hours = w.events('HourPassed').length;
    w.until(() => w.events('HourPassed').length > hours, TICKS_PER_HOUR + 1);
    expect(w.events('RuneSpent')).toHaveLength(1);
    w.until(() => w.events('RuneSpent').length >= 2, 100);
    expect(w.events('SpellCast')).toHaveLength(3);
  });
});
