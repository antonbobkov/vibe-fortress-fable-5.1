/**
 * T-491: the runecraft flavour pass, eight small fun rules (`25-runecraft.md` § Vials, § Draughts,
 * § Enchantments in combat, § Summons, § Player-facing behavior; `docs/fun-features.md`).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, ItemFlag, type Equipment, type Summoned } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry, loadContent } from '@content/loader';
import { weaponOf, type CombatReader, type SquadWithId } from '@systems/combat';
import type { MaterialsReader } from '@systems/materials/reader';
import { CALM_REST_DAYS, DRAUGHT_REST_DAYS, SICK_VIAL_PERCENT, SUMMON_TICKS, VIAL_RUNE, VIALS_PER_DAY } from '@systems/magic/constants';
import { applyEnchantOnHit, drinkVial } from '@systems/magic/cast';
import { drinkDraught } from '@systems/magic/draughts';
import { effectAtTier } from '@systems/magic/enchant';
import { LAB_STINK_TILES } from '@systems/morale/constants';
import { MOOD_NEEDS_MET_FLOOR } from '@systems/morale/mood';
import type { MoraleReader } from '@systems/morale/reader';
import { assignHostileSkills } from '@systems/threats/gear';
import type { ItemsReader } from '@systems/items';
import type { TradeReader } from '@systems/trade/reader';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld): TickContext {
  return {
    world: w.game.world, registry, tick: w.tick, readers: w.readers,
    emit: (e: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(e),
  } as unknown as TickContext;
}

function hold(w: TestWorld, id: EntityId, itemId: EntityId): void {
  const items = w.game.world.services.items!;
  items.attachToCarrier(itemId, id);
  items.setOwner(itemId, id);
  const eq = w.game.world.entities.get(id, C.Equipment) as Equipment;
  w.game.world.entities.add(id, C.Equipment, { ...eq, weapon: itemId });
}

function channel(w: TestWorld, kind: 'wand' | 'staff', material: string, stone: string, at: TileIndex): EntityId {
  const id = w.spawnItem(kind, material, at, 1, 1);
  w.game.world.entities.add(id, C.Item, { ...w.game.world.entities.get(id, C.Item)!, stone: registry.table('materials').index(stone) });
  return id;
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

const thoughtIds = (w: TestWorld, id: EntityId): string[] => w.readers.of<MoraleReader>('15').thoughts(id).map((t) => t.id);
const thoughtValue = (w: TestWorld, id: EntityId, thought: string): number =>
  w.readers.of<MoraleReader>('15').thoughts(id).find((t) => t.id === thought)?.value ?? 0;

/** Keep every dwarf fed, watered and rested. */
function rest(w: TestWorld): void {
  for (const id of w.game.world.entities.with(C.Needs)) {
    for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(id, need, 0);
  }
}

function stepRested(w: TestWorld, n: number): void {
  for (let k = 0; k < n; k += TICKS_PER_HOUR) {
    rest(w);
    w.step(Math.min(TICKS_PER_HOUR, n - k));
  }
}

