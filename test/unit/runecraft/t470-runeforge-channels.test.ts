/**
 * T-470: the runeforge, wands and staffs, Emberbolt and Frostbind (`25-runecraft.md` § Damage
 * types, Workshops, Channels, Casting, Spells, Effects).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { loadGame, roundTrip } from '@app/game-save';
import { C, type Equipment } from '@core/components';
import { effectValue, effortUnderEffects } from '@core/effects';
import { TileKind } from '@core/map3d';
import { TICKS_PER_HOUR } from '@core/constants';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import { generatedRecipes, type RecipeDef } from '@content/generate';
import { armorReduction, DAMAGE_VS_LAYER, isDamageType, scoreWeapon, type CombatReader, type SquadWithId } from '@systems/combat';
import { woundTypeFor } from '@systems/health/wounds';
import type { ItemsReader } from '@systems/items';
import type { Job } from '@systems/jobs';
import type { MagicReader } from '@systems/magic';
import { FROSTBIND_SLOW_PERCENT } from '@systems/magic/constants';
import { addEffect, channelPower, spellOfItem } from '@systems/magic/cast';
import { battlefieldArms } from '@systems/terrain/generate/traits';
import { assignHostileSkills } from '@systems/threats/gear';
import type { WorkshopsReader, WorkshopsSystem } from '@systems/workshops';
import { channelLine, spellLine } from '@ui/panels/look';
import { channelMark, MilitaryPanel } from '@ui/panels/military';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const strings = new Strings(registry);

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** A channel item of a stone, made as the runeforge makes it. */
function channel(w: TestWorld, type: 'wand' | 'staff', material: string, stone: string, at: TileIndex, quality = 1): EntityId {
  const id = w.spawnItem(type, material, at, 1, quality);
  const item = w.game.world.entities.get(id, C.Item)!;
  w.game.world.entities.add(id, C.Item, { ...item, stone: registry.table('materials').index(stone) });
  return id;
}

/** Hold an item as the squad's equipment code would. */
function hold(w: TestWorld, id: EntityId, itemId: EntityId): void {
  const items = w.game.world.services.items!;
  items.attachToCarrier(itemId, id);
  items.setOwner(itemId, id);
  const eq = w.game.world.entities.get(id, C.Equipment) as Equipment;
  w.game.world.entities.add(id, C.Equipment, { ...eq, weapon: itemId });
}

function squad(w: TestWorld, members: EntityId[], station: TileIndex, mode: 'active' | 'train' = 'active', ranged = false): SquadWithId {
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members });
  w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: station });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode });
  return s;
}

function setRune(w: TestWorld, id: EntityId, milli: number): void {
  w.game.world.entities.add(id, C.Rune, { current: milli });
}

/** A goblin shut in a stone cell whose north side is a fortification: it can be shot, not reached. */
function cellGoblin(w: TestWorld, x: number, y: number, ring = false): EntityId {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) continue;
      // `ring`: fortifications all round, so it can be shot at from any side.
      w.carve(w.index(x + dx, y + dy, Z), ring || (dx === 0 && dy === -1) ? TileKind.Fortification : TileKind.Wall);
    }
  }
  const g = w.spawnCreature('gloam_warrior', w.index(x, y, Z), 'hostile:gloam');
  assignHostileSkills(w.game.world.entities, registry, g, 0, false);
  return g;
}

const magic = (w: TestWorld): MagicReader => w.readers.of<MagicReader>('25');

describe('T-470 damage types and the layer table', () => {
  it('the layer table in content is the constant 16 reads, ward column included; burn has no row', () => {
    const json = registry.derived<{ type: string; padding: number; leather: number; mail: number; plate: number; ward: number }[]>('damageVsLayer');
    expect(json.map((r) => r.type)).toEqual(['edge', 'pierce', 'blunt', 'ember', 'frost']);
    for (const row of json) {
      const c = DAMAGE_VS_LAYER[row.type as keyof typeof DAMAGE_VS_LAYER];
      expect([row.padding, row.leather, row.mail, row.plate, row.ward].map((v) => v / 1000)).toEqual([c.padding, c.leather, c.mail, c.plate, c.ward]);
    }
    expect(json.some((r) => r.type === 'burn')).toBe(false);
  });

  it('ember wounds are burns, frost wounds frost; the export parses both in an attack', async () => {
    const { parseAttacks } = await import(new URL('../../../scripts/lib/export/creatures.mjs', import.meta.url).href) as
      { parseAttacks(cell: string): unknown };
    expect(woundTypeFor('ember', 5, 60)).toBe('burn');
    expect(woundTypeFor('frost', 5, 60)).toBe('frost');
    expect(woundTypeFor('burn', 5, 60)).toBe('burn');
    expect(parseAttacks('touch ember 4 size 2; bite frost 6 size 3')).toEqual([
      { name: 'touch', type: 'ember', damage: 4, size: 2 },
      { name: 'bite', type: 'frost', damage: 6, size: 3 },
    ]);
    expect(isDamageType('ember') && isDamageType('frost') && !isDamageType('burn')).toBe(true);
  });
});

