/**
 * T-472: enchantments act in combat (`25-runecraft.md` § Enchantments in combat). One test per kind,
 * the enchanted ammunition that keeps its stone when it drops, and an unenchanted fight that draws
 * nothing more (the six T-470 arena digests in `t470-no-channel-equivalence.test.ts` pin the rest).
 *
 * Most blows are resolved by hand through `resolveMelee` and `resolveProjectileHit` with a fixed
 * roll, so a hit and its part are chosen by the test and the arithmetic can be read off.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment } from '@core/components';
import type { GameEvent } from '@core/events';
import { makeTable, type Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import type { EntityId, Quality, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { EnchantDef, SpellDef } from '@content/generate';
import {
  armorCovering,
  armorReduction,
  calculateRangedHit,
  fireRanged,
  isFleeing,
  resolveMelee,
  resolveProjectileHit,
  weaponOf,
  type CombatReader,
  type SquadWithId,
} from '@systems/combat';
import { applySpellOnHit } from '@systems/magic/cast';
import { checkSpotted } from '@systems/threats/ai';
import { SPOT_RADIUS } from '@systems/threats/constants';
import { assignHostileSkills } from '@systems/threats/gear';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const enchants = registry.table<EnchantDef>('enchants');

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** Every hit roll (0..99) gives `roll`; every other draw (the part pick among them) its lowest value, so the part is the head. */
function fixedRng(roll = 0): RngStream {
  return { int: (lo: number, hi: number) => (lo === 0 && hi === 99 ? roll : lo), chance: () => false } as unknown as RngStream;
}

function ctxOf(w: TestWorld, events: GameEvent[] = [], rng: RngStream = fixedRng(0), reg: Registry = registry): TickContext {
  return {
    world: w.game.world, registry: reg, rng, tick: w.tick, readers: w.readers,
    emit: (e: GameEvent) => { events.push(e); },
  } as unknown as TickContext;
}

/** An item of `type` in `material`, with the enchantment `enchant` at `tier` (none for ''). */
function item(w: TestWorld, type: string, material: string, at: TileIndex, enchant = '', tier: Quality = 1, count = 1): EntityId {
  const id = w.spawnItem(type, material, at, count, 1);
  if (enchant !== '') {
    const ent = w.game.world.entities;
    ent.add(id, C.Item, { ...ent.get(id, C.Item)!, enchant: { id: enchants.index(enchant), tier } });
  }
  return id;
}

/** Put the items on `id` as its equipment: a weapon and armor by slot. */
function wear(w: TestWorld, id: EntityId, kit: { weapon?: EntityId; head?: EntityId; body?: EntityId }): void {
  const ent = w.game.world.entities;
  const old = ent.get(id, C.Equipment);
  const eq: Equipment = {
    weapon: kit.weapon ?? 0, shield: 0,
    armor: { head: kit.head ?? 0, body: kit.body ?? 0, arms: 0, legs: 0, feet: 0 },
    clothing: old?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 }, quiver: old?.quiver ?? 0,
  };
  for (const it of [eq.weapon, eq.armor.head, eq.armor.body]) {
    if (it !== 0) {
      w.game.world.services.items?.attachToCarrier(it, id);
      w.game.world.services.items?.setOwner(it, id);
    }
  }
  ent.add(id, C.Equipment, eq);
}

/** A dwarf of Strength and Agility 50 with axe 2 holding an iron axe of `enchant`, and a bare goblin beside it. */
function duel(seed: string, enchant = '', tier: Quality = 1, foe = 'gloam_warrior', faction = 'hostile:gloam'): { w: TestWorld; dwarf: EntityId; foe: EntityId } {
  const w = arena(seed);
  const at = w.index(30, 30, Z);
  const dwarf = w.spawnDwarf({ at, skills: { axe: 2 } });
  const ent = w.game.world.entities;
  ent.add(dwarf, C.Attributes, { ...ent.get(dwarf, C.Attributes)!, str: 50, agi: 50 });
  wear(w, dwarf, { weapon: item(w, 'axe', 'iron', at, enchant, tier) });
  const goblin = w.spawnCreature(foe, w.index(31, 30, Z), faction);
  return { w, dwarf, foe: goblin };
}

const dealt = (events: GameEvent[]): GameEvent[] => events.filter((e) => e.type === 'DamageDealt');
const resolved = (events: GameEvent[]): GameEvent[] => events.filter((e) => e.type === 'AttackResolved');

