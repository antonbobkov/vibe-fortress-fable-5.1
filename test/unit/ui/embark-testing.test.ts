/**
 * T-532: the embark screen's testing mode (`ui-screens/embark.md` § Testing mode): the `t`
 * switch, the Items tab, the party's add and remove, a skill for every dwarf, the testing preset.
 */

import { describe, it, expect } from 'vitest';
import { SKILL_MAX_LEVEL } from '@core/constants';
import { TESTING_PRESET, TESTING_PRESET_ID, type EmbarkSession } from '@systems/embark';
import { EmbarkScreen } from '@ui/screens/embark';
import { DRAFT_ROWS, testingStep } from '@ui/screens/embark-testing';
import { keymap, press, registry, strings, surface } from './ui-fixture';

function screen(): { s: EmbarkScreen; embarked: EmbarkSession[] } {
  const embarked: EmbarkSession[] = [];
  const s = new EmbarkScreen(registry, 'embark-testing', { name: 'Greenhollow', peril: 0, tempC: 12 }, { embark: (session) => embarked.push(session), back: () => undefined }, keymap, strings);
  return { s, embarked };
}

function text(s: EmbarkScreen, cols = 100, rows = 45): string {
  const surf = surface(cols, rows);
  s.draw(surf);
  return surf.lines().join('\n');
}

describe('T-532 embark screen: testing mode', () => {
  it('is off by default, says so, and `t` turns it on keeping the loadout', () => {
    const { s } = screen();
    expect(s.testing).toBe(false);
    expect(text(s)).toContain('[t] Testing mode: off');
    s.key(press('4'));
    expect(s.tab).toBe(0);
    const total = s.session.total();
    s.key(press('t'));
    expect(s.testing).toBe(true);
    expect(s.session.total()).toBe(total);
    const t = text(s);
    expect(t).toContain('Embark at Greenhollow (testing)');
    expect(t).toContain('Testing mode: ON');
    expect(t).toContain('Budget unlimited (testing)');
    expect(t).toContain('[4] Items');
  });

  it('lifts the skill limits, lists every skill, and `*` gives every dwarf the level', () => {
    const { s } = screen();
    s.key(press('t'));
    s.key(press('Tab'));
    for (let k = 0; k < 60 && s.skillRows[s.skills.selected]?.id !== 'runecraft'; k += 1) s.key(press('↓'));
    expect(s.skillRows[s.skills.selected]?.id).toBe('runecraft');
    for (let k = 0; k < SKILL_MAX_LEVEL + 3; k += 1) s.key(press('+'));
    expect(s.session.party[0]?.skills['runecraft']).toBe(SKILL_MAX_LEVEL);
    s.key(press('*'));
    expect(s.session.party.every((d) => d.skills['runecraft'] === SKILL_MAX_LEVEL)).toBe(true);
    expect(s.reason()).toBeNull();
  });

  it('`a` adds a dwarf and `x` removes the selected one', () => {
    const { s } = screen();
    s.key(press('t'));
    const before = s.session.party.length;
    s.key(press('a'));
    s.key(press('a'));
    expect(s.session.party).toHaveLength(before + 2);
    expect(s.party.selected).toBe(before + 1);
    expect(text(s)).toContain('[a] add dwarf');
    s.key(press('x'));
    expect(s.session.party).toHaveLength(before + 1);
  });

  it('the Items tab makes a staff of steel with a garnet and adds it', () => {
    const { s } = screen();
    s.key(press('t'));
    s.key(press('4'));
    expect(s.tab).toBe(3);
    expect(text(s)).toContain('New item');
    // The item field: filter to "staff".
    s.key(press('/'));
    for (const ch of 'staff') s.key(press(ch));
    s.key(press('Enter'));
    expect(s.draft.item).toBe('staff');
    // The material: filter to "steel".
    s.key(press('↓'));
    s.key(press('/'));
    for (const ch of 'steel') s.key(press(ch));
    s.key(press('Enter'));
    expect(s.draft.material).toBe('steel');
    // Quality up to superior, the stone to garnet, and a count of 3.
    s.key(press('↓'));
    s.key(press('→'));
    s.key(press('→'));
    expect(s.draft.quality).toBe(3);
    s.key(press('↓'));
    s.filter.value = '';
    for (let k = 0; k < 20 && s.draft.extra !== 'garnet'; k += 1) s.key(press('→'));
    expect(s.draft.extra).toBe('garnet');
    s.key(press('↓'));
    s.key(press('+'));
    s.key(press('+'));
    s.key(press('a'));
    expect(s.session.items).toEqual([{ item: 'staff', material: 'steel', count: 3, quality: 3, stone: 'garnet' }]);
    const t = text(s);
    expect(t).toContain('3 x superior steel staff · garnet (Emberbolt)');
    // The line's own count, then `x`.
    s.key(press('↓'));
    expect(s.items.selected).toBe(DRAFT_ROWS);
    s.key(press('+'));
    expect(s.session.items[0]?.count).toBe(4);
    s.key(press('x'));
    expect(s.session.items).toEqual([]);
  });

  it('the testing preset is in the presets menu; `t` again goes back to Balanced, asking first after an edit', () => {
    const { s, embarked } = screen();
    s.key(press('p'));
    expect(text(s)).toContain(TESTING_PRESET.name);
    s.key(press('p'));
    s.choosePreset(TESTING_PRESET_ID);
    expect(s.testing).toBe(true);
    expect(s.session.party).toHaveLength(TESTING_PRESET.dwarves);
    s.key(press('a'));
    s.key(press('t'));
    expect(s.pendingPreset).toBe('balanced');
    expect(text(s)).toContain('Replace your changes with Balanced?');
    s.key(press('y'));
    expect(s.testing).toBe(false);
    expect(s.session.party).toHaveLength(7);
    expect(s.session.items).toEqual([]);
    expect(s.session.total()).toBe(1480);
    s.choosePreset(TESTING_PRESET_ID);
    s.key(press('Enter'));
    expect(embarked).toHaveLength(1);
    expect(embarked[0]?.testing).toBe(true);
  });

  it('fits 80 columns with the Items tab and the presets button', () => {
    const { s } = screen();
    s.key(press('t'));
    const first = text(s, 80, 30).split('\n')[0] ?? '';
    expect(first).toContain('[4] Items');
    expect(first).toContain('[p] Presets');
  });

  it('quantities step by 1, then 10, then 100', () => {
    expect([testingStep(0, 1), testingStep(9, 1), testingStep(10, 1), testingStep(100, 1), testingStep(990, 1)]).toEqual([1, 10, 20, 200, 999]);
    expect([testingStep(10, -1), testingStep(20, -1), testingStep(200, -1), testingStep(0, -1)]).toEqual([9, 10, 100, 0]);
  });
});
