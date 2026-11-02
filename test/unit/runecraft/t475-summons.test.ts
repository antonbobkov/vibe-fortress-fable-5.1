/**
 * T-475: Call and the three summons (`25-runecraft.md` § Summons, § Spells, § The sanctum, § Morale).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, type Equipment } from '@core/components';
import { MAX_CREATURES, TICKS_PER_HOUR } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { AnimalsReader } from '@systems/animals';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { weaponOf } from '@systems/combat/melee';
import type { DwarvesReader } from '@systems/dwarves';
import { killCreature } from '@systems/health/tick';
import type { LegendReader } from '@systems/legend';
import { MISHAP_WEIGHTS, type MagicReader } from '@systems/magic';
import { castSupport, type CastHost } from '@systems/magic/cast';
import { MAX_SUMMONS_PER_CASTER, SHADE_TURN_PERMILLE, SUMMON_TICKS } from '@systems/magic/constants';
import { planCall } from '@systems/magic/summon';
import type { MoraleReader } from '@systems/morale/reader';
import { assignHostileSkills } from '@systems/threats/gear';
import { spellLine, summonsLine } from '@ui/panels/look';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const strings = new Strings(registry);
const species = (id: string): number => registry.table('creatures').index(id);
/** A seed whose first draw on stream 25 is under SHADE_TURN_PERMILLE, so its first deep shade comes through turned. */
const TURN_SEED = 't475-turn-27';
/** Measured: shades turned in 1,000 castings of a deepsilver staff, seed `t475-thousand`. */
const TURNED_IN_1000 = 50;

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
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

/** A Call channel of `material` (a staff's metal, or a wand's wood). */
function callChannel(w: TestWorld, kind: 'wand' | 'staff', material: string, at: TileIndex): EntityId {
  const id = w.spawnItem(kind, material, at, 1, 1);
  const item = w.game.world.entities.get(id, C.Item)!;
  w.game.world.entities.add(id, C.Item, { ...item, stone: registry.table('materials').index('glowstone') });
  return id;
}

/** A caster on its post in a squad of its own, holding a Call channel, with 50 rune. */
function caller(w: TestWorld, x: number, y: number, kind: 'wand' | 'staff', material: string): EntityId {
  const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { runecraft: 10 } });
  squad(w, [id], w.index(x, y, Z));
  w.game.world.entities.add(id, C.Rune, { current: 50_000 });
  hold(w, id, callChannel(w, kind, material, w.index(x, y, Z)));
  return id;
}

/** A goblin shut in a stone cell whose sides are fortifications: seen and held, never reached. */
function cellGoblin(w: TestWorld, x: number, y: number): EntityId {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx !== 0 || dy !== 0) w.carve(w.index(x + dx, y + dy, Z), TileKind.Fortification);
    }
  }
  const g = w.spawnCreature('gloam_warrior', w.index(x, y, Z), 'hostile:gloam');
  assignHostileSkills(w.game.world.entities, registry, g, 0, false);
  return g;
}

