/**
 * T-533: the starting loadout's UI pass (`ui-screens/embark.md` § Finding things, `02` § Player-facing
 * behavior). Finding a supply, an animal or a skill by typing; the chosen lines in one view; `0` to
 * clear; the wheel and `PageUp` `PageDown` reach every skill at eighty columns; each dwarf's skills in
 * the party list; why a key did nothing; the presets described; unspent points warned; leaving with
 * edits asks first.
 */

import { describe, it, expect } from 'vitest';
import { EMBARK_SKILL_POINTS_PER_DWARF } from '@core/constants';
import { CHOSEN_VIEW, EmbarkScreen, SUPPLY_CATEGORIES } from '@ui/screens/embark';
import { findMatches, presetSummary, skillSummary } from '@ui/screens/embark_lists';
import { keymap, press, registry, strings, surface } from './ui-fixture';

function screen(): { s: EmbarkScreen; asked: string[]; back: number[]; answers: boolean[] } {
  const asked: string[] = [];
  const back: number[] = [];
  const answers: boolean[] = [];
  const s = new EmbarkScreen(registry, 't533-ux', { name: 'Greenhollow', peril: 1, tempC: 12 }, {
    embark: () => {},
    back: () => back.push(1),
    confirm: (id, _params, answer) => {
      asked.push(id);
      answer(answers.shift() ?? false);
    },
  }, keymap, strings);
  return { s, asked, back, answers };
}

function lines(s: EmbarkScreen, cols = 80, rows = 50): string[] {
  const surf = surface(cols, rows);
  s.draw(surf);
  return surf.lines();
}

function type(s: EmbarkScreen, text: string): void {
  for (const ch of text) s.key(press(ch));
}

/** The click at the first cell of `text` on the first row that also holds `row`. */
function click(s: EmbarkScreen, text: string, row: string): void {
  const surf = surface(80, 50);
  s.draw(surf);
  const r = surf.lines().findIndex((l) => l.includes(row));
  expect(r, row).toBeGreaterThanOrEqual(0);
  const line = surf.lines()[r] as string;
  s.pointerDown({ col: line.indexOf(text, line.indexOf(row)) + 1, row: r, button: 0, shift: false, ctrl: false, alt: false, meta: false });
}

