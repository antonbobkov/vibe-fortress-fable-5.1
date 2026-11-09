/**
 * T-M1-13 embark screen: `ui-screens/embark.md`, `02` § Presets, § Player-facing behavior,
 * `embark-catalog.md`.
 */

import { describe, it, expect } from 'vitest';
import { EMBARK_BUDGET_BASE, EMBARK_BUDGET_PER_PERIL, EMBARK_SKILL_POINTS_PER_DWARF } from '@core/constants';
import type { EmbarkSession } from '@systems/embark';
import { EmbarkScreen, conditionHolds, marks, temperatureBand, type CatalogRow } from '@ui/screens/embark';
import { keymap, press, registry, strings, surface } from './ui-fixture';

function screen(peril = 0, tempC = 12): { s: EmbarkScreen; embarked: EmbarkSession[]; back: number[] } {
  const embarked: EmbarkSession[] = [];
  const back: number[] = [];
  const s = new EmbarkScreen(
    registry,
    'embark-ui',
    { name: 'Greenhollow', peril, tempC },
    { embark: (session) => embarked.push(session), back: () => back.push(1) },
    keymap,
    strings,
  );
  return { s, embarked, back };
}

/**
 * The party as the screen opened before U-01 (no skills, no supplies), for the tests of the
 * skill and reroll rules themselves; the screen now opens with Balanced applied (D-U3).
 */
function blank(s: EmbarkScreen): void {
  for (const line of s.session.supplies.slice()) s.session.apply({ type: 'SetSupply', entry: line.entry, count: 0 });
  s.session.party.forEach((d, dwarf) => {
    for (const skill of Object.keys(d.skills)) s.session.apply({ type: 'SetSkill', dwarf, skill, level: 0 });
  });
}

function text(s: EmbarkScreen): string {
  const surf = surface(100, 45);
  s.draw(surf);
  return surf.lines().join('\n');
}

describe('T-M1-13 embark: budget and presets', () => {
  it('the four presets total exactly the documented sums', () => {
    const documented: Record<string, number> = { balanced: 1480, miner_s_guild: 1490, farmstead: 1466, warband: 1495 };
    for (const [id, total] of Object.entries(documented)) {
      const { s } = screen();
      s.applyPreset(id);
      expect(s.session.total(), id).toBe(total);
      expect(s.session.budget()).toBe(EMBARK_BUDGET_BASE);
      expect(s.reason()).toBeNull();
    }
    expect(screen(3).s.session.budget()).toBe(EMBARK_BUDGET_BASE + 3 * EMBARK_BUDGET_PER_PERIL);
  });

  it('shows the budget line and lists the presets with their totals', () => {
    const { s } = screen();
    s.key(press('p'));
    expect(s.presets.open).toBe(true);
    const t = text(s);
    expect(t).toContain('Balanced');
    expect(t).toContain('1,480 ☼');
    // U-01 (D-U3): the screen opens with Balanced applied.
    expect(t).toContain('Budget 1,500 ☼   Spent 1,480   Left 20');
    s.key(press('Enter'));
    expect(s.session.preset).toBe('balanced');
    expect(text(s)).toContain('Spent 1,480   Left 20');
  });

  it('asks before a preset replaces edits, the safe answer being No', () => {
    const { s } = screen();
    s.key(press('2'));
    s.key(press('+'));
    expect(s.edited).toBe(true);
    const edited = s.session.total();
    s.key(press('p'));
    s.key(press('Enter'));
    expect(s.pendingPreset).toBe('balanced');
    expect(text(s)).toContain('Replace your changes with Balanced?');
    s.key(press('Enter'));
    expect(s.pendingPreset).toBeNull();
    // U-01: the screen opened with Balanced, so "No" is seen as the edit kept, not a null preset.
    expect(s.session.total()).toBe(edited);
    s.key(press('p'));
    s.key(press('Enter'));
    s.key(press('y'));
    expect(s.session.preset).toBe('balanced');
    expect(s.session.total()).toBe(1480);
  });

  it('over budget disables Embark and says by how much', () => {
    const { s, embarked } = screen();
    s.applyPreset('balanced');
    s.key(press('2'));
    // The first tools row is a pick; three more put the party over the budget.
    for (let k = 0; k < 3; k += 1) s.key(press('+'));
    const over = s.session.total() - s.session.budget();
    expect(over).toBeGreaterThan(0);
    expect(s.reason()).toBe(`Over budget by ${marks(over)} ☼`);
    expect(text(s)).toContain(`Over budget by ${marks(over)} ☼`);
    s.key(press('Enter'));
    expect(embarked).toHaveLength(0);
    s.key(press('-'));
    s.key(press('-'));
    s.key(press('-'));
    expect(s.reason()).toBeNull();
    s.key(press('Enter'));
    expect(embarked).toHaveLength(1);
  });

  it('an empty fortress name disables Embark', () => {
    const { s } = screen();
    s.setFocus('name');
    for (let k = 0; k < 40; k += 1) s.key(press('Backspace'));
    expect(s.reason()).toBe('The fortress needs a name.');
  });
});