describe('T-491 content', () => {
  it('four thoughts numbered last, the blaze row ignites, and the constants', () => {
    const thoughts = registry.table<{ id: string; value: number | { formula: string }; hours: number; group: string; trigger: { event?: string; condition?: string } }>('thoughts');
    // Numbered after the older rows, just before T-493's `put_to_flight` (later tasks append after it).
    const ids = thoughts.ids();
    const flight = ids.indexOf('put_to_flight');
    expect(ids.slice(flight - 4, flight)).toEqual(['rune_sick', 'dosed_again', 'saw_wisp', 'lab_stink']);
    expect(thoughts.byId('rune_sick')).toMatchObject({ text: 'Too much rune. My teeth hum.', value: { formula: '−4' }, hours: 24, trigger: { event: 'VialDrunk' } });
    expect(thoughts.byId('dosed_again')).toMatchObject({ text: 'Another draught. I am tired of draughts.', value: { formula: '−4' }, hours: 72, trigger: { event: 'DraughtDrunk' } });
    expect(thoughts.byId('saw_wisp')).toMatchObject({ text: 'Saw a light that was not a lamp.', value: 2, hours: 24, trigger: { event: 'WispAppeared' } });
    expect(thoughts.byId('lab_stink')).toMatchObject({ text: 'The laboratory stinks.', value: { formula: '−1' }, hours: 12 });
    expect(thoughts.byId('lab_stink')?.trigger.event).toBeUndefined();
    const blaze = registry.table<{ id: string; effects: { kind: string; value: number; chance?: number }[] }>('enchants').byId('blaze')!;
    expect(blaze.effects.find((e) => e.kind === 'ignite')).toMatchObject({ value: 1, chance: 2 });
    expect([SICK_VIAL_PERCENT, CALM_REST_DAYS, LAB_STINK_TILES]).toEqual([50, 7, 3]);
    expect(new Strings(registry).get('ui.look.enchant.ignite', { chance: 2 })).toBe('2% of hits set the ground alight.');
  });
});

describe('T-491 rune_sick: a desperate fourth vial', () => {
  /** A Proficient caster at 0 rune with a wand of embers, `drunk` vials today and two vials in its pouch. */
  function setup(seed: string, drunk: number): { w: TestWorld; mage: EntityId; goblin: EntityId } {
    const w = arena(seed);
    const mage = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 10 } });
    hold(w, mage, channel(w, 'wand', 'oak', 'garnet', w.index(30, 30, Z)));
    const vials = w.spawnItem('rune_vial', 'rune', w.index(30, 30, Z), 2);
    w.game.world.services.items!.attachToCarrier(vials, mage);
    w.game.world.entities.add(mage, C.Rune, { current: 0, vialsToday: drunk });
    const goblin = w.spawnCreature('gloam_warrior', w.index(30, 35, Z), 'hostile:gloam');
    w.game.world.services.combat!.setTarget(mage, goblin);
    return { w, mage, goblin };
  }
  const drink = (w: TestWorld, mage: EntityId): boolean => drinkVial(ctxOf(w), mage, weaponOf(w.game.world.entities, registry, mage), new Map());

  it('with three drunk and its foe beside it, a caster drinks a fourth for half the rune, and its teeth hum', () => {
    const { w, mage, goblin } = setup('t491-sick', VIALS_PER_DAY);
    // The foe five tiles off: no fourth.
    expect(drink(w, mage)).toBe(false);
    w.game.world.services.movement!.teleport(goblin, w.index(31, 31, Z));
    expect(drink(w, mage)).toBe(true);
    const rune = w.game.world.entities.get(mage, C.Rune)!;
    expect(rune.current).toBe((VIAL_RUNE * 1000 * SICK_VIAL_PERCENT) / 100);
    expect(rune.vialsToday).toBe(VIALS_PER_DAY + 1);
    // Never a fifth.
    w.game.world.entities.add(mage, C.Rune, { ...rune, current: 0 });
    expect(drink(w, mage)).toBe(false);
    w.step(2);
    expect(w.events('VialDrunk')).toEqual([expect.objectContaining({ id: mage, sick: true })]);
    expect(thoughtIds(w, mage)).toContain('rune_sick');
    expect(thoughtValue(w, mage, 'rune_sick')).toBeLessThan(0);
  });

  it('an ordinary vial with the foe beside it gives the whole rune and no thought', () => {
    const { w, mage, goblin } = setup('t491-not-sick', VIALS_PER_DAY - 1);
    w.game.world.services.movement!.teleport(goblin, w.index(31, 31, Z));
    expect(drink(w, mage)).toBe(true);
    expect(w.game.world.entities.get(mage, C.Rune)!.current).toBe(VIAL_RUNE * 1000);
    w.step(2);
    expect(w.events('VialDrunk')).toEqual([expect.objectContaining({ id: mage, sick: false })]);
    expect(thoughtIds(w, mage)).not.toContain('rune_sick');
  });
});

