/**
 * T-474: draughts (`25-runecraft.md` § Draughts, § Effects, § Morale; `items.md` § Draughts;
 * `workshops-and-recipes.md` § Laboratory › Draughts).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, type Equipment } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { effectValue, hastedTicks, immuneToBurn } from '@core/effects';
import type { TickContext } from '@core/system';
import { BODY_SLOTS, type EntityId, type TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import { resolveMelee, resolveProjectileHit, weaponOf, type CombatReader, type SquadWithId, type WieldedWeapon } from '@systems/combat';
import { checkSpotted } from '@systems/threats/ai';
import { SPOT_RADIUS } from '@systems/threats/constants';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { MagicReader } from '@systems/magic';
import {
  ALCHEMY_MISHAP_PERMILLE,
  CALM_REST_DAYS,
  DRAUGHT_REST_DAYS,
  DRAUGHT_TICKS,
  DRINK_TICKS,
} from '@systems/magic/constants';
import { addEffect, drinkVial } from '@systems/magic/cast';
import { drinkDraught } from '@systems/magic/draughts';
import type { MoraleReader } from '@systems/morale/reader';
import { MOOD_NEEDS_MET_FLOOR } from '@systems/morale/mood';
import { draughtRestLine, effectsLine } from '@ui/panels/look';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const strings = new Strings(registry);

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld): TickContext {
  return {
    world: w.game.world, registry, tick: w.tick, readers: w.readers,
    rng: w.game.world.rngFor('16'),
    emit: (e: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(e),
  } as unknown as TickContext;
}

function squad(w: TestWorld, members: EntityId[], station: TileIndex, draughts?: string[]): SquadWithId {
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: station });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  if (draughts !== undefined) {
    expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { draughts } }).ok).toBe(true);
  }
  w.step(1);
  return s;
}

/** Keep every dwarf fed, watered and rested, and its blood up, so a wounded soldier outlives a long wait. */
function rest(w: TestWorld): void {
  for (const id of w.game.world.entities.with(C.Needs)) {
    for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(id, need, 0);
    const body = w.game.world.entities.get(id, C.Body);
    if (body !== undefined) body.blood = body.maxBlood;
  }
}

/** Step `n` ticks keeping everyone fed and rested. */
function stepRested(w: TestWorld, n: number): void {
  for (let k = 0; k < n; k += TICKS_PER_HOUR) {
    rest(w);
    w.step(Math.min(TICKS_PER_HOUR, n - k));
  }
}

function carried(w: TestWorld, id: EntityId, itemId: string): number {
  const type = registry.table('items').index(itemId);
  const entities = w.game.world.entities;
  return entities.with(C.Item).map((i) => entities.get(i, C.Item)!).filter((i) => i.type === type && i.carriedBy === id).reduce((n, i) => n + i.count, 0);
}

function drunk(w: TestWorld, id: EntityId): string[] {
  return w.events('DraughtDrunk').filter((e) => e['id'] === id).map((e) => e['draughtId'] as string);
}

/** A soldier on duty hit while below half blood: the `wounded` trigger. */
function hitBelowHalf(w: TestWorld, id: EntityId): void {
  const body = w.game.world.entities.get(id, C.Body)!;
  body.blood = Math.floor(body.maxBlood / 2) - 1;
  w.game.world.emit({ type: 'AttackResolved', attackerId: 0, defenderId: id, targetId: id, part: 'torso', damageType: 'edge', amount: 1, outcome: 'hit' });
  // The drink's own events are dispatched with the next tick's batch.
  w.step(2);
}