describe('T-472 the weapon\'s kinds in resolveMelee', () => {
  it('to_hit (sure): +10 on the hit sum, from the weapon', () => {
    // Axe 2 against dodge 2 at equal Agility: hit 50. A roll of 50 misses; a sure axe hits at 50 to 59.
    for (const [enchant, roll, outcome] of [['', 49, 'hit'], ['', 50, 'miss'], ['sure', 59, 'hit'], ['sure', 60, 'miss']] as const) {
      const { w, dwarf, foe } = duel(`t472-hit-${enchant}-${roll}`, enchant);
      expect(resolveMelee(ctxOf(w, [], fixedRng(roll)), dwarf, foe, new Map()).outcome).toBe(outcome);
    }
  });

  it('damage_percent (keen): +10% on the raw blow before armor, scaled by tier', () => {
    const blow = (enchant: string, tier: Quality = 1): number => {
      const { w, dwarf, foe } = duel(`t472-keen-${enchant}-${tier}`, enchant, tier);
      expect(armorReduction(w.game.world.entities, registry, foe, 'torso', 'edge', w.tick)).toBe(0);
      return resolveMelee(ctxOf(w), dwarf, foe, new Map(), { forcedPart: 'torso' }).damage;
    };
    // Iron axe at Strength 50: raw 22, Toughness 50 takes 5%.
    expect(blow('')).toBe(Math.round(22 * 0.95));
    expect(blow('keen')).toBe(Math.round(22 * 1.1 * 0.95));
    expect(blow('keen', 5)).toBe(Math.round(22 * 1.15 * 0.95));
  });

  it('vs_deep_percent: added to damage_percent against a creature of the deep faction only (a row, never an id)', () => {
    // The `deep` row arrives with T-476; a row of the same kinds is read the same way.
    const rows = enchants.rows.filter((r): r is EnchantDef => r !== undefined);
    const deepRow: EnchantDef = { id: 't472_deep', slot: 'weapon', stone: 'deepsilver', vials: 12, suffix: 'of the deep',
      effects: [{ kind: 'damage_percent', value: 25, scales: 'none' }, { kind: 'vs_deep_percent', value: 50, scales: 'none' }] };
    const table = makeTable('enchants', [...rows, deepRow], [...rows.map((r) => r.id), deepRow.id]);
    const reg = Object.create(registry, { table: { value: (name: string) => (name === 'enchants' ? table : registry.table(name)) } }) as Registry;
    const blow = (foe: string, faction: string): { damage: number; red: number } => {
      const { w, dwarf, foe: f } = duel(`t472-deep-${foe}`, '', 1, foe, faction);
      const ent = w.game.world.entities;
      const axe = ent.get(dwarf, C.Equipment)!.weapon;
      ent.add(axe, C.Item, { ...ent.get(axe, C.Item)!, enchant: { id: table.index(deepRow.id), tier: 1 } });
      const red = armorReduction(ent, reg, f, 'torso', 'edge', w.tick);
      return { damage: resolveMelee(ctxOf(w, [], fixedRng(0), reg), dwarf, f, new Map(), { forcedPart: 'torso' }).damage, red };
    };
    const goblin = blow('gloam_warrior', 'hostile:gloam');
    expect(goblin.damage).toBe(Math.round(Math.max(0, 22 * 1.25 - goblin.red) * 0.95));
    const stalker = blow('hollow_stalker', 'deep');
    expect(stalker.red).toBeGreaterThan(0);
    expect(stalker.damage).toBe(Math.round(Math.max(0, 22 * 1.75 - stalker.red) * 0.95));
  });

  it('armor_percent (sunder): only that share of the target\'s armor counts', () => {
    const blow = (enchant: string): { damage: number; red: number } => {
      const { w, dwarf, foe } = duel(`t472-sunder-${enchant}`, enchant);
      wear(w, foe, { body: item(w, 'breastplate', 'steel', w.index(31, 30, Z)) });
      const red = armorReduction(w.game.world.entities, registry, foe, 'torso', 'edge', w.tick);
      expect(armorReduction(w.game.world.entities, registry, foe, 'torso', 'edge', w.tick, 50)).toBeCloseTo(red / 2, 9);
      return { damage: resolveMelee(ctxOf(w), dwarf, foe, new Map(), { forcedPart: 'torso' }).damage, red };
    };
    const plain = blow('');
    // Steel breastplate, common: 18 × 1.25 × 1.1 (edge against plate) = 24.75, more than the blow.
    expect(plain.red).toBeCloseTo(24.75, 9);
    expect(plain.damage).toBe(0);
    const sunder = blow('sunder');
    expect(sunder.damage).toBe(Math.round((22 - 24.75 / 2) * 0.95));
  });

  it('extra_damage (embers): a second DamageDealt of its type on the same part, its own armor and Toughness, no second AttackResolved', () => {
    for (const [tier, extra] of [[1, 8], [5, 12]] as const) {
      const { w, dwarf, foe } = duel(`t472-ember-${tier}`, 'ember', tier);
      wear(w, foe, { head: item(w, 'helm', 'iron', w.index(31, 30, Z)) });
      const events: GameEvent[] = [];
      const res = resolveMelee(ctxOf(w, events), dwarf, foe, new Map());
      expect(res).toMatchObject({ outcome: 'hit', part: 'head' });
      const hits = dealt(events);
      expect(hits).toHaveLength(2);
      expect(hits[0]).toMatchObject({ damageType: 'edge', part: 'head' });
      // An iron helm against ember: 8 × 1.0 × 0.8 (plate) = 6.4.
      const red = armorReduction(w.game.world.entities, registry, foe, 'head', 'ember', w.tick);
      expect(red).toBeCloseTo(6.4, 9);
      const axe = w.game.world.entities.get(dwarf, C.Equipment)!.weapon;
      expect(hits[1]).toEqual({ type: 'DamageDealt', defenderId: foe, part: 'head', damageType: 'ember', amount: Math.round((extra - red) * 0.95), attackerId: dwarf, weaponId: axe });
      expect(resolved(events)).toHaveLength(1);
    }
    // A blow the armor takes whole carries nothing.
    const { w, dwarf, foe } = duel('t472-ember-none', 'ember');
    wear(w, foe, { head: item(w, 'helm', 'steel', w.index(31, 30, Z)) });
    const events: GameEvent[] = [];
    expect(resolveMelee(ctxOf(w, events), dwarf, foe, new Map(), { overrideDamage: 1 }).damage).toBe(0);
    expect(dealt(events)).toHaveLength(1);
  });

  it('slow (rime): a slow effect on a hit, unless the target wears slow_immune (rimeward), for a spell too', () => {
    const { w, dwarf, foe } = duel('t472-rime', 'rime');
    resolveMelee(ctxOf(w), dwarf, foe, new Map());
    expect(w.game.world.entities.get(foe, C.Spellbound)?.effects).toEqual([{ kind: 'slow', value: 30, until: w.tick + 200, sourceId: dwarf }]);
    // Masterwork scales the ticks.
    const mw = duel('t472-rime-mw', 'rime', 5);
    resolveMelee(ctxOf(mw.w), mw.dwarf, mw.foe, new Map());
    expect(mw.w.game.world.entities.get(mw.foe, C.Spellbound)?.effects[0]?.until).toBe(mw.w.tick + 300);
    // A goblin in a rimeward helm is never slowed: not by the axe, not by Frostbind.
    const warded = duel('t472-rimeward', 'rime');
    wear(warded.w, warded.foe, { head: item(warded.w, 'helm', 'iron', warded.w.index(31, 30, Z), 'rimeward') });
    const ctx = ctxOf(warded.w);
    expect(resolveMelee(ctx, warded.dwarf, warded.foe, new Map()).outcome).toBe('hit');
    applySpellOnHit(ctx, registry.table<SpellDef>('spells').index('frostbind'), 1000, warded.dwarf, warded.foe, 5);
    expect(warded.w.game.world.entities.has(warded.foe, C.Spellbound)).toBe(false);
    // The same Frostbind slows a goblin without one.
    const bare = warded.w.spawnCreature('gloam_warrior', warded.w.index(32, 30, Z), 'hostile:gloam');
    applySpellOnHit(ctx, registry.table<SpellDef>('spells').index('frostbind'), 1000, warded.dwarf, bare, 5);
    expect(warded.w.game.world.entities.get(bare, C.Spellbound)?.effects).toEqual([{ kind: 'slow', value: 50, until: warded.w.tick + 300, sourceId: warded.dwarf }]);
  });

  it('flee (fearsome): a 25% roll on stream 25, then the resist roll; never on the deep; nothing drawn without it', () => {
    const { w, dwarf, foe } = duel('t472-fear', 'fearsome');
    const ent = w.game.world.entities;
    const before = JSON.stringify(w.game.world.rngFor('25').state());
    let fled = 0;
    const N = 400;
    for (let i = 0; i < N; i += 1) {
      ent.remove(foe, C.Spellbound);
      resolveMelee(ctxOf(w), dwarf, foe, new Map());
      const e = ent.get(foe, C.Spellbound)?.effects;
      if (e !== undefined) {
        expect(e).toEqual([{ kind: 'flee', value: 1, until: w.tick + 200, sourceId: dwarf }]);
        fled += 1;
      }
    }
    // 25% of hits, then a goblin with no attributes resists 25%: 18.75% of 400 = 75.
    expect(fled).toBeGreaterThan(50);
    expect(fled).toBeLessThan(100);
    expect(JSON.stringify(w.game.world.rngFor('25').state())).not.toBe(before);
    expect(isFleeing(ent, foe, w.tick)).toBe(fled > 0 && ent.has(foe, C.Spellbound));

    // A creature of the deep is never sent running, and no number is drawn for it.
    const deep = duel('t472-fear-deep', 'fearsome', 1, 'hollow_stalker', 'deep');
    const deepBefore = JSON.stringify(deep.w.game.world.rngFor('25').state());
    for (let i = 0; i < 50; i += 1) resolveMelee(ctxOf(deep.w), deep.dwarf, deep.foe, new Map());
    expect(deep.w.game.world.entities.has(deep.foe, C.Spellbound)).toBe(false);
    expect(JSON.stringify(deep.w.game.world.rngFor('25').state())).toBe(deepBefore);

    // A plain axe draws nothing on stream 25 either.
    const plain = duel('t472-fear-plain');
    const plainBefore = JSON.stringify(plain.w.game.world.rngFor('25').state());
    for (let i = 0; i < 50; i += 1) resolveMelee(ctxOf(plain.w), plain.dwarf, plain.foe, new Map());
    expect(JSON.stringify(plain.w.game.world.rngFor('25').state())).toBe(plainBefore);
  });
});