describe('T-491 dosed_again: an early second calming draught', () => {
  it('within the week of the last it eases by half and grumbles; after the week it eases fully again; the floor holds', () => {
    const w = arena('t491-dosed');
    const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const calm = (): EntityId => w.spawnItem('calm_draught', 'rune', w.index(10, 10, Z), 1, 1);
    expect(drinkDraught(ctxOf(w), id, calm())).toBe(true);
    stepRested(w, 2);
    const full = thoughtValue(w, id, 'eased');
    expect(full).toBeGreaterThan(7);
    expect(thoughtIds(w, id)).not.toContain('dosed_again');
    // After the three-day rest, within the seven days.
    stepRested(w, DRAUGHT_REST_DAYS * TICKS_PER_DAY);
    expect(drinkDraught(ctxOf(w), id, calm())).toBe(true);
    stepRested(w, 2);
    expect(w.events('DraughtDrunk').map((e) => e['again'])).toEqual([false, true]);
    expect(thoughtValue(w, id, 'eased')).toBeGreaterThan(3);
    expect(thoughtValue(w, id, 'eased')).toBeLessThanOrEqual(4);
    expect(thoughtIds(w, id)).toContain('dosed_again');
    expect(w.readers.of<MoraleReader>('15').mood(id)).toBeGreaterThanOrEqual(MOOD_NEEDS_MET_FLOOR);
    // A full week after the second: eased in full, no grumble from this one.
    stepRested(w, CALM_REST_DAYS * TICKS_PER_DAY);
    expect(drinkDraught(ctxOf(w), id, calm())).toBe(true);
    stepRested(w, 2);
    expect(w.events('DraughtDrunk').map((e) => e['again'])).toEqual([false, true, false]);
    expect(thoughtValue(w, id, 'eased')).toBeGreaterThan(7);
  });
});

describe('T-491 blaze lights the tile', () => {
  /** A dwarf on an outdoor grass floor, a goblin with a blaze axe beside it, and stream 25's next percent roll forced. */
  function setup(seed: string): { w: TestWorld; goblin: EntityId; dwarf: EntityId; tile: TileIndex } {
    const w = arena(seed);
    const tile = w.index(30, 30, Z);
    w.map.setFlag(tile, TileFlag.Grass, true);
    const dwarf = w.spawnDwarf({ at: tile });
    const goblin = w.spawnCreature('gloam_warrior', w.index(31, 30, Z), 'hostile:gloam');
    return { w, goblin, dwarf, tile };
  }
  const blaze = registry.table<{ id: string; effects: Parameters<typeof effectAtTier>[0][] }>('enchants').byId('blaze')!;
  const effects = blaze.effects.map((e) => effectAtTier(e, 1));

  function forceRolls(w: TestWorld, value: number): number[] {
    const stream = w.game.world.rngFor('25');
    const calls: number[] = [];
    stream.int = (lo: number, hi: number): number => {
      calls.push(hi - lo + 1);
      return value;
    };
    return calls;
  }

  it('a blaze hit that rolls under 2% lights a tile that can burn, through 05, as a Mishap of kind blaze', () => {
    const { w, goblin, dwarf, tile } = setup('t491-blaze');
    expect(w.readers.of<MaterialsReader>('05').burnableTile(tile)).toBe(true);
    const calls = forceRolls(w, 1);
    applyEnchantOnHit(ctxOf(w), effects, goblin, dwarf, 'torso', 0);
    expect(calls).toEqual([100]);
    w.until(() => w.events('FireStarted').length > 0, 200);
    expect(w.events('Mishap')).toEqual([expect.objectContaining({ id: goblin, kind: 'blaze', tile })]);
    expect(w.events('FireStarted').map((e) => e['tile'])).toContain(tile);
  });

  it('a roll of 2 or more lights nothing; a tile that cannot burn is not lit; each blaze hit draws once', () => {
    const { w, goblin, dwarf, tile } = setup('t491-blaze-miss');
    const calls = forceRolls(w, 2);
    applyEnchantOnHit(ctxOf(w), effects, goblin, dwarf, 'torso', 0);
    expect(calls).toHaveLength(1);
    w.map.setFlag(tile, TileFlag.Grass, false);
    expect(w.readers.of<MaterialsReader>('05').burnableTile(tile)).toBe(false);
    const landed = forceRolls(w, 0);
    applyEnchantOnHit(ctxOf(w), effects, goblin, dwarf, 'torso', 0);
    expect(landed).toHaveLength(1);
    w.step(20);
    expect(w.events('Mishap')).toHaveLength(0);
    expect(w.events('FireStarted')).toHaveLength(0);
  });

  it('an ember axe (no ignite) draws nothing on stream 25', () => {
    const { w, goblin, dwarf } = setup('t491-ember');
    const ember = registry.table<{ id: string; effects: Parameters<typeof effectAtTier>[0][] }>('enchants').byId('ember')!;
    const calls = forceRolls(w, 0);
    applyEnchantOnHit(ctxOf(w), ember.effects.map((e) => effectAtTier(e, 1)), goblin, dwarf, 'torso', 0);
    expect(calls).toHaveLength(0);
  });
});