describe('T-474 content', () => {
  it('four brewed draughts and the murky one, each a draught item; the draughts table holds what they do', () => {
    const items = registry.table<{ id: string; category: string; stack: number; quality: boolean; tags?: string[]; drinkable?: boolean; glyph: string }>('items');
    for (const id of ['mending_draught', 'stout_draught', 'quick_draught', 'calm_draught']) {
      expect(items.byId(id), id).toMatchObject({ category: 'medical/draught', stack: 5, quality: true, tags: ['draught'], glyph: '!' });
      expect(items.byId(id)?.drinkable).toBeUndefined();
    }
    expect(items.byId('murky_draught')).toMatchObject({ category: 'medical/draught', quality: false, tags: ['draught'] });
    const draughts = registry.table<{ id: string; effects: { kind: string; value: number }[]; trigger: string }>('draughts');
    expect(draughts.byId('mending_draught')).toEqual({ id: 'mending_draught', effects: [{ kind: 'mend', value: 1 }, { kind: 'heal_rate', value: 200 }], trigger: 'wounded' });
    expect(draughts.byId('stout_draught')?.effects).toEqual([{ kind: 'pain_half', value: 1 }]);
    expect(draughts.byId('quick_draught')?.effects).toEqual([{ kind: 'haste', value: 25 }]);
    expect(draughts.byId('calm_draught')).toMatchObject({ effects: [{ kind: 'ease', value: 1 }], trigger: 'miserable' });
    expect(draughts.byId('murky_draught')).toMatchObject({ effects: [], trigger: 'never' });
    const recipes = registry.table<{ id: string; workshop: string; baseTicks: number; xp: number; quality: boolean; spoilable?: boolean; outputs: { item: string; count: number }[] }>('recipes');
    for (const d of ['mending', 'stout', 'quick', 'calm']) {
      expect(recipes.byId(`brew_${d}_draught`), d).toMatchObject({ workshop: 'alchemist', baseTicks: 150, xp: 8, quality: true, spoilable: true });
      expect(recipes.byId(`brew_${d}_draught`)?.outputs).toMatchObject([{ item: `${d}_draught`, count: 2 }]);
    }
    expect(recipes.byId('distill_rune')?.spoilable).toBeUndefined();
    expect(registry.table<{ id: string }>('recipes').ids().slice(-4)).toEqual(['brew_mending_draught', 'brew_stout_draught', 'brew_quick_draught', 'brew_calm_draught']);
    expect(registry.table<{ id: string; labor: string; baseTicks: number; producer: string }>('jobTypes').byId('give_draught'))
      .toMatchObject({ labor: 'medicine', baseTicks: 30, producer: 'magic' });
    const thoughts = registry.table<{ id: string; value: number; hours: number; decay: string }>('thoughts');
    expect(thoughts.byId('eased')).toMatchObject({ value: 8, hours: 72, decay: 'linear' });
    expect([DRAUGHT_TICKS, DRAUGHT_REST_DAYS, CALM_REST_DAYS, ALCHEMY_MISHAP_PERMILLE]).toEqual([1200, 3, 7, 100]);
  });

  it('SetSquadEquipment takes an ordered list of draughts a soldier drinks, and refuses the rest', () => {
    const w = arena('t474-list');
    const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const s = squad(w, [id], w.index(10, 10, Z));
    const set = (draughts: unknown): boolean => w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { draughts } }).ok;
    expect(set(['quick_draught', 'stout_draught'])).toBe(true);
    expect(w.readers.of<CombatReader>('16').squads()[0]?.equipment.draughts).toEqual(['quick_draught', 'stout_draught']);
    // Another preference keeps the list.
    expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { armor: 'metal' } }).ok).toBe(true);
    expect(w.readers.of<CombatReader>('16').squads()[0]?.equipment.draughts).toEqual(['quick_draught', 'stout_draught']);
    for (const bad of [['murky_draught'], ['calm_draught'], ['rune_vial'], ['stout_draught', 'stout_draught'], 'stout_draught', [3]]) expect(set(bad), JSON.stringify(bad)).toBe(false);
    expect(set([])).toBe(true);
    // An empty list is no list: the squad saves as one that never had one.
    expect(w.readers.of<CombatReader>('16').squads()[0]?.equipment).toEqual({ weaponClass: 'any', armor: 'metal', ranged: false });
  });
});

