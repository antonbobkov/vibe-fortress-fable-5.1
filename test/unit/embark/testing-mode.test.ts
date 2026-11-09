/**
 * T-532: the testing start, `02-systems/02-embark-and-loadout.md` § Testing mode. No budget, any
 * dwarves, skills and items; the testing preset; the fortress marked in its save header and legend.
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { EMBARK_DWARF_COUNT, SKILL_MAX_LEVEL } from '@core/constants';
import { HeadlessGame } from '@app/headless';
import { gameHeader, roundTrip } from '@app/game-save';
import {
  EMBARK_TESTING_MAX_COUNT,
  EMBARK_TESTING_MAX_DWARVES,
  EmbarkSession,
  TESTING_PRESET,
  TESTING_PRESET_ID,
  TESTING_PRESET_LEVEL,
  testingItemProblem,
  testingItemSlot,
} from '@systems/embark';
import { runeMaxMilli } from '@systems/magic/rune';
import { LEGEND_TESTING_NOTE, legendLines, type LegendRecord } from '@ui/screens/legend';

const registry = contentRegistry();

function testingSession(): EmbarkSession {
  const s = new EmbarkSession(registry, 'testing-mode', 0);
  expect(s.apply({ type: 'SetEmbarkMode', mode: 'testing' }).ok).toBe(true);
  return s;
}

describe('T-532 testing mode: the preset', () => {
  it('names only rows that exist, and every line is valid', () => {
    const skills = registry.table('skills');
    const catalog = registry.table('embarkCatalog');
    for (const s of TESTING_PRESET.skills) {
      expect(skills.has(s.skill), s.skill).toBe(true);
      expect(s.dwarf).toBeLessThan(TESTING_PRESET.dwarves);
    }
    for (const l of TESTING_PRESET.supplies) expect(catalog.has(l.entry), l.entry).toBe(true);
    for (const l of TESTING_PRESET.items) expect([l.item, l.material, testingItemProblem(registry, l, EMBARK_TESTING_MAX_COUNT)]).toEqual([l.item, l.material, null]);
  });

  it('covers every labour that has a skill, runecraft and smithing among them, at a high level', () => {
    const skills = registry.table<{ id: string; labor?: string | null }>('skills');
    const covered = new Set(TESTING_PRESET.skills.map((s) => skills.byId(s.skill)?.labor ?? ''));
    for (const id of skills.ids()) {
      const labor = skills.byId(id)?.labor;
      if (typeof labor === 'string' && labor !== '') expect(covered.has(labor), `${id} (${labor})`).toBe(true);
    }
    const named = new Set(TESTING_PRESET.skills.map((s) => s.skill));
    for (const skill of ['runecraft', 'runesmithing', 'alchemy', 'weaponsmithing', 'farming', 'axe', 'crossbow']) expect(named.has(skill), skill).toBe(true);
    expect(TESTING_PRESET.skills.every((s) => s.level === TESTING_PRESET_LEVEL)).toBe(true);
    expect(TESTING_PRESET.dwarves).toBe(12);
  });

  it('brings staffs and wands with stones, enchanted gear, vials, glowstone and glowcap seed', () => {
    const items = TESTING_PRESET.items;
    expect(items.some((l) => l.item === 'staff' && l.stone !== undefined)).toBe(true);
    expect(items.some((l) => l.item === 'wand' && l.stone !== undefined)).toBe(true);
    expect(items.some((l) => l.enchant !== undefined && testingItemSlot(registry, l.item) === 'weapon')).toBe(true);
    expect(items.some((l) => l.enchant !== undefined && testingItemSlot(registry, l.item) === 'armor')).toBe(true);
    expect(items.some((l) => l.item === 'rune_vial')).toBe(true);
    expect(items.some((l) => l.material === 'glowstone')).toBe(true);
    expect(items.some((l) => l.item === 'seed' && l.material === 'glowcap')).toBe(true);
  });
});

describe('T-532 testing mode: the session', () => {
  it('normal mode refuses the testing commands and keeps its limits', () => {
    const s = new EmbarkSession(registry, 'testing-mode', 0);
    expect(s.apply({ type: 'AddDwarf' })).toEqual({ ok: false, reason: 'not_testing' });
    expect(s.apply({ type: 'AddItem', line: { item: 'bar', material: 'steel', count: 5 } })).toEqual({ ok: false, reason: 'not_testing' });
    expect(s.apply({ type: 'SetSkill', dwarf: 0, skill: 'runecraft', level: 1 })).toEqual({ ok: false, reason: 'not_found' });
    expect(s.apply({ type: 'SetSkill', dwarf: 0, skill: 'mining', level: 6 })).toEqual({ ok: false, reason: 'invalid' });
    expect(s.apply({ type: 'SetSupply', entry: 'e_anvil', count: 2 })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('testing mode has no budget and lifts the limits up to its caps', () => {
    const s = testingSession();
    expect(s.budget()).toBe(Infinity);
    expect(s.apply({ type: 'SetSupply', entry: 'e_anvil', count: EMBARK_TESTING_MAX_COUNT }).ok).toBe(true);
    expect(s.apply({ type: 'SetSupply', entry: 'e_anvil', count: EMBARK_TESTING_MAX_COUNT + 1 }).ok).toBe(false);
    expect(s.apply({ type: 'SetSkill', dwarf: 0, skill: 'runecraft', level: SKILL_MAX_LEVEL }).ok).toBe(true);
    expect(s.apply({ type: 'SetSkill', dwarf: 0, skill: 'mining', level: SKILL_MAX_LEVEL + 1 }).ok).toBe(false);
    expect(s.apply({ type: 'SetSkill', dwarf: 0, skill: 'mining', level: SKILL_MAX_LEVEL }).ok).toBe(true);
    expect(s.canEmbark()).toEqual({ ok: true, reason: null });
    // A reroll is free.
    expect(s.apply({ type: 'RerollDwarf', dwarf: 1 }).ok).toBe(true);
    expect(s.budget()).toBe(Infinity);
  });

  it('adds dwarves up to the cap, removes them down to one, and sets a skill for all', () => {
    const s = testingSession();
    while (s.party.length < EMBARK_TESTING_MAX_DWARVES) expect(s.apply({ type: 'AddDwarf' }).ok).toBe(true);
    expect(s.apply({ type: 'AddDwarf' })).toEqual({ ok: false, reason: 'member_limit' });
    expect(new Set(s.party.map((d) => d.name)).size).toBe(EMBARK_TESTING_MAX_DWARVES);
    expect(s.apply({ type: 'SetSkillAll', skill: 'runecraft', level: 12 }).ok).toBe(true);
    expect(s.party.every((d) => d.skills['runecraft'] === 12)).toBe(true);
    while (s.party.length > 1) expect(s.apply({ type: 'RemoveDwarf', dwarf: 0 }).ok).toBe(true);
    expect(s.apply({ type: 'RemoveDwarf', dwarf: 0 }).ok).toBe(false);
  });

  it('free item lines: valid ones join (the same kind merges), invalid ones are refused', () => {
    const s = testingSession();
    expect(s.apply({ type: 'AddItem', line: { item: 'staff', material: 'steel', count: 1, stone: 'garnet' } }).ok).toBe(true);
    expect(s.apply({ type: 'AddItem', line: { item: 'staff', material: 'steel', count: 2, stone: 'garnet' } }).ok).toBe(true);
    expect(s.items).toEqual([{ item: 'staff', material: 'steel', count: 3, stone: 'garnet' }]);
    expect(s.apply({ type: 'AddItem', line: { item: 'axe', material: 'iron', count: 1, stone: 'garnet' } })).toEqual({ ok: false, reason: 'invalid' });
    expect(s.apply({ type: 'AddItem', line: { item: 'axe', material: 'iron', count: 1, enchant: 'stout' } })).toEqual({ ok: false, reason: 'invalid' });
    expect(s.apply({ type: 'AddItem', line: { item: 'axe', material: 'iron', count: 1, enchant: 'blaze' } }).ok).toBe(true);
    expect(s.apply({ type: 'AddItem', line: { item: 'axe', material: 'iron', count: 0 } })).toEqual({ ok: false, reason: 'invalid' });
    expect(s.apply({ type: 'AddItem', line: { item: 'nothing', material: 'iron', count: 1 } })).toEqual({ ok: false, reason: 'not_found' });
    // Any material for any item: testing trusts the player.
    expect(s.apply({ type: 'AddItem', line: { item: 'statue', material: 'glowstone', count: 1 } }).ok).toBe(true);
    expect(s.apply({ type: 'SetItemCount', index: 0, count: 7 }).ok).toBe(true);
    expect(s.items[0]?.count).toBe(7);
    expect(s.apply({ type: 'SetItemCount', index: 0, count: 0 }).ok).toBe(true);
    expect(s.items.map((l) => l.item)).toEqual(['axe', 'statue']);
  });

  it('back to normal mode: seven dwarves, nothing bought, no free lines', () => {
    const s = new EmbarkSession(registry, 'testing-mode', 0);
    expect(s.apply({ type: 'ApplyPreset', preset: TESTING_PRESET_ID }).ok).toBe(true);
    expect(s.mode).toBe('testing');
    expect(s.party).toHaveLength(TESTING_PRESET.dwarves);
    expect(s.items).toHaveLength(TESTING_PRESET.items.length);
    expect(s.apply({ type: 'SetEmbarkMode', mode: 'normal' }).ok).toBe(true);
    expect(s.party).toHaveLength(EMBARK_DWARF_COUNT);
    expect(s.party.every((d) => Object.keys(d.skills).length === 0)).toBe(true);
    expect([s.supplies, s.items, s.preset]).toEqual([[], [], null]);
    expect(s.apply({ type: 'ApplyPreset', preset: 'balanced' }).ok).toBe(true);
    expect(s.canEmbark().ok).toBe(true);
  });
});

describe('T-532 testing mode: arrival, save header and legend', () => {
  it('the testing preset arrives in full and the fortress is marked', () => {
    const game = new HeadlessGame({ seed: 'testing-arrival', world: 'flat-test', embark: { preset: TESTING_PRESET_ID } });
    const arrival = game.arrival;
    if (arrival === null) throw new Error('no arrival');
    const e = game.world.entities;
    const items = registry.table('items');
    const materials = registry.table('materials');
    const enchants = registry.table('enchants');
    expect(arrival.dwarves).toHaveLength(TESTING_PRESET.dwarves);
    expect(game.world.fortress.testing).toBe(true);

    const all = e.with(C.Item).map((id) => e.get(id, C.Item)).filter((it) => it !== undefined);
    const units = (type: string, material?: string): number =>
      all.filter((it) => it.type === items.index(type) && (material === undefined || it.material === materials.index(material))).reduce((n, it) => n + it.count, 0);
    expect(units('rune_vial', 'rune')).toBe(60);
    expect(units('seed', 'glowcap')).toBe(20);
    expect(units('statue', 'glowstone')).toBe(2);
    expect(units('bar', 'steel')).toBe(20);
    const staffs = all.filter((it) => it.type === items.index('staff'));
    expect(staffs).toHaveLength(4);
    expect(staffs.filter((it) => it.stone === materials.index('garnet'))).toHaveLength(2);
    const axe = all.find((it) => it.type === items.index('axe') && it.enchant !== undefined);
    expect(axe?.enchant).toEqual({ id: enchants.index('blaze'), tier: 5 });
    const bolts = all.filter((it) => it.type === items.index('bolt') && it.enchant !== undefined);
    expect(bolts.reduce((n, it) => n + it.count, 0)).toBe(25);

    // A runecaster arrives holding its rune, full.
    const skills = registry.table('skills');
    const casters = arrival.dwarves.filter((id) => (e.get(id, C.Skills)?.level[skills.index('runecraft')] ?? 0) > 0);
    expect(casters).toHaveLength(2);
    for (const id of casters) expect(e.get(id, C.Rune)?.current).toBe(runeMaxMilli(TESTING_PRESET_LEVEL));

    // The save header says testing, and the mark survives a save and load.
    expect(gameHeader(game, 'manual').testing).toBe(true);
    const loaded = roundTrip(game);
    expect(loaded.header.testing).toBe(true);
    expect(loaded.game.world.fortress.testing).toBe(true);
    game.step(100);
  });

  it('a normal fortress is not marked, and its header has no testing key', () => {
    const game = new HeadlessGame({ seed: 'testing-arrival', world: 'flat-test', embark: 'default' });
    expect(game.world.fortress.testing).toBeUndefined();
    expect('testing' in gameHeader(game, 'manual')).toBe(false);
  });

  it('the legend names a testing fortress and says its milestones were not earned in normal play', () => {
    const record: LegendRecord = {
      id: 'final-x', name: 'Testhold', seed: 's', region: 'R', biome: 'b', wealthRating: 1, perilRating: 1,
      foundedTick: 0, endedTick: 0, yearsSurvived: 0, daysSurvived: 3, peakPopulation: 12, deepestLevel: 0,
      finalWealth: 0, milestones: [{ id: 'm_hearth', date: 'Day 2', text: 'The hearth was lit.' }], killsOfNote: [], lastWords: [], cause: 'Retired.',
    };
    expect(legendLines(record)[0]).toBe('Testhold');
    const lines = legendLines({ ...record, testing: true });
    expect(lines[0]).toBe('Testhold (testing)');
    expect(lines).toContain(LEGEND_TESTING_NOTE);
    expect(lines).toContain('Milestones (testing start)');
  });
});