describe('T-470 armorReduction', () => {
  it('is the sum 16 wrote out three times: pieces outer first, then natural armour as plate', () => {
    const w = arena('t470-armor');
    const dwarf = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const mail = w.spawnItem('mail_shirt', 'iron', w.index(30, 30, Z), 1, 3);
    const eq = w.game.world.entities.get(dwarf, C.Equipment) as Equipment;
    w.game.world.entities.add(dwarf, C.Equipment, { ...eq, armor: { ...eq.armor, body: mail } });
    // Superior iron mail 12 × 1.0 × 1.2, and the tunic as padding 1.
    expect(armorReduction(w.game.world.entities, registry, dwarf, 'torso', 'edge', 0)).toBeCloseTo(12 * 1.2 * 1.2 + 0.6, 10);
    expect(armorReduction(w.game.world.entities, registry, dwarf, 'torso', 'ember', 0)).toBeCloseTo(12 * 1.2 * 0.4 + 0.3, 10);
    expect(armorReduction(w.game.world.entities, registry, dwarf, 'torso', 'burn', 0)).toBeCloseTo(12 * 1.2 + 1, 10);
    const troll = w.spawnCreature('trollkin', w.index(35, 35, Z), 'hostile:gloam');
    expect(armorReduction(w.game.world.entities, registry, troll, 'head', 'edge', 0)).toBeCloseTo(3 * 1.1, 10);
    expect(w.readers.of<CombatReader>('16').armorValue(troll, 'head', 'edge')).toBe(armorReduction(w.game.world.entities, registry, troll, 'head', 'edge', 0));
    // No creature, no natural armour.
    expect(armorReduction(w.game.world.entities, registry, mail, 'torso', 'edge', 0)).toBe(0);
  });
});