describe('T-474 one draught, then rest', () => {
  it('a soldier who drank stoutness drinks nothing else for 3 days whatever triggers, and a medic gives it nothing', () => {
    const w = arena('t474-rest');
    const post = w.index(10, 10, Z);
    for (const d of ['stout_draught', 'quick_draught', 'mending_draught']) w.spawnItem(d, 'rune', w.index(12, 12, Z), 5, 1);
    const id = w.spawnDwarf({ at: post });
    squad(w, [id], post, ['stout_draught', 'quick_draught', 'mending_draught']);
    // Re-equip claimed one of each, splitting the stacks.
    expect(['stout_draught', 'quick_draught', 'mending_draught'].map((d) => carried(w, id, d))).toEqual([1, 1, 1]);
    const medic = w.spawnDwarf({ at: w.index(14, 10, Z), skills: { medicine: 5 } });
    w.setLabor(medic, 'medicine', true);
    w.spawnItem('bandage', 'flax_cloth', w.index(14, 12, Z), 5);

    w.game.world.emit({ type: 'RaidArrived', partyId: 0, kind: 'raid', size: 1 });
    w.step(2);
    // The first listed `raid` draught; quickness is listed too, but one draught is all.
    expect(drunk(w, id)).toEqual(['stout_draught']);
    expect(carried(w, id, 'stout_draught')).toBe(0);
    expect(effectValue(w.game.world.entities, id, 'pain_half', w.tick)).toBe(1);
    const drankAt = w.game.world.entities.get(id, C.Spellbound)!.lastDraughtTick!;

    w.game.world.emit({ type: 'AmbushSprung', partyId: 0 });
    hitBelowHalf(w, id);
    expect(drunk(w, id)).toEqual(['stout_draught']);
    const body = w.game.world.entities.get(id, C.Body)!;
    body.blood = body.maxBlood;
    // Hurt badly (a broken leg) and admitted, with a draught of mending in stock: no medic brings one in the rest.
    const leg = w.game.world.entities.get(id, C.Body)!.parts[BODY_SLOTS.indexOf('left_leg')]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: id, part: 'left_leg', damageType: 'blunt', amount: Math.ceil(leg.maxHp * 0.35), attackerId: 0, weaponId: 0 });
    stepRested(w, 2 * TICKS_PER_HOUR);
    expect(w.game.world.entities.has(id, C.Patient)).toBe(true);
    expect(w.readers.of<JobsReader>('11').byKey(`give_draught:${id}`)).toBeUndefined();
    expect(w.readers.of<MagicReader>('25').draughtRest(id)).toBe(drankAt + DRAUGHT_REST_DAYS * TICKS_PER_DAY - w.tick);
    expect(draughtRestLine(w.readers, strings, id)).toBe('Can take a draught again in 3 days.');

    // The pain effect lapses after a day; the rest keeps `Spellbound` on.
    stepRested(w, drankAt + DRAUGHT_TICKS + TICKS_PER_HOUR - w.tick);
    expect(w.game.world.entities.get(id, C.Spellbound)?.effects).toEqual([]);
    expect(w.game.world.entities.get(id, C.Spellbound)?.lastDraughtTick).toBe(drankAt);
    let given = false;
    while (w.tick < drankAt + DRAUGHT_REST_DAYS * TICKS_PER_DAY - 1) {
      stepRested(w, Math.min(TICKS_PER_HOUR, drankAt + DRAUGHT_REST_DAYS * TICKS_PER_DAY - 1 - w.tick));
      if (w.readers.of<JobsReader>('11').byKey(`give_draught:${id}`) !== undefined) given = true;
    }
    expect(w.game.world.entities.alive(id)).toBe(true);
    expect(w.game.world.entities.has(id, C.Patient)).toBe(true);
    expect(given).toBe(false);
    expect(drunk(w, id)).toEqual(['stout_draught']);
    expect(w.events('JobCreated').some((e) => e['jobType'] === 'give_draught')).toBe(false);
    // Once the rest is over, the same patient is brought one.
    stepRested(w, 3 * TICKS_PER_HOUR);
    expect(w.events('JobCreated').some((e) => e['jobType'] === 'give_draught' && e['target'] === id)).toBe(true);
  });

  it('after the rest a hit below half blood draws its draught of mending: wounds closed and healing doubled; the component goes when the rest ends', () => {
    const w = arena('t474-mend');
    const post = w.index(10, 10, Z);
    w.spawnItem('mending_draught', 'rune', w.index(12, 12, Z), 1, 3);
    const id = w.spawnDwarf({ at: post });
    squad(w, [id], post, ['mending_draught']);
    // A hit above half blood is no trigger.
    w.game.world.emit({ type: 'AttackResolved', attackerId: 0, defenderId: id, targetId: id, part: 'torso', damageType: 'edge', amount: 1, outcome: 'hit' });
    w.step(2);
    expect(drunk(w, id)).toEqual([]);
    w.game.world.emit({ type: 'DamageDealt', defenderId: id, part: 'left_leg', damageType: 'edge', amount: 14, attackerId: 0, weaponId: 0 });
    w.step(1);
    expect(w.game.world.entities.get(id, C.Body)!.parts.some((p) => p.wounds.some((x) => x.bleed > 0 && !x.bandaged))).toBe(true);
    hitBelowHalf(w, id);
    expect(drunk(w, id)).toEqual(['mending_draught']);
    expect(w.events('Mended').filter((e) => e['id'] === id)).toHaveLength(1);
    expect(w.game.world.entities.get(id, C.Body)!.parts.some((p) => p.wounds.some((x) => x.bleed > 0 && !x.bandaged))).toBe(false);
    // Quality 3 (superior): the duration is DRAUGHT_TICKS × its multiplier.
    const effect = w.game.world.entities.get(id, C.Spellbound)!.effects[0]!;
    expect(effect.kind).toBe('heal_rate');
    expect(effect.value).toBe(200);
    const at = w.game.world.entities.get(id, C.Spellbound)!.lastDraughtTick!;
    expect(effect.until - at).toBe(Math.round(DRAUGHT_TICKS * 1.2));
    const body = w.game.world.entities.get(id, C.Body)!;
    body.blood = body.maxBlood;
    stepRested(w, at + DRAUGHT_REST_DAYS * TICKS_PER_DAY + TICKS_PER_HOUR - w.tick);
    expect(w.game.world.entities.has(id, C.Spellbound)).toBe(false);
  });

  it('with nothing listed in the squad panel, no draught is claimed or drunk', () => {
    const w = arena('t474-none');
    const post = w.index(10, 10, Z);
    w.spawnItem('stout_draught', 'rune', w.index(12, 12, Z), 5, 1);
    const id = w.spawnDwarf({ at: post });
    squad(w, [id], post);
    expect(carried(w, id, 'stout_draught')).toBe(0);
    // Even one carried by hand is not drunk: only a listed draught is.
    const own = w.spawnItem('stout_draught', 'rune', post, 1, 1);
    w.game.world.services.items!.attachToCarrier(own, id);
    w.game.world.emit({ type: 'RaidArrived', partyId: 0, kind: 'raid', size: 1 });
    hitBelowHalf(w, id);
    expect(w.events('DraughtDrunk')).toHaveLength(0);
    expect(w.game.world.entities.has(id, C.Spellbound)).toBe(false);
  });

  it('a medic brings a draught of mending to a badly hurt patient whose rest allows', () => {
    const w = arena('t474-medic');
    w.spawnItem('mending_draught', 'rune', w.index(12, 12, Z), 1, 1);
    const patient = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const medic = w.spawnDwarf({ at: w.index(14, 10, Z), skills: { medicine: 5 } });
    w.setLabor(medic, 'medicine', true);
    w.game.world.emit({ type: 'DamageDealt', defenderId: patient, part: 'left_leg', damageType: 'edge', amount: 14, attackerId: 0, weaponId: 0 });
    w.step(2);
    expect(w.readers.of<JobsReader>('11').byKey(`give_draught:${patient}`)).toBeDefined();
    w.until((x) => x.events('DraughtDrunk').length > 0, 2000);
    rest(w);
    expect(w.events('DraughtDrunk')).toMatchObject([{ id: patient, draughtId: 'mending_draught' }]);
    expect(w.events('Mended').filter((e) => e['id'] === patient)).toHaveLength(1);
  });
});