function ctxOf(w: TestWorld): TickContext {
  return {
    world: w.game.world, registry, tick: w.tick, readers: w.readers,
    emit: (e: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(e),
  } as unknown as TickContext;
}

const host = (): CastHost => ({ cooldownUntil: new Map(), isHostile: () => true, lineOfSight: () => true });
const magic = (w: TestWorld): MagicReader => w.readers.of<MagicReader>('25');
const summoned = (w: TestWorld): EntityId[] => w.game.world.entities.with(C.Summoned).filter((id) => w.game.world.entities.alive(id)).sort((a, b) => a - b);

/** Step to the tick after the first summon is called. */
function firstCall(w: TestWorld): EntityId {
  w.until(() => w.events('SummonCalled').length > 0 || w.events('SummonTurned').length > 0, 400);
  return (w.events('SummonCalled')[0] ?? w.events('SummonTurned')[0])!['id'] as EntityId;
}

describe('T-475 content and constants', () => {
  it('the call row, the metals that pick a summon, and three summoned species numbered last', () => {
    const spells = registry.table<{ id: string; stone: string; kind: string; cost: number; range?: number; summon?: string }>('spells');
    expect(spells.byId('call')).toEqual({ id: 'call', name: 'Call', stone: 'glowstone', kind: 'call', cost: 3, suffix: 'of calling', summon: 'wisp' });
    expect(spells.ids().at(-1)).toBe('call');
    const metals = registry.table<{ id: string; summon?: string }>('metals');
    expect(['steel', 'silver', 'deepsilver', 'iron', 'copper'].map((m) => metals.byId(m)?.summon)).toEqual(['stone_warden', 'stone_warden', 'deep_shade', undefined, undefined]);
    const creatures = registry.table<{ id: string; size: number; speed: number; temper: string; attacks: { type: string; damage: number; size: number }[]; naturalArmor: number; flags: Record<string, unknown>; glyph: string; fg: string }>('creatures');
    expect(creatures.ids().slice(-3)).toEqual(['wisp', 'stone_warden', 'deep_shade']);
    expect(creatures.byId('wisp')).toMatchObject({ size: 10, speed: 240, temper: 'neutral', attacks: [{ type: 'ember', damage: 4, size: 2 }], naturalArmor: 0, glyph: '*', fg: 'rune_cyan' });
    expect(creatures.byId('stone_warden')).toMatchObject({ size: 90, speed: 105, attacks: [{ type: 'blunt', damage: 15, size: 8 }], naturalArmor: 7, glyph: 'Φ', fg: 'granite_gray' });
    expect(creatures.byId('deep_shade')).toMatchObject({ size: 60, speed: 210, attacks: [{ type: 'edge', damage: 12, size: 3 }], naturalArmor: 1, glyph: 'δ', fg: 'hollow_violet' });
    for (const id of ['wisp', 'stone_warden', 'deep_shade']) {
      expect(creatures.byId(id)?.flags).toEqual({ summoned: true, trainable: 'none', ...(id === 'deep_shade' ? { turns: true } : {}) });
    }
    const recipes = registry.table<{ id: string }>('recipes').ids();
    expect(recipes.slice(-2)).toEqual(['make_wand_glowstone', 'make_staff_glowstone']);
    expect(registry.table<{ id: string; value: number; hours: number; group: string; trigger: { event?: string } }>('thoughts').byId('summon_turned'))
      .toMatchObject({ value: { formula: '−4' }, hours: 48, group: 'fear', trigger: { event: 'SummonTurned', target: '(everyone)' } });
    expect(registry.table('thoughts').ids().at(-1)).toBe('summon_turned');
    expect(registry.table('milestones').ids().at(-1)).toBe('m_summon');
    expect([SUMMON_TICKS, MAX_SUMMONS_PER_CASTER, SHADE_TURN_PERMILLE]).toEqual([1200, 2, 50]);
  });

  it('wisp_loose weighs 10 of the 100 the mishap kinds weigh', () => {
    expect(MISHAP_WEIGHTS.find((m) => m.kind === 'wisp_loose')?.weight).toBe(10);
    expect(MISHAP_WEIGHTS.reduce((s, m) => s + m.weight, 0)).toBe(100);
  });
});

describe('T-475 call', () => {
  it.each([
    ['staff', 'iron', 'wisp'],
    ['staff', 'steel', 'stone_warden'],
    ['staff', 'silver', 'stone_warden'],
    ['wand', 'oak', 'wisp'],
  ] as const)('a %s of %s brings a %s: of the fortress, war-trained, assigned to its caster, gone in a day', (kind, material, want) => {
    const w = arena(`t475-call-${kind}-${material}`);
    const mage = caller(w, 30, 30, kind, material);
    cellGoblin(w, 30, 22);
    const id = firstCall(w);
    const entities = w.game.world.entities;
    const castTick = w.tick - 1;
    expect(entities.get(id, C.Creature)).toMatchObject({ species: species(want), faction: 'fortress' });
    expect(entities.get(id, C.Tame)).toMatchObject({ trained: 'war', assignedTo: mage, noBreed: true, petOf: 0, pastureId: 0 });
    expect(entities.get(id, C.Summoned)).toEqual({ summonerId: mage, fadesAt: castTick + SUMMON_TICKS });
    expect(w.events('SummonCalled')).toEqual([expect.objectContaining({ id, casterId: mage })]);
    expect(w.events('SpellCast').at(-1)).toMatchObject({ casterId: mage, spellId: 'call', targetId: mage, burned: false });
    expect(entities.get(mage, C.Rune)!.current).toBe(47_000);
    // It stands beside its caster.
    const p = entities.get(id, C.Position)!;
    const q = entities.get(mage, C.Position)!;
    expect(Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y))).toBeLessThanOrEqual(2);
    expect(magic(w).summonsOf(mage)).toContain(id);
  });

  it('casts while fewer than MAX_SUMMONS_PER_CASTER are alive, and not at the creature cap', () => {
    const w = arena('t475-max');
    const mage = caller(w, 30, 30, 'staff', 'steel');
    cellGoblin(w, 30, 22);
    w.step(600);
    expect(w.events('SummonCalled')).toHaveLength(MAX_SUMMONS_PER_CASTER);
    expect(magic(w).summonsOf(mage)).toHaveLength(MAX_SUMMONS_PER_CASTER);
    // One killed at 0 hp: the caster calls again.
    killCreature(ctxOf(w), magic(w).summonsOf(mage)[0]!, 'wounds');
    w.step(400);
    expect(w.events('SummonCalled')).toHaveLength(MAX_SUMMONS_PER_CASTER + 1);
    // Summons count toward MAX_CREATURES: at the cap, no call.
    const entities = w.game.world.entities;
    const held = weaponOf(entities, registry, mage);
    const call = registry.table<{ id: string; kind: string; summon?: string; stone: string; cost: number; suffix: string; name: string }>('spells').byId('call')!;
    const other = w.spawnDwarf({ at: w.index(20, 20, Z), skills: { runecraft: 10 } });
    expect(planCall(ctxOf(w), other, call as never, held!.material)).not.toBeNull();
    const fill = MAX_CREATURES - entities.with(C.Creature).length;
    for (let k = 0; k < fill; k += 1) entities.add(entities.create('creature'), C.Creature, { ...entities.get(other, C.Creature)! });
    expect(entities.with(C.Creature).length).toBe(MAX_CREATURES);
    expect(planCall(ctxOf(w), other, call as never, held!.material)).toBeNull();
  });

  it('the summon fights: a stone warden goes for a goblin within reach of its caster', () => {
    const w = arena('t475-fight');
    const mage = caller(w, 30, 30, 'staff', 'steel');
    const goblin = w.spawnCreature('gloam_warrior', w.index(30, 37, Z), 'hostile:gloam');
    assignHostileSkills(w.game.world.entities, registry, goblin, 0, false);
    const id = firstCall(w);
    w.until(() => w.events('AttackResolved').some((e) => e['attackerId'] === id), 600);
    expect(w.events('AttackResolved').filter((e) => e['attackerId'] === id).length).toBeGreaterThan(0);
    expect(w.events('AttackResolved').filter((e) => e['attackerId'] === mage)).toHaveLength(0);
  });

  it('the look panel names the spell, the caster\'s summons and the summon\'s caster', () => {
    const w = arena('t475-look');
    const mage = caller(w, 30, 30, 'staff', 'steel');
    cellGoblin(w, 30, 22);
    const id = firstCall(w);
    const staff = w.game.world.entities.get(mage, C.Equipment)!.weapon;
    expect(spellLine(w.readers, strings, staff, false)).toBe('Call: brings a stone warden for a day, 2 at a time.');
    const hours = Math.ceil((w.game.world.entities.get(id, C.Summoned)!.fadesAt - w.tick) / TICKS_PER_HOUR);
    expect(hours).toBe(24);
    const summons = magic(w).summonsOf(mage);
    expect(summonsLine(w.readers, registry, strings, mage)).toBe(`Summons: ${summons.map(() => 'stone warden (fades in 24 hours)').join(', ')}.`);
    const name = w.game.world.entities.get(mage, C.Creature)!.name;
    expect(summonsLine(w.readers, registry, strings, id)).toBe(`Called by ${name}; fades in 24 hours.`);
  });
});