describe('T-470 content: channels, spells, the runeforge', () => {
  it('a channel is a launcher with no ammunition, quality-bearing, with its own glyph', () => {
    const weapons = registry.table<{ id: string; skill: string; hands: number; size: number; bars: number; launcher?: { range: number; power: number; ammo?: string } }>('weapons');
    expect(weapons.byId('wand')).toMatchObject({ skill: 'runecraft', hands: 1, size: 3, bars: 0, launcher: { range: 8, power: 700 } });
    expect(weapons.byId('staff')).toMatchObject({ skill: 'runecraft', hands: 2, size: 7, bars: 1, launcher: { range: 12, power: 1200 } });
    expect(weapons.byId('wand')?.launcher?.ammo).toBeUndefined();
    const items = registry.table<{ id: string; category: string; quality: boolean; glyph?: string; fg?: string; tags?: string[]; stack: number }>('items');
    expect(items.byId('wand')).toMatchObject({ category: 'weapon/ranged', quality: true, glyph: '\'', fg: 'rune_cyan', stack: 1 });
    expect(items.byId('staff')).toMatchObject({ category: 'weapon/ranged', quality: true, glyph: '⌠', fg: 'rune_cyan', stack: 1 });
    expect(items.byId('staff')?.tags).toBeUndefined();
    const metals = registry.table<{ id: string; runeMult: number }>('metals');
    expect(['silver', 'deepsilver', 'steel', 'iron', 'bronze', 'copper', 'gold', 'tin'].map((m) => metals.byId(m)?.runeMult))
      .toEqual([1300, 1600, 1100, 1000, 900, 800, 700, 700]);
  });

  it('one wand and one staff recipe per spell, at the runeforge, by runesmithing, numbered last', () => {
    const recipes = registry.table<RecipeDef>('recipes');
    const made = recipes.ids().filter((id) => id.startsWith('make_wand_') || id.startsWith('make_staff_'));
    // T-473's five stones made ten more, numbered after these.
    expect(made).toEqual(['make_wand_garnet', 'make_staff_garnet', 'make_wand_amethyst', 'make_staff_amethyst',
      'make_wand_quartz', 'make_staff_quartz', 'make_wand_emerald', 'make_staff_emerald', 'make_wand_sapphire', 'make_staff_sapphire',
      'make_wand_ruby', 'make_staff_ruby', 'make_wand_diamond', 'make_staff_diamond', 'make_wand_glowstone', 'make_staff_glowstone']);
    // T-471's rows number after the first fourteen, and T-475's glowstone pair after T-471's.
    const at = recipes.ids().indexOf('make_wand_garnet');
    expect(recipes.ids().slice(at, at + 14)).toEqual(made.slice(0, 14));
    const glow = recipes.ids().indexOf('make_wand_glowstone');
    expect(glow).toBeGreaterThan(recipes.ids().indexOf('set_ammo_seeking'));
    expect(recipes.ids().slice(glow, glow + 2)).toEqual(made.slice(14));
    expect(at).toBeGreaterThan(recipes.ids().indexOf('grind_glowstone'));
    const staff = recipes.byId('make_staff_amethyst')!;
    expect(staff).toMatchObject({ workshop: 'runeforge', skill: 'runesmithing', baseTicks: 300, fuel: false, quality: true, xp: 12, generated: true });
    expect(staff.inputs).toEqual([{ match: 'log', count: 1 }, { match: 'cut_gem', count: 1, material: 'amethyst' }, { match: 'bar', count: 1 }]);
    expect(staff.outputs).toEqual([{ item: 'staff', count: 1, material: { from: 'input', index: 2 }, stone: { from: 'input', index: 1 } }]);
    expect(recipes.byId('make_wand_garnet')).toMatchObject({ baseTicks: 200, xp: 10 });
    expect(generatedRecipes([], [], []).some((r) => r.workshop === 'runeforge')).toBe(false);
    const runeforge = registry.table<{ id: string; tags: string[]; impassableTiles?: number[]; labor: string }>('buildings').byId('runeforge');
    expect(runeforge).toMatchObject({ tags: ['rune_work'], impassableTiles: [0, 2, 6, 8], labor: 'masonry' });
    expect(registry.table<{ id: string; labor: string }>('skills').byId('runesmithing')?.labor).toBe('smithing');
  });

  it('a staff\'s power is its launcher power by its metal\'s runeMult by quality', () => {
    const weapons = registry.table<{ id: string; launcher?: { range: number; power: number } }>('weapons');
    const mat = (id: string): number => registry.table('materials').index(id);
    const wand = weapons.byId('wand')!;
    const staff = weapons.byId('staff')!;
    expect(channelPower(registry, wand, mat('oak'), 1)).toBeCloseTo(0.7, 10);
    expect(channelPower(registry, staff, mat('iron'), 1)).toBeCloseTo(1.2, 10);
    expect(channelPower(registry, staff, mat('silver'), 2)).toBeCloseTo(1.716, 10);
    expect(channelPower(registry, staff, mat('deepsilver'), 5)).toBeCloseTo(2.88, 10);
  });
});