describe('T-474 calming draughts', () => {
  it('a calming draught gives eased and starts the rests; the mood floor holds', () => {
    const w = arena('t474-calm');
    const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const calm = (): EntityId => w.spawnItem('calm_draught', 'rune', w.index(10, 10, Z), 1, 1);
    const thoughts = (): string[] => w.readers.of<MoraleReader>('15').thoughts(id).map((t) => t.id);
    expect(drinkDraught(ctxOf(w), id, calm())).toBe(true);
    stepRested(w, TICKS_PER_HOUR);
    expect(w.events('DraughtDrunk')).toMatchObject([{ id, draughtId: 'calm_draught', calm: true }]);
    expect(thoughts()).toContain('eased');
    expect(w.readers.of<MoraleReader>('15').mood(id)).toBeGreaterThanOrEqual(MOOD_NEEDS_MET_FLOOR);
    const bound = w.game.world.entities.get(id, C.Spellbound)!;
    expect(bound.lastCalmTick).toBe(bound.lastDraughtTick);
    // Within the three-day rest, nothing.
    expect(drinkDraught(ctxOf(w), id, calm())).toBe(false);
    // The calming rest outlasts the draught rest, and the component with it; then both are gone.
    stepRested(w, DRAUGHT_REST_DAYS * TICKS_PER_DAY + TICKS_PER_HOUR);
    expect(w.game.world.entities.get(id, C.Spellbound)).toMatchObject({ lastCalmTick: bound.lastCalmTick });
    expect(w.game.world.entities.get(id, C.Spellbound)?.lastDraughtTick).toBeUndefined();
    stepRested(w, (CALM_REST_DAYS - DRAUGHT_REST_DAYS) * TICKS_PER_DAY);
    expect(w.game.world.entities.has(id, C.Spellbound)).toBe(false);
    expect(registry.table('thoughts').has('dosed_again')).toBe(false);
  });

  it('a medic gives a calming draught to a Miserable dwarf on the day, only once the longer rest allows', () => {
    const w = arena('t474-calm-medic');
    w.spawnItem('calm_draught', 'rune', w.index(12, 12, Z), 2, 1);
    const sad = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const medic = w.spawnDwarf({ at: w.index(14, 10, Z), skills: { medicine: 5 } });
    w.setLabor(medic, 'medicine', true);
    const misery = (): void => {
      const mood = w.game.world.entities.get(sad, C.Mood)!;
      w.game.world.entities.add(sad, C.Mood, { ...mood, value: 10, tier: 0 });
    };
    // Not Miserable at the day's turn: no job.
    stepRested(w, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY) + 2);
    expect(w.events('JobCreated').some((e) => e['jobType'] === 'give_draught')).toBe(false);
    // Miserable through the next turn of the day.
    const next = w.tick - (w.tick % TICKS_PER_DAY) + TICKS_PER_DAY;
    while (w.tick < next + 2) { misery(); rest(w); w.step(1); }
    expect(w.readers.of<JobsReader>('11').byKey(`give_draught:${sad}`)).toBeDefined();
    for (let k = 0; k < 2000 && w.events('DraughtDrunk').length === 0; k += 1) { misery(); rest(w); w.step(1); }
    expect(w.events('DraughtDrunk')).toMatchObject([{ id: sad, draughtId: 'calm_draught', calm: true }]);
    // Still Miserable at the next days' turns, within the seven days: none is given.
    const drank = w.tick;
    while (w.tick < drank + 5 * TICKS_PER_DAY) { misery(); rest(w); w.step(1); }
    expect(w.events('JobCreated').filter((e) => e['jobType'] === 'give_draught')).toHaveLength(1);
  });
});