describe('T-491 saw_wisp', () => {
  function sanctum(seed: string): { w: TestWorld; apprentice: EntityId; near: EntityId; walled: EntityId; far: EntityId; loose: () => void } {
    const w = new TestWorld({ seed, embark: 'none', surfaceWildlife: 'none' });
    const X = 30;
    const Y = 30;
    const DZ = 25;
    w.digRoom(X, Y, DZ, 14, 5);
    for (let y = Y - 1; y <= Y + 5; y += 1) for (let x = X - 1; x <= X + 14; x += 1) w.discover(w.index(x, y, DZ));
    const circleTile = w.index(X + 1, Y + 1, DZ);
    const circle = w.build('rune_circle', circleTile, 'granite');
    const apprentice = w.spawnDwarf({ at: w.index(X, Y, DZ) });
    const near = w.spawnDwarf({ at: w.index(X + 6, Y + 2, DZ) });
    // A dwarf beyond a wall, close but out of sight, and one in the room but 12 tiles off.
    w.digRoom(X, Y + 7, DZ, 3, 1);
    const walled = w.spawnDwarf({ at: w.index(X + 1, Y + 7, DZ) });
    const far = w.spawnDwarf({ at: w.index(X + 13, Y + 4, DZ) });
    const zone = w.zone('sanctum', [circleTile, w.index(X, Y, DZ), w.index(X + 1, Y, DZ), w.index(X, Y + 1, DZ)]);
    const producer = w.game.world.registrations.jobProducers.find((p) => p.id === 'magic');
    const loose = (): void => (producer as unknown as { mishap(kind: string, d: EntityId, c: EntityId, z: EntityId, ctx: TickContext): void })
      .mishap('wisp_loose', apprentice, circle, zone, ctxOf(w));
    return { w, apprentice, near, walled, far, loose };
  }

  it('a loose wisp: dwarves within 8 tiles who can see it, the apprentice too, and at most once a day', () => {
    const { w, apprentice, near, walled, far, loose } = sanctum('t491-wisp');
    for (const id of [apprentice, near, walled, far]) w.setNeed(id, 'hunger', 0);
    loose();
    w.step(1);
    const [appeared] = w.events('WispAppeared');
    expect(appeared).toMatchObject({ id: expect.any(Number), tile: expect.any(Number) });
    expect(w.game.world.entities.get(appeared!['id'] as EntityId, C.Summoned)).toBeDefined();
    expect(thoughtIds(w, apprentice)).toContain('saw_wisp');
    expect(thoughtIds(w, near)).toContain('saw_wisp');
    expect(thoughtIds(w, walled)).not.toContain('saw_wisp');
    expect(thoughtIds(w, far)).not.toContain('saw_wisp');
    const first = w.game.world.entities.get(near, C.Mood)!.thoughts.find((t) => t.thought === registry.table('thoughts').index('saw_wisp'))!.startTick;
    // A second wisp the same day: no second thought, and the first is not renewed.
    w.step(TICKS_PER_HOUR);
    loose();
    w.step(1);
    expect(w.events('WispAppeared')).toHaveLength(2);
    const held = w.game.world.entities.get(near, C.Mood)!.thoughts.filter((t) => t.thought === registry.table('thoughts').index('saw_wisp'));
    expect(held.map((t) => t.startTick)).toEqual([first]);
  });

  it('a called wisp appears for those who see it; a stone warden is no wisp', () => {
    const w = arena('t491-called');
    const call = (x: number, material: string, kind: 'wand' | 'staff'): EntityId => {
      const id = w.spawnDwarf({ at: w.index(x, 30, Z), skills: { runecraft: 10 } });
      squad(w, [id], w.index(x, 30, Z));
      w.game.world.entities.add(id, C.Rune, { current: 50_000 });
      hold(w, id, channel(w, kind, material, 'glowstone', w.index(x, 30, Z)));
      return id;
    };
    const mage = call(30, 'oak', 'wand');
    const watcher = w.spawnDwarf({ at: w.index(33, 32, Z) });
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) if (dx !== 0 || dy !== 0) w.carve(w.index(30 + dx, 22 + dy, Z), TileKind.Fortification);
    const goblin = w.spawnCreature('gloam_warrior', w.index(30, 22, Z), 'hostile:gloam');
    assignHostileSkills(w.game.world.entities, registry, goblin, 0, false);
    w.until(() => w.events('SummonCalled').length > 0, 400);
    w.step(1);
    expect(w.events('WispAppeared')).toEqual([expect.objectContaining({ id: w.events('SummonCalled')[0]!['id'] })]);
    expect(thoughtIds(w, watcher)).toContain('saw_wisp');
    expect(thoughtIds(w, mage)).toContain('saw_wisp');
    // A steel staff brings a warden: no wisp, nothing seen.
    const steel = arena('t491-warden');
    const id = steel.spawnDwarf({ at: steel.index(30, 30, Z), skills: { runecraft: 10 } });
    squad(steel, [id], steel.index(30, 30, Z));
    steel.game.world.entities.add(id, C.Rune, { current: 50_000 });
    hold(steel, id, channel(steel, 'staff', 'steel', 'glowstone', steel.index(30, 30, Z)));
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) if (dx !== 0 || dy !== 0) steel.carve(steel.index(30 + dx, 22 + dy, Z), TileKind.Fortification);
    steel.spawnCreature('gloam_warrior', steel.index(30, 22, Z), 'hostile:gloam');
    steel.until(() => steel.events('SummonCalled').length > 0, 400);
    steel.step(1);
    expect(steel.events('WispAppeared')).toHaveLength(0);
    expect(thoughtIds(steel, id)).not.toContain('saw_wisp');
  });
});