describe('T-470 the worked numbers of § Spells', () => {
  /** A dwarf of Toughness 50 in the given body armour, and the bolt a channel throws. */
  function damage(kind: 'wand' | 'staff', material: string, quality: number, body: [string, string] | null, tunic: boolean): { raw: number; damage: number } {
    const w = arena(`t470-worked-${kind}-${material}`);
    const at = w.index(30, 30, Z);
    const target = w.spawnDwarf({ at });
    const attrs = w.game.world.entities.get(target, C.Attributes)!;
    w.game.world.entities.add(target, C.Attributes, { ...attrs, tou: 50 });
    const eq = w.game.world.entities.get(target, C.Equipment) as Equipment;
    const armor = body === null ? 0 : w.spawnItem(body[0], body[1], at);
    const clothing = tunic ? eq.clothing : { body: 0, legs: 0, feet: 0, over: 0 };
    w.game.world.entities.add(target, C.Equipment, { ...eq, armor: { ...eq.armor, body: armor }, clothing });
    const item = channel(w, kind, material, 'garnet', at, quality);
    const raw = spellOfItem(w.game.world.entities, registry, item)!.damage;
    const red = armorReduction(w.game.world.entities, registry, target, 'torso', 'ember', 0);
    return { raw, damage: Math.round((Math.max(0, raw - red) * 95) / 100) };
  }

  it.each([
    ['wand', 'oak', 1, ['leather_jerkin', 'leather'], false, 13, 10],
    ['wand', 'oak', 1, ['mail_shirt', 'iron'], true, 13, 8],
    ['wand', 'oak', 1, ['breastplate', 'steel'], true, 13, 0],
    ['staff', 'iron', 1, ['leather_jerkin', 'leather'], false, 22, 18],
    ['staff', 'iron', 1, ['mail_shirt', 'iron'], true, 22, 16],
    ['staff', 'iron', 1, ['breastplate', 'steel'], true, 22, 4],
    ['staff', 'silver', 2, null, false, 31, 29],
    ['staff', 'deepsilver', 5, null, false, 52, 49],
  ] as const)('Emberbolt, %s of %s (quality %i) against %j, tunic %s: raw %i, damage %i', (kind, material, quality, body, tunic, raw, dealt) => {
    // As the table: the tunic under the mail and the breastplate; a leather jerkin alone; a bare part.
    const r = damage(kind, material, quality, body === null ? null : [body[0], body[1]], tunic);
    expect(r).toEqual({ raw, damage: dealt });
  });

  it('a deepsilver masterwork great axe still out-damages the best staff: 72 raw, 68 on a bare part', () => {
    expect(Math.round(30 * 1.6 * 1.5)).toBe(72);
    expect(Math.round((72 * 95) / 100)).toBe(68);
    expect(68).toBeGreaterThan(49);
  });
});