describe('T-474 effects', () => {
  it('haste shortens the melee, missile, cast and drink waits by × 100 / (100 + haste)', () => {
    expect(hastedTicks({ get: () => undefined }, 1, 26, 0)).toBe(26);
    const w = arena('t474-haste');
    const a = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const b = w.spawnCreature('gloam_warrior', w.index(11, 10, Z), 'hostile:gloam');
    const cooldowns = new Map<EntityId, number>();
    resolveMelee(ctxOf(w), a, b, cooldowns);
    const plain = (cooldowns.get(a) ?? 0) - w.tick;
    addEffect(w.game.world.entities, a, { kind: 'haste', value: 25, until: w.tick + 100, sourceId: a });
    resolveMelee(ctxOf(w), a, b, cooldowns);
    expect((cooldowns.get(a) ?? 0) - w.tick).toBe(Math.max(1, Math.floor((plain * 100) / 125)));
    // A drink waits DRINK_TICKS under haste the same way: a hastened caster below cost drinks a vial.
    expect(hastedTicks(w.game.world.entities, a, DRINK_TICKS, w.tick)).toBe(24);
    const caster = w.spawnDwarf({ at: w.index(10, 14, Z), skills: { runecraft: 10 } });
    w.game.world.entities.add(caster, C.Rune, { current: 0 });
    const wand = w.spawnItem('wand', 'oak', w.index(10, 14, Z), 1, 1);
    w.game.world.entities.add(wand, C.Item, { ...w.game.world.entities.get(wand, C.Item)!, stone: registry.table('materials').index('garnet') });
    const vial = w.spawnItem('rune_vial', 'rune', w.index(10, 14, Z), 1, 1);
    for (const it of [wand, vial]) w.game.world.services.items!.attachToCarrier(it, caster);
    w.game.world.entities.add(caster, C.Equipment, { ...(w.game.world.entities.get(caster, C.Equipment) as Equipment), weapon: wand });
    addEffect(w.game.world.entities, caster, { kind: 'haste', value: 25, until: w.tick + 100, sourceId: caster });
    const waits = new Map<EntityId, number>();
    expect(drinkVial(ctxOf(w), caster, weaponOf(w.game.world.entities, registry, caster), waits)).toBe(true);
    expect((waits.get(caster) ?? 0) - w.tick).toBe(24);
  });

  it('stoutness halves pain; mending doubles healing; fire_immune turns a burn to nothing; spot_radius sees farther', () => {
    const w = arena('t474-effects');
    const a = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const b = w.spawnDwarf({ at: w.index(10, 12, Z) });
    for (const id of [a, b]) {
      w.game.world.emit({ type: 'DamageDealt', defenderId: id, part: 'left_arm', damageType: 'blunt', amount: 3, attackerId: 0, weaponId: 0 });
    }
    w.step(1);
    addEffect(w.game.world.entities, a, { kind: 'pain_half', value: 1, until: w.tick + 1000, sourceId: a });
    addEffect(w.game.world.entities, a, { kind: 'heal_rate', value: 200, until: w.tick + 1000, sourceId: a });
    const remaining = (id: EntityId): number => w.game.world.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds)[0]?.healRemaining ?? 0;
    const before = [remaining(a), remaining(b)];
    w.step(10);
    const pain = (id: EntityId): number => w.game.world.entities.get(id, C.Body)!.pain;
    expect(pain(b)).toBeGreaterThan(0);
    expect(pain(a)).toBeLessThan(pain(b));
    expect((before[0]! - remaining(a))).toBeCloseTo(2 * (before[1]! - remaining(b)), 6);

    const g = w.spawnCreature('gloam_warrior', w.index(20, 20, Z), 'hostile:gloam');
    const weaponDef = { skill: 'runecraft', size: 0 } as unknown as WieldedWeapon['weaponDef'];
    addEffect(w.game.world.entities, g, { kind: 'fire_immune', value: 1, until: w.tick + 1000, sourceId: g });
    expect(immuneToBurn(w.game.world.entities, g, 'ember', w.tick)).toBe(true);
    expect(immuneToBurn(w.game.world.entities, g, 'edge', w.tick)).toBe(false);
    for (let k = 0; k < 10; k += 1) expect(resolveProjectileHit(ctxOf(w), w.game.world.entities, registry, w.game.world.rngFor('16'), a, g, 40, 'ember', weaponDef)).toBe(0);

    // A hostile beyond SPOT_RADIUS is spotted only by a dwarf with a wider `spot_radius`.
    const far = w.index(10 + SPOT_RADIUS + 3, 10, Z);
    expect(checkSpotted(g, far, ctxOf(w))).toBe(false);
    addEffect(w.game.world.entities, a, { kind: 'spot_radius', value: 10, until: w.tick + 1000, sourceId: a });
    expect(checkSpotted(g, far, ctxOf(w))).toBe(true);
    expect(effectsLine(w.readers, strings, a)).toContain('spots within 10 tiles');
  });
});