describe('T-533 the find fields', () => {
  it('match every word anywhere in the name or the group, in any case', () => {
    expect(findMatches('thread', '5 flax thread', 'Materials')).toBe(true);
    expect(findMatches('IRON pick', 'iron pick', 'Tools')).toBe(true);
    expect(findMatches('seeds', '10 barley seeds', 'Seeds')).toBe(true);
    expect(findMatches('dog anim', 'war dog', 'Animals')).toBe(true);
    expect(findMatches('war dog', 'dog', 'Animals')).toBe(false);
    expect(findMatches('spear', 'iron pick', 'Tools')).toBe(false);
    expect(findMatches('', 'anything')).toBe(true);
  });

  it('on Supplies, `/` and typing find supplies and animals alike, each line naming its group', () => {
    const { s } = screen();
    s.key(press('2'));
    s.key(press('/'));
    type(s, 'dog');
    expect(s.rows().map((r) => r.entry)).toEqual(['dog', 'war dog']);
    const l = lines(s);
    expect(l[3]).toMatch(/Dog +36 ☼ +\[-\] +2 \[\+\] += +72 +Animals/);
    expect(l[4]).toMatch(/War dog +72 ☼ +\[-\] +0 \[\+\] +Animals/);
    // `↓` hands the keys back to the list; `+` then buys a war dog.
    s.key(press('↓'));
    s.key(press('↓'));
    s.key(press('+'));
    expect(s.count('e_war_dog')).toBe(1);
  });

  it('`/` on Animals goes to the Supplies find, which reaches the animals', () => {
    const { s } = screen();
    s.key(press('3'));
    s.key(press('/'));
    expect(s.tab).toBe(1);
    expect(s.filter.focused).toBe(true);
    type(s, 'goat');
    s.key(press('Enter'));
    s.key(press('+'));
    expect(s.count('e_goat')).toBe(1);
  });

  it('a find with no match says so; Esc empties it, and a second Esc leaves', () => {
    const { s, back } = screen();
    s.key(press('2'));
    s.key(press('/'));
    type(s, 'zzz');
    s.key(press('Enter'));
    expect(lines(s).join('\n')).toContain('Nothing matches "zzz".');
    s.key(press('Esc'));
    expect(s.filter.value).toBe('');
    expect(back).toEqual([]);
    s.key(press('Esc'));
    expect(back).toEqual([1]);
  });

  it('`/` starts a new find, and choosing a group ends one', () => {
    const { s } = screen();
    s.key(press('2'));
    s.key(press('/'));
    type(s, 'pick');
    s.key(press('Enter'));
    s.key(press('/'));
    expect(s.filter.value).toBe('');
    type(s, 'axe');
    s.key(press('Enter'));
    expect(s.rows().map((r) => r.entry)).toEqual(['copper axe', 'iron axe']);
    s.key(press('→'));
    expect(s.filter.value).toBe('');
    expect(s.rows().every((r) => r.category === SUPPLY_CATEGORIES[s.category])).toBe(true);
  });

  it('on Dwarves, `/` finds a skill, and `+` raises it once a point is free', () => {
    const { s } = screen();
    s.key(press('/'));
    expect(s.skillFind.focused).toBe(true);
    type(s, 'wood');
    expect(lines(s).join('\n')).toContain('[ wood');
    s.key(press('Enter'));
    expect(s.focus).toBe('skills');
    expect(s.visibleSkills().map((r) => r.id)).toEqual(['woodcutting']);
    // Balanced spends every point: the rise is refused and the keys line says why.
    s.key(press('+'));
    expect(s.session.party[0]?.skills.woodcutting).toBeUndefined();
    expect(lines(s)[45]).toContain(`No skill points left for ${s.session.party[0]?.name}: lower another skill first.`);
    s.key(press('Esc'));
    expect(s.skillFind.value).toBe('');
    expect(lines(s)[45]).toContain('[/] find skill');
    // Free a point with `0` on Axe, then find Woodcutting again.
    s.key(press('/'));
    type(s, 'axe');
    s.key(press('Enter'));
    s.key(press('0'));
    expect(s.session.party[0]?.skills.axe).toBeUndefined();
    s.key(press('/'));
    type(s, 'woodc');
    s.key(press('Enter'));
    s.key(press('+'));
    s.key(press('+'));
    expect(s.session.party[0]?.skills.woodcutting).toBe(2);
  });
});

describe('T-533 the chosen lines and `0`', () => {
  it('the Supplies bar ends with Chosen: every line with a count, supplies and animals, group by group', () => {
    const { s } = screen();
    s.key(press('2'));
    expect(lines(s)[2]).toMatch(/Tools│Food│Drink│Seeds│Materials│Furniture│Chosen/);
    // `←` from the first group wraps to the chosen lines.
    s.key(press('←'));
    expect(s.category).toBe(CHOSEN_VIEW);
    const rows = s.rows();
    expect(rows.length).toBe(s.session.supplies.length);
    const groups = rows.map((r) => r.category);
    expect(groups[0]).toBe('tools');
    expect(groups[groups.length - 1]).toBe('animals');
    const order = [...SUPPLY_CATEGORIES, 'animals'];
    for (let k = 1; k < groups.length; k += 1) expect(order.indexOf(groups[k] as string)).toBeGreaterThanOrEqual(order.indexOf(groups[k - 1] as string));
    // `0` drops the selected line, which leaves the view.
    const first = rows[0]?.id as string;
    s.key(press('0'));
    expect(s.count(first)).toBe(0);
    expect(s.rows().length).toBe(rows.length - 1);
  });

  it('`0` on a skill sets it to nothing and frees its points', () => {
    const { s } = screen();
    s.key(press('Tab'));
    while (s.visibleSkills()[s.skills.selected]?.id !== 'mining') s.key(press('↓'));
    s.key(press('0'));
    expect(s.session.party[0]?.skills.mining).toBeUndefined();
    expect(lines(s).join('\n')).toContain('Skills (points left: 5)');
  });
});