describe('T-470 casting', () => {
  it('a Dabbling apprentice with 5 rune and a wand casts five bolts, then clubs', () => {
    const w = arena('t470-five-bolts');
    const caster = w.spawnDwarf({ at: w.index(40, 44, Z), skills: { runecraft: 1 } });
    squad(w, [caster], w.index(40, 44, Z));
    w.step(1);
    setRune(w, caster, 5000);
    const wand = channel(w, 'wand', 'oak', 'garnet', w.index(40, 44, Z));
    hold(w, caster, wand);
    const goblin = cellGoblin(w, 40, 50);
    w.game.world.services.combat?.setTarget(caster, goblin);
    const start = w.tick;
    w.until(() => w.events('SpellCast').length >= 5, 2000);
    // Five bolts in a few dozen ticks: an hour's regen (100 milli-rune at Dabbling) is far from a sixth.
    expect(w.tick - start).toBeLessThan(150);
    const casts = w.events('SpellCast').filter((e) => e['casterId'] === caster);
    expect(casts).toHaveLength(5);
    expect(casts.every((e) => e['spellId'] === 'emberbolt' && e['targetId'] === goblin)).toBe(true);
    expect(w.game.world.entities.get(caster, C.Rune)!.current).toBeLessThan(1000);
    expect(w.events('ProjectileFired').filter((e) => e['shooterId'] === caster)).toHaveLength(5);
    expect(magic(w).canCast(caster)).toBe(false);
    // Out of rune, the cell opens: the wand is a club, the hammer's half damage, blunt.
    w.carve(w.index(40, 49, Z), TileKind.Floor);
    w.game.world.services.combat?.setTarget(goblin, caster);
    w.until(() => w.events('AttackResolved').some((e) => e['attackerId'] === caster && e['damageType'] === 'blunt'), 400);
    expect(w.events('SpellCast').filter((e) => e['casterId'] === caster)).toHaveLength(5);
    expect(w.events('DamageDealt').filter((e) => e['attackerId'] === caster).every((e) => e['weaponId'] === wand && e['damageType'] === 'blunt')).toBe(true);
  });

  it('a dwarf with no runecraft never claims a channel and casts nothing', () => {
    const w = arena('t470-no-runecraft');
    const staff = channel(w, 'staff', 'iron', 'garnet', w.index(30, 31, Z));
    const sword = w.spawnItem('short_sword', 'iron', w.index(30, 32, Z));
    const plain = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { sword: 3 } });
    squad(w, [plain], w.index(30, 30, Z));
    w.step(2);
    expect(w.game.world.entities.get(plain, C.Equipment)?.weapon).toBe(sword);
    expect(scoreWeapon(registry, w.game.world.entities, staff, 'staff', false)).toBe(-1);
    expect(scoreWeapon(registry, w.game.world.entities, staff, 'any', true)).toBe(-1);
    // Even with a staff put in its hands it holds no Rune: nothing is cast, and it is a club.
    hold(w, plain, staff);
    const goblin = cellGoblin(w, 30, 38);
    w.game.world.services.combat?.setTarget(plain, goblin);
    w.step(300);
    expect(w.events('SpellCast')).toHaveLength(0);
    expect(w.events('ProjectileFired').filter((e) => e['shooterId'] === plain)).toHaveLength(0);
  });

  it('a runecaster claims the strongest channel, whatever the squad prefers, and drops the weaker', () => {
    const w = arena('t470-claim');
    const wand = channel(w, 'wand', 'oak', 'garnet', w.index(30, 31, Z));
    const iron = channel(w, 'staff', 'iron', 'garnet', w.index(30, 32, Z));
    w.spawnItem('short_sword', 'steel', w.index(30, 33, Z));
    const caster = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 4, sword: 10 } });
    const s = squad(w, [caster], w.index(30, 30, Z));
    w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'sword', armor: 'any', ranged: false } });
    w.step(2);
    expect(w.game.world.entities.get(caster, C.Equipment)?.weapon).toBe(iron);
    expect(w.game.world.entities.get(caster, C.Equipment)?.shield).toBe(0);
    const silver = channel(w, 'staff', 'silver', 'amethyst', w.index(30, 34, Z), 2);
    w.step(2);
    expect(w.game.world.entities.get(caster, C.Equipment)?.weapon).toBe(silver);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.get(iron)?.carriedBy).toBe(0);
    expect(items.get(wand)?.carriedBy).toBe(0);
    // The panel marks a channel beside a member who can use it.
    const panel = new MilitaryPanel();
    const ctx = { readers: w.readers, registry, strings } as never;
    expect(channelMark(ctx, caster)).toBe('⌠');
    expect(panel.gearOptions(ctx, 'weapon')).not.toContain('staff');
  });

  /** A caster and an ally, each holding a post of a squad of its own. */
  function line(seed: string, allyAt: [number, number]): { w: TestWorld; caster: EntityId; ally: EntityId } {
    const w = arena(seed);
    const caster = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 10 } });
    const ally = w.spawnDwarf({ at: w.index(allyAt[0], allyAt[1], Z), skills: { dodge: 0 } });
    squad(w, [caster], w.index(30, 30, Z));
    squad(w, [ally], w.index(allyAt[0], allyAt[1], Z));
    w.step(1);
    for (const id of [caster, ally]) w.game.world.entities.add(id, C.Soldier, { ...w.game.world.entities.get(id, C.Soldier)!, stance: 'hold' });
    setRune(w, caster, 1_000_000);
    hold(w, caster, channel(w, 'staff', 'iron', 'garnet', w.index(30, 30, Z)));
    return { w, caster, ally };
  }

  it('a caster holds its bolt while an ally stands on the line, and waits when no other target is clear', () => {
    const { w, caster } = line('t470-hold', [30, 33]);
    cellGoblin(w, 30, 38);
    w.step(400);
    expect(w.events('SpellCast')).toHaveLength(0);
    expect(w.events('ProjectileFired')).toHaveLength(0);
    const p = w.game.world.entities.get(caster, C.Position)!;
    expect([p.x, p.y]).toEqual([30, 30]);
  });

  it('a caster whose line is held throws at another target with a clear line', () => {
    const { w } = line('t470-other', [30, 33]);
    const near = cellGoblin(w, 30, 36);
    const other = cellGoblin(w, 37, 37, true);
    w.until(() => w.events('SpellCast').length >= 3, 1000);
    expect(w.events('SpellCast').every((e) => e['targetId'] === other)).toBe(true);
    expect(w.events('SpellCast').some((e) => e['targetId'] === near)).toBe(false);
  });

  it('a bolt can still hit an ally who steps into its path after the cast', () => {
    const { w, caster, ally } = line('t470-friendly', [33, 33]);
    const goblin = cellGoblin(w, 30, 38);
    const movement = w.game.world.services.movement!;
    const burned = (): boolean => w.events('DamageDealt').some((e) => e['defenderId'] === ally && e['damageType'] === 'ember');
    for (let k = 0; k < 200 && !burned(); k += 1) {
      const casts = w.events('SpellCast').length;
      w.until(() => w.events('SpellCast').length > casts, 200);
      // The bolt has just left the staff: the ally steps onto its line, then back to its post.
      movement.teleport(ally, w.index(30, 33, Z));
      w.step(4);
      movement.teleport(ally, w.index(33, 33, Z));
    }
    expect(burned()).toBe(true);
    expect(w.events('SpellCast').every((e) => e['targetId'] === goblin)).toBe(true);
    expect(w.events('AttackResolved').some((e) => e['attackerId'] === caster && e['defenderId'] === ally && e['outcome'] === 'hit')).toBe(true);
  });

  it('Frostbind slows what it hits by FROSTBIND_SLOW_PERCENT for round(300 × power) ticks, and the slow lapses', () => {
    const w = arena('t470-frost');
    const caster = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 10 } });
    squad(w, [caster], w.index(30, 30, Z));
    w.step(1);
    setRune(w, caster, 1000);
    hold(w, caster, channel(w, 'staff', 'iron', 'amethyst', w.index(30, 30, Z)));
    const goblin = cellGoblin(w, 30, 38);
    let hitTick = -1;
    for (let k = 0; k < 400 && hitTick < 0; k += 1) {
      // One bolt at a time, so the hit is known to the tick.
      if (w.game.world.entities.get(caster, C.Rune)!.current < 1000 && !w.game.world.entities.with(C.Projectile).length) setRune(w, caster, 1000);
      w.step(1);
      if (w.events('DamageDealt').some((e) => e['defenderId'] === goblin && e['damageType'] === 'frost' && Number(e['amount']) > 0)) hitTick = w.tick;
    }
    expect(hitTick).toBeGreaterThan(0);
    const effects = magic(w).effects(goblin);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ kind: 'slow', value: FROSTBIND_SLOW_PERCENT, sourceId: caster });
    expect(effects[0]!.until - hitTick).toBeLessThanOrEqual(360);
    expect(effects[0]!.until - hitTick).toBeGreaterThan(360 - 10);
    expect(effectValue(w.game.world.entities, goblin, 'slow', w.tick)).toBe(50);
    // No more bolts: the caster's rune is taken away, so the one slow is all there is.
    w.game.world.entities.remove(caster, C.Rune);
    w.step(400 + TICKS_PER_HOUR);
    expect(magic(w).effects(goblin)).toEqual([]);
    expect(w.game.world.entities.has(goblin, C.Spellbound)).toBe(false);
  });

  it('a slowed walker takes half the effort a step; a game with no Spellbound looks nothing up', () => {
    const w = arena('t470-slow-walk');
    const a = w.spawnDwarf({ at: w.index(20, 20, Z) });
    const b = w.spawnDwarf({ at: w.index(20, 24, Z) });
    expect(effortUnderEffects(w.game.world.entities, a, 400, 0)).toBe(400);
    addEffect(w.game.world.entities, b, { kind: 'slow', value: 50, until: 10_000, sourceId: 0 });
    expect(effortUnderEffects(w.game.world.entities, b, 400, 0)).toBe(200);
    const movement = w.game.world.services.movement!;
    const ctx = { tick: 0, emit: () => {} };
    for (const id of [a, b]) w.game.world.entities.add(id, C.Brain, { ...w.game.world.entities.get(id, C.Brain)!, behavior: 'idle' } as never);
    let ta = -1;
    let tb = -1;
    for (let t = 0; t < 2000 && (ta < 0 || tb < 0); t += 1) {
      if (ta < 0 && movement.walkTo(a, w.index(40, 20, Z), 'wander', { ...ctx, tick: w.tick }) === 'arrived') ta = t;
      if (tb < 0 && movement.walkTo(b, w.index(40, 24, Z), 'wander', { ...ctx, tick: w.tick }) === 'arrived') tb = t;
      w.step(1);
    }
    expect(ta).toBeGreaterThan(0);
    expect(tb).toBeGreaterThan(ta * 1.6);
  });
});