describe('T-472 worked numbers (25 § Spells, the damage table)', () => {
  it.each([
    ['axe', 'iron', 1, 'ember', 1, 21, 8],
    ['great_axe', 'deepsilver', 5, 'keen', 5, 79, 0],
    ['great_axe', 'deepsilver', 5, 'blaze', 5, 68, 20],
  ] as const)('%s of %s (quality %i), %s at tier %i, on a bare part: %i and %i ember', (type, material, quality, enchant, tier, blow, ember) => {
    const w = arena(`t472-worked-${type}-${enchant}`);
    const at = w.index(30, 30, Z);
    const dwarf = w.spawnDwarf({ at, skills: { axe: 2 } });
    const ent = w.game.world.entities;
    ent.add(dwarf, C.Attributes, { ...ent.get(dwarf, C.Attributes)!, str: 50, agi: 50 });
    const weapon = w.spawnItem(type, material, at, 1, quality);
    ent.add(weapon, C.Item, { ...ent.get(weapon, C.Item)!, enchant: { id: enchants.index(enchant), tier } });
    wear(w, dwarf, { weapon });
    const foe = w.spawnCreature('gloam_warrior', w.index(31, 30, Z), 'hostile:gloam');
    const events: GameEvent[] = [];
    resolveMelee(ctxOf(w, events), dwarf, foe, new Map(), { forcedPart: 'torso' });
    expect(dealt(events).map((e) => e['amount'])).toEqual(ember === 0 ? [blow] : [blow, ember]);
    // Steel keeps the top of the table: the best staff does 49.
    expect(blow + ember).toBeGreaterThan(type === 'axe' ? 0 : 49);
  });
});