describe('T-533 every skill within reach at eighty columns', () => {
  it('the wheel scrolls the skills to the last one, whose [+] a click then presses', () => {
    const { s } = screen();
    // The skill's own row, not the party list's "Woodcutting 5".
    const row = 'Woodcutting   ';
    expect(lines(s).join('\n')).not.toContain(row);
    for (let k = 0; k < 5; k += 1) s.wheel({ col: 50, row: 20, dy: 1, shift: false, ctrl: false, alt: false, meta: false });
    expect(lines(s).join('\n')).toContain(row);
    // Free a point first: Axe is 2 on the first dwarf.
    s.apply({ type: 'SetSkill', dwarf: 0, skill: 'axe', level: 0 });
    click(s, '[+]', row);
    expect(s.session.party[0]?.skills.woodcutting).toBe(1);
  });

  it('PageDown moves the selection a page and reaches the end of the skills', () => {
    const { s } = screen();
    lines(s);
    s.key(press('Tab'));
    s.key(press('PageDown'));
    expect(s.skills.selected).toBeGreaterThan(20);
    s.key(press('PageDown'));
    expect(s.visibleSkills()[s.skills.selected]?.id).toBe('woodcutting');
  });
});

describe('T-533 the party at a glance', () => {
  it('skillSummary lists the highest skills first and counts what does not fit', () => {
    const skills = [{ id: 'building', name: 'Building' }, { id: 'masonry', name: 'Masonry' }, { id: 'mechanics', name: 'Mechanics' }];
    expect(skillSummary({ masonry: 5, mechanics: 3, building: 2 }, skills, 40)).toBe('Masonry 5, Mechanics 3, Building 2');
    expect(skillSummary({ masonry: 5, mechanics: 3, building: 2 }, skills, 26)).toBe('Masonry 5, Mechanics 3 +1');
    expect(skillSummary({}, skills, 26)).toBe('');
  });

  it('each dwarf has a second line with its skills; a dwarf with none says so', () => {
    const { s } = screen();
    s.apply({ type: 'SetSkill', dwarf: 1, skill: 'mining', level: 0 });
    s.apply({ type: 'SetSkill', dwarf: 1, skill: 'building', level: 0 });
    s.apply({ type: 'SetSkill', dwarf: 1, skill: 'axe', level: 0 });
    const l = lines(s);
    expect(l[3]).toMatch(/^ {3}Mining 5, Building 3 \+1 +│/);
    expect(l[5]).toMatch(/^ {3}no skills yet +│/);
  });

  it('a party too long for two lines each takes one line each and scrolls', () => {
    const { s } = screen();
    const l = lines(s, 80, 14);
    const names = s.session.party.map((d) => d.name);
    expect(l[2]).toContain(names[0]);
    expect(l[3]).toContain(names[1]);
    s.key(press('↓', {}));
    for (let k = 0; k < 6; k += 1) s.key(press('↓'));
    expect(lines(s, 80, 14).join('\n')).toContain(names[6]);
  });

  it('the footer names the dwarves whose points would be lost', () => {
    const { s } = screen();
    expect(lines(s)[48]).not.toContain('Unspent');
    const name = s.session.party[2]?.name as string;
    s.apply({ type: 'SetSkill', dwarf: 2, skill: 'carpentry', level: 2 });
    expect(lines(s)[48]).toContain(`Unspent skill points: ${name} ${EMBARK_SKILL_POINTS_PER_DWARF - 7}`);
  });
});