describe('T-470 the runeforge, the stone and melting', () => {
  it('a runesmith makes a staff of the bar\'s metal with the gem as its stone', () => {
    const w = arena('t470-forge');
    const forge = w.build('runeforge', w.index(12, 12, Z), 'granite');
    w.spawnDwarf({ at: w.index(16, 16, Z), skills: { runesmithing: 5 } });
    w.spawnItem('log', 'oak', w.index(16, 14, Z));
    w.spawnItem('cut_gem', 'garnet', w.index(16, 15, Z));
    w.spawnItem('bar', 'silver', w.index(17, 15, Z));
    w.step(1);
    expect(w.game.world.applyCommand({
      type: 'AddWorkOrder', workshopId: forge,
      order: { recipeId: 'make_staff_garnet', mode: 'once', remaining: 1, priority: 5 },
    }).ok).toBe(true);
    w.until((world) => world.events('ItemCrafted').some((e) => e['recipeId'] === 'make_staff_garnet'), 4000);
    const crafted = w.events('ItemCrafted').find((e) => e['recipeId'] === 'make_staff_garnet')!;
    const staff = w.game.world.entities.get(Number(crafted['itemId']), C.Item)!;
    expect(registry.table('items').idOf(staff.type)).toBe('staff');
    expect(registry.table('materials').idOf(staff.material)).toBe('silver');
    expect(registry.table('materials').idOf(staff.stone!)).toBe('garnet');
    expect(magic(w).spellOf(Number(crafted['itemId']))).toMatchObject({ id: 'emberbolt', range: 12, type: 'ember', suffix: 'of embers' });
  });

  it('the stone survives a drop, a haul, a claim and a save; an older save\'s item has none', () => {
    const w = arena('t470-stone-save');
    const staff = channel(w, 'staff', 'iron', 'amethyst', w.index(30, 31, Z));
    const caster = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 2 } });
    const stone = registry.table('materials').index('amethyst');
    squad(w, [caster], w.index(30, 30, Z));
    w.step(2);
    expect(w.game.world.entities.get(caster, C.Equipment)?.weapon).toBe(staff);
    expect(w.game.world.entities.get(staff, C.Item)?.stone).toBe(stone);
    const items = w.game.world.services.items!;
    items.setOwner(staff, 0);
    items.dropAt(staff, w.index(33, 33, Z));
    expect(w.game.world.entities.get(staff, C.Item)?.stone).toBe(stone);
    // A haul: picked up and set down elsewhere.
    items.attachToCarrier(staff, caster);
    items.dropAt(staff, w.index(35, 35, Z));
    expect(w.game.world.entities.get(staff, C.Item)?.stone).toBe(stone);
    const { game } = roundTrip(w.game);
    expect(game.world.entities.get(staff, C.Item)?.stone).toBe(stone);
    expect(game.hash()).toBe(w.game.hash());
    // A staff with no stone is no channel with a spell.
    const plain = w.spawnItem('staff', 'iron', w.index(36, 36, Z));
    expect(w.game.world.entities.get(plain, C.Item)?.stone).toBeUndefined();
    expect(magic(w).spellOf(plain)).toBeUndefined();
  });

  it('an older save loads: no item has a stone, no creature a Spellbound, and it plays on', async () => {
    const fixture = new Uint8Array(readFileSync(fileURLToPath(new URL('../../fixtures/played-fortress.deepholm', import.meta.url))));
    const old = await loadGame(fixture);
    const ent = old.game.world.entities;
    expect(ent.with(C.Item).length).toBeGreaterThan(0);
    expect(ent.with(C.Item).every((id) => ent.get(id, C.Item)?.stone === undefined)).toBe(true);
    expect(ent.with(C.Spellbound)).toEqual([]);
    expect(ent.with(C.Projectile).every((id) => ent.get(id, C.Projectile)?.spell === undefined)).toBe(true);
    old.game.step(TICKS_PER_HOUR * 2);
    expect(ent.with(C.Spellbound)).toEqual([]);
  });

  it('two staffs with different stones never merge', () => {
    const w = arena('t470-merge');
    const a = channel(w, 'staff', 'iron', 'garnet', w.index(30, 30, Z));
    const b = channel(w, 'staff', 'iron', 'amethyst', w.index(30, 30, Z));
    expect((w.game.world.services.items as unknown as { canMerge(a: EntityId, b: EntityId): boolean }).canMerge(a, b)).toBe(false);
  });

  it('a one-bar staff melts by the ordinary formula, to nothing, and never gives its stone back', () => {
    const w = arena('t470-melt');
    const smelter = w.build('smelter', w.index(16, 16, Z));
    const worker = w.spawnDwarf({ at: w.index(20, 16, Z), skills: { smelting: 20 } });
    w.step(1);
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const recipe = w.readers.of<WorkshopsReader>('12').recipe('melt_metal_item')!;
    const staff = channel(w, 'staff', 'iron', 'garnet', w.index(20, 17, Z));
    const fuel = w.spawnItem('charcoal_bar', 'charcoal', w.index(20, 18, Z));
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: staff, on: true })).toEqual({ ok: true });
    const before = new Set(w.game.world.entities.with(C.Item));
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    op.producer().onComplete?.({ id: 0, workerId: worker, target: { kind: 'building', ref: smelter },
      inputs: [{ filter: {}, count: 1, reserved: [staff], delivered: [staff] },
        { filter: {}, count: 1, reserved: [fuel], delivered: [fuel] }],
      data: { recipe: recipe.id, orderIndex: -1, globalOrder: false } } as unknown as Job, ctx);
    expect(w.readers.of<ItemsReader>('13').get(staff)).toBeUndefined();
    expect(w.game.world.entities.with(C.Item).filter((id) => !before.has(id))).toEqual([]);
  });

  it('old_battlefield scatters the arms it always did: the new rows are left out', () => {
    const baseline = JSON.parse(readFileSync(fileURLToPath(new URL('../../fixtures/content-row-baseline.json', import.meta.url)), 'utf8')) as
      { tables: Record<string, string[]> };
    const rows = (table: string): { id: string; materials?: string[] }[] =>
      (baseline.tables[table] ?? []).map((id) => registry.table<{ id: string; materials?: string[] }>(table).byId(id)!);
    const before = [...rows('weapons'), ...rows('armor')].filter((r) => (r.materials ?? []).includes('metal')).map((r) => r.id);
    expect(battlefieldArms(registry)).toEqual(before);
    expect(battlefieldArms(registry)).not.toContain('staff');
  });
});