describe('T-472 the armor\'s kinds', () => {
  it('armor (stout): adds to the piece\'s own armor, scaled by tier, so armorReduction and the inspector follow', () => {
    const w = arena('t472-stout');
    const at = w.index(30, 30, Z);
    const foe = w.spawnCreature('gloam_warrior', at, 'hostile:gloam');
    const piece = (enchant: string, tier: Quality): number => {
      wear(w, foe, { body: item(w, 'breastplate', 'steel', at, enchant, tier) });
      expect(armorCovering(w.game.world.entities, registry, foe, 'torso')[0]?.armor).toBe(18 + (enchant === '' ? 0 : tier === 5 ? 3 : 2));
      return armorReduction(w.game.world.entities, registry, foe, 'torso', 'edge', w.tick);
    };
    expect(piece('', 1)).toBeCloseTo(18 * 1.25 * 1.1, 9);
    expect(piece('stout', 1)).toBeCloseTo(20 * 1.25 * 1.1, 9);
    expect(piece('stout', 5)).toBeCloseTo(21 * 1.25 * 1.1, 9);
    expect(w.readers.of<CombatReader>('16').armorValue(foe, 'torso', 'edge')).toBeCloseTo(21 * 1.25 * 1.1, 9);
  });

  function missile(seed: string, helm: string, type: 'ember' | 'burn' | 'frost' | 'edge', raw = 30): { dealt: number; red: number; part: string | null } {
    const w = arena(seed);
    const at = w.index(30, 30, Z);
    const shooter = w.spawnDwarf({ at: w.index(20, 30, Z) });
    const foe = w.spawnCreature('gloam_warrior', at, 'hostile:gloam');
    wear(w, foe, { head: item(w, 'helm', 'iron', at, helm) });
    const red = armorReduction(w.game.world.entities, registry, foe, 'head', type, w.tick);
    const out = { part: null as string | null };
    const def = { skill: 'crossbow', size: 6 } as unknown as NonNullable<ReturnType<typeof weaponOf>>['weaponDef'];
    const d = resolveProjectileHit(ctxOf(w), w.game.world.entities, registry, fixedRng(0), shooter, foe, raw, type as never, def, { skipXp: true, out: out as never });
    return { dealt: d, red, part: out.part };
  }

  it('fire_percent (emberward): half of an ember hit or the wyrm\'s burn through a covering piece; steel and frost pass as before', () => {
    for (const type of ['ember', 'burn'] as const) {
      const plain = missile(`t472-fire-${type}`, '', type);
      const warded = missile(`t472-fire-${type}-w`, 'emberward', type);
      expect(warded.part).toBe('head');
      expect(warded.red).toBeCloseTo(plain.red, 9);
      expect(plain.dealt).toBe(Math.round((30 - plain.red) * 0.95));
      expect(warded.dealt).toBe(Math.round((30 - plain.red) * 0.5 * 0.95));
    }
    expect(missile('t472-fire-edge-w', 'emberward', 'edge').dealt).toBe(missile('t472-fire-edge', '', 'edge').dealt);
    expect(missile('t472-fire-frost-w', 'emberward', 'frost').dealt).toBe(missile('t472-fire-frost', '', 'frost').dealt);
  });

  it('frost_percent (rimeward): half of a frost hit through a covering piece', () => {
    const plain = missile('t472-frost', '', 'frost');
    const warded = missile('t472-frost-w', 'rimeward', 'frost');
    expect(plain.dealt).toBe(Math.round((30 - plain.red) * 0.95));
    expect(warded.dealt).toBe(Math.round((30 - plain.red) * 0.5 * 0.95));
    expect(missile('t472-frost-ember-w', 'rimeward', 'ember').dealt).toBe(missile('t472-frost-ember', '', 'ember').dealt);
  });

  it('spot_radius (glowing): a worn piece adds its tiles to how far a dwarf spots a hidden creature', () => {
    const w = arena('t472-glow');
    const dwarf = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const ctx = ctxOf(w);
    const spots = (dx: number): boolean => checkSpotted(0, w.index(30 + dx, 30, Z), ctx);
    expect([spots(SPOT_RADIUS), spots(SPOT_RADIUS + 1)]).toEqual([true, false]);
    wear(w, dwarf, { body: item(w, 'breastplate', 'iron', w.index(30, 30, Z), 'glowing') });
    expect([spots(SPOT_RADIUS + 2), spots(SPOT_RADIUS + 3)]).toEqual([true, false]);
    // The largest piece counts, not the sum.
    wear(w, dwarf, { body: item(w, 'breastplate', 'iron', w.index(30, 30, Z), 'glowing'), head: item(w, 'helm', 'iron', w.index(30, 30, Z), 'glowing') });
    expect(spots(SPOT_RADIUS + 3)).toBe(false);
  });
});