describe('T-491 the firebloom flashes', () => {
  it('25 emits SpellBloomed at the bloom; the compositor shows its 3×3 in ember_orange for that frame only', () => {
    const w = arena('t491-flash');
    const caster = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const tile = w.index(20, 20, Z);
    w.game.world.services.magic!.addBloom({ tile, at: w.tick + 3, casterId: caster, raw: 10 });
    w.step(5);
    expect(w.events('SpellBloomed')).toEqual([expect.objectContaining({ casterId: caster, tile })]);
    const content = loadContent();
    const palette = new Palette(content);
    const compositor = new Compositor({ registry: content, palette });
    const draw = (x: number, y: number, frame: number): number => compositor.compose(w.readers, { camX: x, camY: y, z: Z,
      sidebarOpen: false, cursor: null, animFrame: frame }, 3, 8).get(0, 0).bg;
    const before = [draw(19, 19, 4), draw(21, 21, 4), draw(22, 20, 4)];
    compositor.onEvents(w.events('SpellBloomed'), 4);
    expect(draw(19, 19, 4)).toBe(palette.color('ember_orange'));
    expect(draw(20, 20, 4)).toBe(palette.color('ember_orange'));
    expect(draw(21, 21, 4)).toBe(palette.color('ember_orange'));
    expect(draw(22, 20, 4)).toBe(before[2]);
    // The next frame, as before.
    expect(draw(19, 19, 5)).toBe(before[0]);
    expect(draw(21, 21, 5)).toBe(before[1]);
  });
});