describe('T-475 fading', () => {
  it('at the day\'s end, through 17 with cause faded: no corpse, no grief, no thought, no legend kill', () => {
    const w = arena('t475-fade');
    const mage = caller(w, 30, 30, 'staff', 'steel');
    const watcher = w.spawnDwarf({ at: w.index(31, 31, Z) });
    cellGoblin(w, 30, 22);
    const id = firstCall(w);
    const fadesAt = w.game.world.entities.get(id, C.Summoned)!.fadesAt;
    const population = w.readers.of<DwarvesReader>('10').population();
    w.until(() => !w.game.world.entities.alive(id), SUMMON_TICKS + 2 * TICKS_PER_HOUR);
    // The first HourPassed at or after fadesAt; the death follows it through 17 in a tick or two.
    expect(w.tick - 1).toBeGreaterThanOrEqual(fadesAt);
    expect(w.tick - 1 - fadesAt).toBeLessThanOrEqual(TICKS_PER_HOUR + 2);
    expect(w.events('SummonFaded').map((e) => e['id'])).toContain(id);
    expect(w.events('CreatureDied').find((e) => e['id'] === id)).toMatchObject({ cause: 'faded', faction: 'fortress' });
    w.step(5);
    expect(w.events('CorpseCreated').filter((e) => e['creatureId'] === id)).toHaveLength(0);
    expect(w.game.world.entities.with(C.Corpse)).toHaveLength(0);
    for (const dwarf of [mage, watcher]) {
      const thoughts = w.readers.of<MoraleReader>('15').thoughts(dwarf).map((t) => t.id);
      expect(thoughts).not.toContain('saw_death');
      expect(thoughts).not.toContain('dwarf_died');
      expect(thoughts).not.toContain('pet_died');
    }
    expect(w.readers.of<DwarvesReader>('10').population()).toBe(population);
    expect(w.readers.of<LegendReader>('24').kills()).toEqual([]);
  });

  it('at 0 hp the summon dies as any creature does, and leaves nothing', () => {
    const w = arena('t475-zero');
    caller(w, 30, 30, 'staff', 'steel');
    cellGoblin(w, 30, 22);
    const id = firstCall(w);
    killCreature(ctxOf(w), id, 'wounds');
    w.step(5);
    expect(w.game.world.entities.alive(id)).toBe(false);
    expect(w.game.world.entities.with(C.Corpse)).toHaveLength(0);
    expect(w.events('SummonFaded').filter((e) => e['id'] === id)).toHaveLength(0);
  });

  it('when its caster dies, the summon fades on the next HourPassed', () => {
    const w = arena('t475-caster-dies');
    const mage = caller(w, 30, 30, 'staff', 'steel');
    cellGoblin(w, 30, 22);
    const id = firstCall(w);
    killCreature(ctxOf(w), mage, 'wounds');
    w.step(1);
    expect(w.game.world.entities.get(id, C.Summoned)!.fadesAt).toBe(w.tick - 1);
    w.until(() => !w.game.world.entities.alive(id), TICKS_PER_HOUR + 1);
    expect(w.events('CreatureDied').find((e) => e['id'] === id)).toMatchObject({ cause: 'faded' });
  });

  it('a summon is no animal: the panel lists it not, the commands refuse it, no medic bandages it', () => {
    const w = arena('t475-not-an-animal');
    caller(w, 30, 30, 'staff', 'steel');
    cellGoblin(w, 30, 22);
    const id = firstCall(w);
    const animals = w.readers.of<AnimalsReader>('08');
    expect(animals.tameList()).not.toContain(id);
    expect(animals.bySpecies('stone_warden')).toEqual([]);
    for (const cmd of [
      { type: 'MarkSlaughter', animalId: id }, { type: 'NameAnimal', animalId: id, name: 'Rock' },
      { type: 'AssignAnimal', animalId: id, dwarfId: 0 }, { type: 'TrainAnimal', animalId: id, kind: 'war' },
      { type: 'AssignPasture', animalId: id, zoneId: 0 },
    ] as const) {
      expect(w.game.world.applyCommand(cmd), cmd.type).toEqual({ ok: false, reason: 'not_found' });
    }
    // A dog cut the same way gets its bandage job; the summon gets none.
    const dog = w.spawnTame('dog', w.index(36, 36, Z));
    for (const defenderId of [id, dog]) {
      w.game.world.emit({ type: 'DamageDealt', defenderId, part: 'torso', damageType: 'edge', amount: 6, attackerId: 0, weaponId: 0 });
    }
    w.step(200);
    const bandages = w.events('JobCreated').filter((e) => e['jobType'] === 'bandage_animal').map((e) => e['target']);
    expect(bandages).toContain(dog);
    expect(bandages).not.toContain(id);
  });

  it('a summon survives a save and still fades', () => {
    const w = arena('t475-save');
    const mage = caller(w, 30, 30, 'staff', 'steel');
    cellGoblin(w, 30, 22);
    const id = firstCall(w);
    const before = w.game.world.entities.get(id, C.Summoned)!;
    const { game } = roundTrip(w.game);
    w.replaceGame(game);
    expect(w.game.world.entities.get(id, C.Summoned)).toEqual(before);
    expect(w.game.world.entities.get(id, C.Tame)).toMatchObject({ trained: 'war', assignedTo: mage });
    w.until(() => !w.game.world.entities.alive(id), SUMMON_TICKS + 2 * TICKS_PER_HOUR);
    expect(w.events('CreatureDied').find((e) => e['id'] === id)).toMatchObject({ cause: 'faded' });
    expect(w.game.world.entities.with(C.Corpse)).toHaveLength(0);
  });
});