describe('T-474 spoiled batches', () => {
  /** Run one batch of `recipe` at a laboratory by an alchemist of `skill`; `spoil` forces the roll. */
  function batch(seed: string, recipe: string, inputs: [string, string, number][], skill: number, spoil?: boolean): { calls: number[]; made: string[] } {
    const w = new TestWorld({ seed, embark: 'none' });
    const lab = w.build('alchemist', w.index(12, 12, Z), 'granite');
    const alchemist = w.spawnDwarf({ at: w.index(16, 16, Z), skills: { alchemy: skill } });
    w.setLabor(alchemist, 'alchemy', true);
    for (const [item, material, count] of inputs) w.spawnItem(item, material, w.index(16, 14, Z), count);
    const stream = w.game.world.rngFor('12');
    const original = stream.chance.bind(stream);
    const calls: number[] = [];
    stream.chance = (permille: number): boolean => {
      calls.push(permille);
      return spoil ?? original(permille);
    };
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: lab, order: { recipeId: recipe, mode: 'once', remaining: 1, priority: 5 } }).ok).toBe(true);
    w.until((x) => x.events('ItemCrafted').some((e) => e['recipeId'] === recipe), 3000);
    const made = w.events('ItemCrafted').filter((e) => e['recipeId'] === recipe)
      .map((e) => registry.table('items').idOf(w.game.world.entities.get(e['itemId'] as EntityId, C.Item)!.type) ?? '');
    return { calls, made };
  }

  it('a spoilable batch rolls max(0, ALCHEMY_MISHAP_PERMILLE − 10 × skill) per mille on 12\'s stream, and a spoiled one is murky', () => {
    const inputs: [string, string, number][] = [['rune_vial', 'rune', 1], ['plant_food', 'pale_bell', 2]];
    expect(batch('t474-spoil-0', 'brew_stout_draught', inputs, 0, false)).toEqual({ calls: [100], made: ['stout_draught'] });
    expect(batch('t474-spoil-4', 'brew_stout_draught', inputs, 4, false).calls).toEqual([60]);
    expect(batch('t474-spoil-12', 'brew_stout_draught', inputs, 12, false).calls).toEqual([0]);
    const spoiled = batch('t474-spoiled', 'brew_stout_draught', inputs, 0, true);
    expect(spoiled.made).toEqual(['murky_draught']);
    // Only a spoilable recipe draws.
    expect(batch('t474-no-spoil', 'distill_rune', [['glowcap', 'glowcap', 2]], 0).calls).toEqual([]);
  });

  it('a murky draught is worth 1 and a common draught 30; neither is ever drunk from a list', () => {
    const w = arena('t474-value');
    const murky = w.spawnItem('murky_draught', 'rune', w.index(10, 10, Z), 1, 1);
    const stout = w.spawnItem('stout_draught', 'rune', w.index(10, 11, Z), 1, 1);
    const id = w.spawnDwarf({ at: w.index(10, 12, Z) });
    expect(w.readers.of<ItemsReader>('13').value(murky)).toBe(1);
    expect(w.readers.of<ItemsReader>('13').value(stout)).toBe(30);
    expect(drinkDraught(ctxOf(w), id, murky)).toBe(false);
  });
});