describe('T-491 a turned shade hides', () => {
  it('comes through stealthed, like a hollow stalker, and is seen once a dwarf within its spot radius has a line to it', () => {
    const w = arena('t491-shade');
    const shade = w.spawnCreature('deep_shade', w.index(60, 60, Z), 'deep');
    w.game.world.entities.add<Summoned>(shade, C.Summoned, { summonerId: 0, fadesAt: w.tick + SUMMON_TICKS });
    w.spawnDwarf({ at: w.index(20, 20, Z) });
    w.game.world.emit({ type: 'SummonTurned', id: shade });
    w.step(3);
    expect(w.game.world.entities.get(shade, C.Hostile)).toMatchObject({ role: 'hollow', stealthed: true, spotted: false });
    const watcher = w.spawnDwarf({ at: w.index(60, 64, Z) });
    w.step(2);
    expect(w.game.world.entities.get(shade, C.Hostile)).toMatchObject({ stealthed: false, spotted: true });
    expect(w.game.world.entities.alive(watcher)).toBe(true);
  });

  it('a shade that turns beside its caster is not seen by that caster (T-497)', () => {
    const w = arena('t475-turn-27');
    const mage = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 10 } });
    squad(w, [mage], w.index(30, 30, Z));
    w.game.world.entities.add(mage, C.Rune, { current: 50_000 });
    hold(w, mage, channel(w, 'staff', 'deepsilver', 'glowstone', w.index(30, 30, Z)));
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) if (dx !== 0 || dy !== 0) w.carve(w.index(30 + dx, 22 + dy, Z), TileKind.Fortification);
    w.spawnCreature('gloam_warrior', w.index(30, 22, Z), 'hostile:gloam');
    w.until(() => w.events('SummonTurned').length > 0, 400);
    const shade = w.events('SummonTurned')[0]!['id'] as EntityId;
    w.step(2);
    expect(w.game.world.entities.get(shade, C.Hostile)).toMatchObject({ role: 'hollow', stealthed: true, spotted: false });
  });
});

describe('T-491 lab_stink', () => {
  it('a spoiled batch: dwarves who pass within 3 tiles of that laboratory the rest of the day; it survives a save', () => {
    const w = new TestWorld({ seed: 't491-stink', embark: 'none' });
    const lab = w.build('alchemist', w.index(12, 12, Z), 'granite');
    const alchemist = w.spawnDwarf({ at: w.index(16, 16, Z), skills: { alchemy: 0 } });
    w.setLabor(alchemist, 'alchemy', true);
    w.spawnItem('rune_vial', 'rune', w.index(16, 14, Z), 1);
    w.spawnItem('plant_food', 'pale_bell', w.index(16, 14, Z), 2);
    const passer = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const stranger = w.spawnDwarf({ at: w.index(30, 31, Z) });
    const footprint = w.game.world.entities.get(lab, C.Building)!.footprint;
    const xs = footprint.map((t) => w.map.xOf(t));
    const ys = footprint.map((t) => w.map.yOf(t));
    const east = Math.max(...xs);
    const south = Math.max(...ys);
    const moved = (id: EntityId, to: TileIndex): void => {
      const p = w.game.world.entities.get(id, C.Position)!;
      w.game.world.emit({ type: 'EntitiesMoved', moves: [[id, w.index(p.x, p.y, p.z), to]] });
      w.step(1);
    };
    // Before any batch spoils, the laboratory does not stink.
    moved(passer, w.index(east + 1, south, Z));
    expect(thoughtIds(w, passer)).not.toContain('lab_stink');
    const stream = w.game.world.rngFor('12');
    stream.chance = (): boolean => true;
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: lab, order: { recipeId: 'brew_stout_draught', mode: 'once', remaining: 1, priority: 5 } }).ok).toBe(true);
    w.until((x) => x.events('ItemCrafted').some((e) => e['recipeId'] === 'brew_stout_draught'), 3000);
    const made = w.events('ItemCrafted').filter((e) => e['recipeId'] === 'brew_stout_draught').map((e) => registry.table('items').idOf(w.game.world.entities.get(e['itemId'] as EntityId, C.Item)!.type));
    expect(made).toEqual(['murky_draught']);
    expect(w.tick % TICKS_PER_DAY).toBeLessThan(TICKS_PER_DAY - 10);
    // Within LAB_STINK_TILES of the footprint: the thought; one tile farther: none.
    moved(stranger, w.index(east + LAB_STINK_TILES + 1, south, Z));
    expect(thoughtIds(w, stranger)).not.toContain('lab_stink');
    moved(passer, w.index(east + LAB_STINK_TILES, south, Z));
    expect(thoughtIds(w, passer)).toContain('lab_stink');
    expect(thoughtValue(w, passer, 'lab_stink')).toBeLessThan(0);
    // The marker survives a save.
    const { game } = roundTrip(w.game);
    expect(game.hash()).toBe(w.game.hash());
    // The day ends: the stink goes with it.
    w.step(TICKS_PER_DAY - (w.tick % TICKS_PER_DAY) + 1);
    moved(stranger, w.index(east + 1, south, Z));
    expect(thoughtIds(w, stranger)).not.toContain('lab_stink');
  });
});