describe('T-475 the first summoning answered', () => {
  it('gives m_summon once', () => {
    const w = arena('t475-legend');
    caller(w, 30, 30, 'staff', 'steel');
    cellGoblin(w, 30, 22);
    w.step(600);
    expect(w.events('SummonCalled').length).toBeGreaterThanOrEqual(2);
    expect(w.game.world.fortress.milestones.filter((m) => m.id === 'm_summon')).toHaveLength(1);
  });
});

describe('T-475 turning', () => {
  it('1,000 castings of a deepsilver staff: 50 ± 15 shades turn, each deep, with no caster', () => {
    const w = arena('t475-thousand');
    const mage = caller(w, 30, 30, 'staff', 'deepsilver');
    const entities = w.game.world.entities;
    const held = weaponOf(entities, registry, mage);
    let turned = 0;
    let answered = 0;
    for (let k = 0; k < 1000; k += 1) {
      entities.add(mage, C.Rune, { current: 50_000 });
      expect(castSupport(ctxOf(w), mage, held, mage, host())).toBe(true);
      const id = summoned(w)[0]!;
      const creature = entities.get(id, C.Creature)!;
      expect(creature.species).toBe(species('deep_shade'));
      if (creature.faction === 'deep') {
        turned += 1;
        expect(entities.has(id, C.Tame)).toBe(false);
        expect(entities.get(id, C.Summoned)!.summonerId).toBe(0);
      } else {
        answered += 1;
        expect(entities.get(id, C.Tame)?.assignedTo).toBe(mage);
      }
      entities.destroy(id);
    }
    expect(turned + answered).toBe(1000);
    expect(turned).toBe(TURNED_IN_1000);
    expect(Math.abs(turned - 50)).toBeLessThanOrEqual(15);
  });

  it('a turned shade is Hollow-born, everyone fears it, and a squad of three in iron kills it', () => {
    const w = arena(TURN_SEED);
    const mage = caller(w, 30, 30, 'staff', 'deepsilver');
    cellGoblin(w, 30, 22);
    w.until(() => w.events('SummonTurned').length > 0, 400);
    const shade = w.events('SummonTurned')[0]!['id'] as EntityId;
    w.step(1);
    const entities = w.game.world.entities;
    expect(entities.get(shade, C.Creature)).toMatchObject({ species: species('deep_shade'), faction: 'deep' });
    expect(entities.get(shade, C.Hostile)).toMatchObject({ role: 'hollow', behaviorState: 'attack', partyId: 0 });
    expect(entities.has(shade, C.Tame)).toBe(false);
    expect(w.events('SummonCalled')).toHaveLength(0);
    expect(w.readers.of<MoraleReader>('15').thoughts(mage).map((t) => t.id)).toContain('summon_turned');
    // Three dwarves in iron, beside it.
    const kit = (id: EntityId, at: TileIndex): void => {
      const make = (type: string): EntityId => w.spawnItem(type, 'iron', at, 1, 1);
      const eq = entities.get(id, C.Equipment) as Equipment;
      const next: Equipment = { ...eq, weapon: make('axe'), shield: make('shield'), armor: { ...eq.armor, head: make('helm'), body: make('mail_shirt') } };
      for (const item of [next.weapon, next.shield, next.armor.head, next.armor.body]) {
        w.game.world.services.items!.attachToCarrier(item, id);
        w.game.world.services.items!.setOwner(item, id);
      }
      entities.add(id, C.Equipment, next);
    };
    const p = entities.get(shade, C.Position)!;
    const three = [0, 1, 2].map((k) => w.spawnDwarf({ at: w.index(p.x - 1 + k, p.y + 2, Z), skills: { axe: 4, shield: 3, dodge: 2, armor_use: 2 } }));
    squad(w, three, w.index(p.x, p.y + 2, Z), 'charge');
    three.forEach((id, k) => kit(id, w.index(p.x - 1 + k, p.y + 2, Z)));
    // Measured: it falls in 87 ticks, after three swings that all missed.
    w.until(() => !entities.alive(shade), 600);
    const died = w.events('CreatureDied').find((e) => e['id'] === shade)!;
    expect(died['cause']).not.toBe('faded');
    expect(three.some((id) => died['killerId'] === id)).toBe(true);
    expect(three.every((id) => entities.alive(id))).toBe(true);
    expect(entities.with(C.Corpse).filter((c) => entities.get(c, C.Corpse)?.species === species('deep_shade'))).toHaveLength(0);
  });
});