describe('T-474 the firebloom burns only what it hits', () => {
  it('a fortress creature whose shield blocks the bloom is not reported burned; one it hits is', () => {
    const seen = { blocked: 0, hit: 0 };
    for (let k = 0; k < 30 && (seen.blocked === 0 || seen.hit === 0); k += 1) {
      const w = arena(`t474-bloom-${k}`);
      const id = w.spawnDwarf({ at: w.index(20, 20, Z), skills: { shield: 10 } });
      const shield = w.spawnItem('shield', 'iron', w.index(20, 20, Z), 1, 1);
      w.game.world.services.items!.attachToCarrier(shield, id);
      const eq = w.game.world.entities.get(id, C.Equipment) as Equipment;
      w.game.world.entities.add(id, C.Equipment, { ...eq, shield });
      const caster = w.spawnDwarf({ at: w.index(10, 10, Z) });
      w.game.world.services.magic!.addBloom({ tile: w.index(20, 20, Z), at: w.tick + 1, casterId: caster, raw: 20 });
      w.step(3);
      const outcome = w.events('AttackResolved').find((e) => e['defenderId'] === id);
      const burned = w.events('SpellCast').filter((e) => e['burned'] === true);
      if (outcome?.['outcome'] === 'blocked') {
        seen.blocked += 1;
        expect(burned).toHaveLength(0);
      } else if (outcome?.['outcome'] === 'hit' && (outcome['amount'] as number) > 0) {
        seen.hit += 1;
        expect(burned).toMatchObject([{ casterId: caster, targetId: id }]);
      }
    }
    expect(seen.blocked).toBeGreaterThan(0);
    expect(seen.hit).toBeGreaterThan(0);
  });

  it('a draught list and a draught rest survive a save', () => {
    const w = arena('t474-save');
    const post = w.index(10, 10, Z);
    w.spawnItem('stout_draught', 'rune', w.index(12, 12, Z), 1, 1);
    const id = w.spawnDwarf({ at: post });
    squad(w, [id], post, ['stout_draught']);
    w.game.world.emit({ type: 'RaidArrived', partyId: 0, kind: 'raid', size: 1 });
    w.step(2);
    const { game: loaded } = roundTrip(w.game);
    expect(loaded.world.entities.get(id, C.Spellbound)?.lastDraughtTick).toBe(w.game.world.entities.get(id, C.Spellbound)?.lastDraughtTick);
    const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(loaded.world.entities.get(squadId, C.Squad)?.equipment.draughts).toEqual(['stout_draught']);
  });
});