describe('T-M1-13 embark: skills', () => {
  it('enforces the per-dwarf point limit and the per-skill maximum', () => {
    const { s } = screen();
    blank(s);
    // Tab to the skills list; + raises the selected skill up to the per-skill maximum of 5.
    s.key(press('Tab'));
    expect(s.focus).toBe('skills');
    for (let k = 0; k < 8; k += 1) s.key(press('+'));
    const d = s.session.party[0];
    const first = Object.values(d?.skills ?? {});
    expect(first).toEqual([5]);
    s.key(press('↓'));
    for (let k = 0; k < 8; k += 1) s.key(press('+'));
    s.key(press('↓'));
    for (let k = 0; k < 8; k += 1) s.key(press('+'));
    const total = Object.values(d?.skills ?? {}).reduce((a, b) => a + b, 0);
    expect(total).toBe(EMBARK_SKILL_POINTS_PER_DWARF);
    expect(text(s)).toContain('Skills (points left: 0)');
    expect(s.setSkill(0, 'mining', 1)).toBe(false);
  });

  it('draws the selected dwarf: name, sex and age, attributes, personality; rerolls and renames', () => {
    const { s } = screen();
    blank(s);
    const d0 = s.session.party[0];
    const t = text(s);
    expect(t).toContain(d0?.name ?? '?');
    expect(t).toMatch(/(Male|Female) · \d+ years/);
    expect(t).toContain('Str ');
    expect(t).toContain('[r] reroll 25 ☼');
    const before = s.session.budget();
    s.key(press('r'));
    expect(s.session.budget()).toBe(before - 25);
    s.key(press('n'));
    expect(s.focus).toBe('rename');
    for (let k = 0; k < 40; k += 1) s.key(press('Backspace'));
    for (const ch of 'Ketil Stone') s.key(press(ch));
    s.key(press('Enter'));
    expect(s.session.party[0]?.name).toBe('Ketil Stone');
  });
});

describe('T-M1-13 embark: supplies and animals', () => {
  it('lists supplies by category with quantities and totals, animals on their own tab', () => {
    const { s } = screen();
    s.key(press('2'));
    expect(s.rows().every((r) => r.category === 'tools')).toBe(true);
    s.key(press('+'));
    const row = s.rows()[0] as CatalogRow;
    expect(text(s)).toContain(`= ${String(row.price).padStart(4)}`);
    s.key(press('→'));
    expect(s.rows().every((r) => r.category === 'food')).toBe(true);
    s.key(press('/'));
    for (const ch of 'pick') s.key(press(ch));
    expect(s.rows().every((r) => r.entry.includes('pick'))).toBe(true);
    s.key(press('Enter'));
    s.key(press('3'));
    expect(s.rows().every((r) => r.category === 'animals')).toBe(true);
    expect(s.rows().length).toBeGreaterThan(5);
  });

  it('respects an entry maximum and a regional condition', () => {
    const { s } = screen(0, 25);
    const anvil = s.rows.call(Object.assign(Object.create(s), { tab: 1, category: 0 })).find((r: CatalogRow) => r.id === 'e_anvil') as CatalogRow;
    expect(s.setSupply(anvil, 1)).toBe(true);
    // T-533: a rise past the maximum is refused and says why.
    expect(s.setSupply(anvil, 1)).toBe(false);
    expect(s.flash).toBe(`At most ${anvil.max} of ${anvil.entry} at embark.`);
    expect(s.count('e_anvil')).toBe(anvil.max);
    expect(temperatureBand(-10)).toBe('frozen');
    expect(temperatureBand(0)).toBe('cold');
    expect(conditionHolds('only when the region is frozen or cold', 0)).toBe(true);
    expect(conditionHolds('only when the region is frozen or cold', 25)).toBe(false);
    s.key(press('3'));
    const yak = s.rows().find((r) => r.id === 'e_yak') as CatalogRow;
    expect(s.setSupply(yak, 1)).toBe(false);
    s.items.selected = s.rows().indexOf(yak);
    expect(text(s)).toContain('Not offered here');
  });

  it('goes back with Esc', () => {
    const { s, back } = screen();
    s.key(press('Esc'));
    expect(back).toEqual([1]);
  });
});