describe('T-475 wisp mishap', () => {
  it('a wild wisp beside the circle, with no caster, that fades in a day; the apprentice gets no thought', () => {
    const w = new TestWorld({ seed: 't475-wisp', embark: 'none', surfaceWildlife: 'none' });
    const X = 30;
    const Y = 30;
    const DZ = 25;
    w.digRoom(X, Y, DZ, 6, 5);
    for (let y = Y - 1; y <= Y + 5; y += 1) for (let x = X - 1; x <= X + 6; x += 1) w.discover(w.index(x, y, DZ));
    const circleTile = w.index(X + 1, Y + 1, DZ);
    const circle = w.build('rune_circle', circleTile, 'granite');
    const dwarf = w.spawnDwarf({ at: w.index(X, Y, DZ) });
    const zone = w.zone('sanctum', [circleTile, w.index(X, Y, DZ), w.index(X + 1, Y, DZ), w.index(X, Y + 1, DZ)]);
    const producer = w.game.world.registrations.jobProducers.find((p) => p.id === 'magic');
    (producer as unknown as { mishap(kind: string, d: EntityId, c: EntityId, z: EntityId, ctx: TickContext): void }).mishap('wisp_loose', dwarf, circle, zone, ctxOf(w));
    w.step(1);
    const [wisp] = summoned(w);
    const entities = w.game.world.entities;
    expect(entities.get(wisp!, C.Creature)).toMatchObject({ species: species('wisp'), faction: 'wild' });
    expect(entities.has(wisp!, C.Wild)).toBe(true);
    expect(entities.get(wisp!, C.Summoned)).toEqual({ summonerId: 0, fadesAt: w.tick - 1 + SUMMON_TICKS });
    const p = entities.get(wisp!, C.Position)!;
    expect(Math.max(Math.abs(p.x - (X + 1)), Math.abs(p.y - (Y + 1)))).toBe(1);
    expect(w.events('Mishap').at(-1)).toMatchObject({ id: dwarf, kind: 'wisp_loose' });
    expect(w.readers.of<AnimalsReader>('08').wildList()).not.toContain(wisp);
    expect(summonsLine(w.readers, registry, strings, wisp!)).toBe('Fades in 24 hours.');
    w.until(() => !entities.alive(wisp!), SUMMON_TICKS + 2 * TICKS_PER_HOUR);
    expect(w.events('CreatureDied').find((e) => e['id'] === wisp)).toMatchObject({ cause: 'faded' });
    expect(w.readers.of<MoraleReader>('15').thoughts(dwarf).map((t) => t.id)).not.toContain('saw_death');
  });
});