describe('T-533 presets, keys and leaving', () => {
  it('presetSummary names each dwarf\'s main skill, the first named on a tie, counting repeats', () => {
    const named = [{ id: 'brewing', name: 'Brewing' }, { id: 'cooking', name: 'Cooking' }, { id: 'mining', name: 'Mining' }];
    expect(presetSummary([
      { dwarf: 0, skill: 'mining', level: 5 }, { dwarf: 1, skill: 'mining', level: 5 },
      { dwarf: 2, skill: 'cooking', level: 5 }, { dwarf: 2, skill: 'brewing', level: 5 },
    ], named)).toBe('Mining x2·Cooking');
  });

  it('the presets menu describes each preset in full at eighty columns and opens on the current one', () => {
    const { s } = screen();
    s.applyPreset('warband');
    s.key(press('p'));
    const l = lines(s);
    expect(l.find((x) => x.includes('Balanced'))).toMatch(/Balanced +1,480 ☼ Mining x2·Woodcutting·Masonry·Farming·Cooking·Medicine/);
    expect(l.find((x) => x.includes('Warband'))).toMatch(/Warband +1,495 ☼ Axe x2·Crossbow·Armorsmithing·Mining·Farming·Medicine/);
    expect(l.join('\n')).not.toContain('»');
    expect(s.presetOptions()[s.presets.highlighted]?.id).toBe('warband');
  });

  it('every tab fits eighty columns whole, with its keys line', () => {
    const { s } = screen();
    for (const tab of ['1', '2', '3']) {
      s.key(press(tab));
      const l = lines(s);
      expect(l.join('\n'), tab).not.toContain('»');
      expect(l[45], tab).toMatch(/\[\+\]\[-\]/);
    }
  });

  it('Esc after edits asks c_leave_embark, default No; without edits it leaves at once', () => {
    const { s, asked, back, answers } = screen();
    s.key(press('2'));
    s.key(press('+'));
    s.key(press('Esc'));
    expect(asked).toEqual(['c_leave_embark']);
    expect(back).toEqual([]);
    answers.push(true);
    s.key(press('Esc'));
    expect(back).toEqual([1]);
    const fresh = screen();
    fresh.s.key(press('Esc'));
    expect(fresh.asked).toEqual([]);
    expect(fresh.back).toEqual([1]);
    const table = registry.table<{ id: string; default: string }>('confirmations');
    expect(table.byId('c_leave_embark')?.default).toBe('no');
  });
});

describe('T-533 with testing mode (T-532)', () => {
  it('`/` finds on every tab: skills, supplies, and the Items field; Esc empties a find before it leaves', () => {
    const { s, back } = screen();
    s.key(press('t'));
    // Dwarves: the find covers every skill in testing mode, and `*` gives the found one to every dwarf.
    s.key(press('/'));
    type(s, 'runecr');
    s.key(press('Enter'));
    expect(s.visibleSkills().map((r) => r.id)).toEqual(['runecraft']);
    for (let k = 0; k < 3; k += 1) s.key(press('+'));
    s.key(press('*'));
    expect(s.session.party.every((d) => d.skills.runecraft === 3)).toBe(true);
    // Items: `/` starts an empty find over the selected field; Esc in the field empties it.
    s.key(press('4'));
    s.key(press('/'));
    expect(s.filter.value).toBe('');
    type(s, 'staff');
    expect(s.draft.item).toBe('staff');
    s.key(press('Enter'));
    expect(s.filter.value).toBe('staff');
    s.key(press('Esc'));
    expect(s.filter.value).toBe('');
    expect(back).toEqual([]);
  });

  it('`0` on an Items line removes it, like `x`', () => {
    const { s } = screen();
    s.key(press('t'));
    s.key(press('4'));
    s.key(press('a'));
    expect(s.session.items).toHaveLength(1);
    for (let k = 0; k < 5; k += 1) s.key(press('↓'));
    s.key(press('0'));
    expect(s.session.items).toHaveLength(0);
  });

  it('names its own keys, warns of no unspent points, and keeps the body and bottom line whole at eighty columns', () => {
    const { s } = screen();
    s.key(press('t'));
    s.apply({ type: 'SetSkill', dwarf: 0, skill: 'mining', level: 0 });
    const l = lines(s);
    expect(l[45]).toContain('[*] to every dwarf');
    expect(l[44]).toContain('[a] add dwarf');
    expect(l.join('\n')).not.toContain('Unspent');
    for (const tab of ['1', '2', '3', '4']) {
      s.key(press(tab));
      // The testing title gives way to the four tabs (T-532); every other line is whole.
      expect(lines(s).slice(1).join('\n'), tab).not.toContain('»');
    }
  });
});