describe('T-470 training and the look panel', () => {
  it('a channel holder drills alone for runecraft and spends no rune', () => {
    const w = arena('t470-drill');
    const zoneTiles: TileIndex[] = [];
    for (let x = 30; x < 34; x += 1) for (let y = 30; y < 33; y += 1) zoneTiles.push(w.index(x, y, Z));
    const barracks = w.zone('barracks', zoneTiles);
    const caster = w.spawnDwarf({ at: w.index(31, 31, Z), skills: { runecraft: 2 } });
    const other = w.spawnDwarf({ at: w.index(32, 31, Z), skills: { axe: 2 } });
    w.spawnItem('axe', 'iron', w.index(33, 31, Z));
    const s = squad(w, [caster, other], w.index(31, 31, Z), 'train');
    w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: barracks, key: 'squad', value: s.id } as never);
    hold(w, caster, channel(w, 'wand', 'oak', 'garnet', w.index(31, 31, Z)));
    setRune(w, caster, 3000);
    const runecraft = registry.table('skills').index('runecraft');
    const xpBefore = w.game.world.entities.get(caster, C.Skills)!.xp[runecraft]!;
    w.until(() => w.events('TrainingSession').some((e) => (e['members'] as EntityId[]).includes(caster)), 3000);
    const sessions = w.events('TrainingSession').filter((e) => (e['members'] as EntityId[]).includes(caster));
    expect(sessions[0]!['members']).toEqual([caster]);
    expect(w.game.world.entities.get(caster, C.Skills)!.xp[runecraft]!).toBeGreaterThan(xpBefore);
    expect(w.game.world.entities.get(caster, C.Rune)?.current).toBe(3000);
    expect(w.events('SpellCast')).toHaveLength(0);
  });

  it('a channel reads as its spell: on the ground and in a runecaster\'s hand', () => {
    const w = arena('t470-look');
    const staff = channel(w, 'staff', 'iron', 'garnet', w.index(30, 31, Z), 2);
    expect(spellLine(w.readers, strings, staff, true)).toBe('Emberbolt: 24 ember, range 12. Needs a runecaster.');
    const frost = channel(w, 'wand', 'oak', 'amethyst', w.index(30, 32, Z));
    expect(spellLine(w.readers, strings, frost, false)).toBe('Frostbind: 6 frost, range 8, slows by 50% for 210 ticks.');
    const caster = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 2 } });
    hold(w, caster, staff);
    expect(channelLine(w.readers, registry, strings, caster)).toBe('Channel: iron staff of embers (fine). Emberbolt: 24 ember, range 12.');
    const plain = w.spawnItem('axe', 'iron', w.index(30, 33, Z));
    expect(spellLine(w.readers, strings, plain, true)).toBeNull();
  });
});