describe('T-472 enchanted ammunition', () => {
  /** A crossbowman with `count` bolts of `enchant` in its quiver, and a goblin ten tiles away. */
  function range(seed: string, enchant: string, count = 25): { w: TestWorld; dwarf: EntityId; foe: EntityId } {
    const w = arena(seed);
    const at = w.index(40, 40, Z);
    const dwarf = w.spawnDwarf({ at, skills: { crossbow: 6 } });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
    const s = w.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members: [dwarf] });
    w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged: true } });
    w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: at });
    w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
    w.step(1);
    wear(w, dwarf, { weapon: item(w, 'crossbow', 'oak', at) });
    const bolts = item(w, 'bolt', 'iron', at, enchant, 1, count);
    w.game.world.services.items?.attachToCarrier(bolts, dwarf);
    w.game.world.services.items?.setOwner(bolts, dwarf);
    w.game.world.entities.add(dwarf, C.Equipment, { ...w.game.world.entities.get(dwarf, C.Equipment)!, quiver: bolts });
    const foe = w.spawnCreature('gloam_warrior', w.index(40, 50, Z), 'hostile:gloam');
    assignHostileSkills(w.game.world.entities, registry, foe, 1, false);
    return { w, dwarf, foe };
  }

  it('to_hit (seeking): +10 on the shot\'s hit chance, from the ammunition', () => {
    for (const [enchant, offset, hitRoll] of [['', 0, 0], ['seeking', 0, 1], ['seeking', 10, 0]] as const) {
      const { w, dwarf, foe } = range(`t472-seek-${enchant}-${offset}`, enchant);
      const base = calculateRangedHit(w.game.world.entities, registry, dwarf, foe, 'crossbow', 10);
      expect(fireRanged(ctxOf(w, [], fixedRng(base + offset)), dwarf, foe, new Map())).toBe(true);
      const proj = w.game.world.entities.with(C.Projectile).map((p) => w.game.world.entities.get(p, C.Projectile)!);
      expect(proj).toHaveLength(1);
      expect(proj[0]?.hitRoll).toBe(hitRoll);
      // The unit in flight keeps the stone.
      expect(w.game.world.entities.get(proj[0]!.itemId, C.Item)?.enchant === undefined).toBe(enchant === '');
    }
  });

  it('extra_damage and slow from bolts: the effect acts at the hit, and a bolt that drops keeps its stone', () => {
    for (const enchant of ['ember_ammo', 'rime_ammo'] as const) {
      const { w, dwarf, foe } = range(`t472-ammo-${enchant}`, enchant);
      w.game.world.services.combat?.setTarget(dwarf, foe);
      const shot = (): GameEvent[] => w.events('DamageDealt').filter((e) => e['attackerId'] === dwarf);
      w.until(() => shot().some((e) => e['damageType'] === 'pierce' && Number(e['amount']) > 0) && w.events('ProjectileFired').length >= 6, 3000);
      const hits = shot();
      if (enchant === 'ember_ammo') {
        // Each bolt that wounded is followed by its ember, on the same part.
        hits.forEach((e, i) => {
          if (e['damageType'] !== 'pierce' || Number(e['amount']) <= 0) return;
          expect(hits[i + 1]).toMatchObject({ damageType: 'ember', part: e['part'], defenderId: foe });
        });
        expect(hits.filter((e) => e['damageType'] === 'ember').length).toBeGreaterThan(0);
      } else {
        expect(w.game.world.entities.get(foe, C.Spellbound)?.effects.some((e) => e.kind === 'slow' && e.value === 30 && e.sourceId === dwarf)).toBe(true);
      }
      expect(w.events('AttackResolved').filter((e) => e['attackerId'] === dwarf && e['outcome'] === 'hit')).toHaveLength(hits.filter((e) => e['damageType'] === 'pierce').length);
      // Every bolt left in the world, carried or dropped, still carries its stone; some were dropped.
      const bolt = registry.table('items').index('bolt');
      const bolts = w.game.world.entities.with(C.Item).map((id) => w.game.world.entities.get(id, C.Item)!).filter((it) => it.type === bolt);
      expect(bolts.every((it) => it.enchant?.id === enchants.index(enchant))).toBe(true);
      expect(bolts.some((it) => it.carriedBy !== dwarf)).toBe(true);
    }
  });
});