describe('T-491 the Wildwood and staffs', () => {
  it('a staff of iron and a wand offered to the Wildwood are wooden items: −2 reputation each, a fifth of the value', () => {
    const w = new TestWorld({ seed: 'td-wood-penalty', world: 'flat-test', embark: 'none', startTick: 59 * TICKS_PER_DAY });
    const depot = w.build('trade_depot', w.index(45, 8, 32), 'granite');
    w.game.world.fortress.reputation.hillfolk = -50;
    w.until((world) => world.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
    const trade = w.readers.of<TradeReader>('20');
    expect(trade.activeCaravan()?.civ).toBe('wildwood');
    const tile = w.game.world.entities.get(depot, C.Building)?.footprint[0] as number;
    w.spawnDwarf({ at: tile });
    const staff = w.spawnItem('staff', 'iron', tile);
    const wand = w.spawnItem('wand', 'oak', tile);
    const axe = w.spawnItem('axe', 'iron', tile);
    const value = (id: EntityId): number => w.readers.of<ItemsReader>('13').value(id);
    expect(trade.valuation('wildwood', staff)).toBe((value(staff) * 20) / 100);
    expect(trade.valuation('wildwood', wand)).toBe((value(wand) * 20) / 100);
    expect(trade.valuation('wildwood', axe)).toBeGreaterThan((value(axe) * 20) / 100);
    expect(trade.valuation('hillfolk', staff)).toBeGreaterThan((value(staff) * 20) / 100);
    const offered = [staff, wand, axe];
    w.submit({ type: 'MoveToDepot', itemIds: offered });
    w.until((world) => offered.every((id) => ((world.game.world.entities.get(id, C.Item)?.flags ?? 0) & ItemFlag.AtDepot) !== 0), 300);
    w.submit({ type: 'TradeOpen', depotId: depot });
    w.until(() => trade.sessionOpen(), 300);
    const selected = trade.merchantItems().filter((id) => w.game.world.entities.get(id, C.Item)?.containerId === depot).sort((a, b) => trade.price('wildwood', b) - trade.price('wildwood', a))[0];
    w.submit({ type: 'TradeOffer', give: offered.map((itemId) => ({ itemId, count: 1 })), take: [{ itemId: selected!, count: 1 }] });
    w.step(1);
    expect(trade.reputationLog('wildwood').filter((e) => e.reason === 'wood_offered').map((e) => e.delta)).toEqual([-2, -2]);
    expect(trade.session()?.woodOffered.slice().sort((a, b) => a - b)).toEqual([staff, wand].sort((a, b) => a - b));
  });
});
