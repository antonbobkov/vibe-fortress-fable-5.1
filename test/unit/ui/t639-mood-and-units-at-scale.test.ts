/**
 * T-639: the Mood and Units panels at thirty dwarves and more. Mood opens on a summary of the
 * thoughts held by most dwarves, with their weights and counts, and `Enter` on one lists who holds
 * it; names are as wide as the panel allows and told apart when they must be shortened; the Units
 * list marks a title holder and the wounded-first sort; a title given or taken away writes a note;
 * the inspector lists no thought that rounds to 0; a soldier on duty is not `restless`.
 */

import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { CombatReader } from '@systems/combat';
import type { MoraleReader, ThoughtView } from '@systems/morale';
import { AnnouncementLog } from '@ui/announcements';
import { heldThoughts } from '@ui/panels/mood';
import { fitName } from '@ui/panels/units';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

const FIRST = ['Ketil', 'Orm', 'Halvar', 'Einar', 'Torvald', 'Brand', 'Ulf', 'Sigurd', 'Rurik', 'Gorm', 'Asgeir', 'Hakon', 'Leif', 'Bjarni'];
const FAMILY = ['Ironvein', 'Coldhammer', 'Stonebeard', 'Emberhall', 'Deepshield', 'Grimsong'];

/** Thirty dwarves: two Ragnhilds whose family names share their first three letters, and twenty-eight others. */
function names(): string[] {
  const out = ['Ragnhild Brightvein', 'Ragnhild Brimhammer'];
  for (let k = 0; out.length < 30; k += 1) out.push(`${FIRST[k % FIRST.length] as string} ${FAMILY[k % FAMILY.length] as string}`);
  return out;
}

function thought(text: string, value: number): ThoughtView {
  return { id: text, text, value, remainingHours: null };
}

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const dwarves: EntityId[] = names().map((name, k) => w.spawnDwarf({ at: w.index(10 + (k % 15), 10 + Math.floor(k / 15), z), name, ageYears: 30 }));
  const layout = computeLayout(80, 50, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c),
    speed: () => 0, setSpeed: () => {},
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = (): string[] => { const s = surface(80, 50); screen.draw(s); return s.lines(); };
  /** The sidebar's text, one line per row. */
  const side = (): string[] => draw().map((l) => l.slice(80 - 36));
  return { w, screen, dwarves, draw, side };
}

/**
 * The fortress's thoughts: twenty friends mourned (one stoic at half), twelve lavish meals, eight
 * tired, five chats, three fine meals, two raw meals; every dwarf ate in a bare hall (0).
 */
function thoughtsOf(dwarves: readonly EntityId[]): (id: EntityId) => ThoughtView[] {
  return (id) => {
    const k = dwarves.indexOf(id);
    const out = [thought('Ate in a bare hall.', 0.3)];
    if (k < 20) out.push(thought('My friend is dead.', k === 0 ? -7.6 : -15));
    if (k >= 18) out.push(thought('Had a lavish meal.', 10));
    if (k % 4 === 1) out.push(thought('I am tired.', -3.2));
    if (k % 6 === 2) out.push(thought('Had a chat.', 3));
    if (k % 10 === 3) out.push(thought('Had a fine meal.', 5));
    if (k % 15 === 4) out.push(thought('Ate something raw.', -1));
    return out;
  };
}

describe('T-639 the Mood panel at thirty dwarves', () => {
  it('opens on the five thoughts held by most dwarves, with their weights and counts', () => {
    const f = setup('t639-summary');
    const morale = f.w.readers.of<MoraleReader>('15');
    vi.spyOn(morale, 'thoughts').mockImplementation(thoughtsOf(f.dwarves));
    const held = heldThoughts(morale, f.dwarves);
    expect(held.map((t) => [t.text, t.value, t.holders.length])).toEqual([
      ['My friend is dead.', -15, 20],
      ['Had a lavish meal.', 10, 12],
      ['I am tired.', -3, 8],
      ['Had a chat.', 3, 5],
      ['Had a fine meal.', 5, 3],
      ['Ate something raw.', -1, 2],
    ]);
    f.screen.openPanel('mood');
    const side = f.side();
    // The glyph set draws `×` as `x`.
    expect(side[2]).toMatch(/Thoughts held by most/);
    expect(side.slice(3, 8).map((l) => l.slice(1).trim().replace(/\s+/g, ' '))).toEqual([
      '-15 My friend is dead. x20',
      '+10 Had a lavish meal. x12',
      '-3 I am tired. x8',
      '+3 Had a chat. x5',
      '+5 Had a fine meal. x3',
    ]);
    const text = side.join('\n');
    // Neither the sixth thought nor one that rounds to 0 is in the summary.
    expect(text.split('Ate something raw.').length - 1).toBe(side.filter((l) => /^│ {3}.*Ate something raw\./.test(l)).length);
    expect(text).not.toContain('Ate in a bare hall.');
    // The table follows, each dwarf's thoughts whole on the row under its name.
    expect(text).toMatch(/Ragnhild Brightvein +Fine/);
    expect(text).toMatch(/\n│ {3}-15 My friend is dead\. -3 I a/);
  });

  it('Enter on a summary row lists only who holds the thought; Esc lists every dwarf again', () => {
    const f = setup('t639-holders');
    vi.spyOn(f.w.readers.of<MoraleReader>('15'), 'thoughts').mockImplementation(thoughtsOf(f.dwarves));
    f.screen.openPanel('mood');
    expect(f.screen.mood.selected(f.screen.ctx)).toBe(0);
    expect(f.side().join('\n')).toContain('[Enter] holders');
    f.screen.key(press('↓'));
    f.screen.key(press('Enter'));
    expect(f.screen.mood.held).toBe('Had a lavish meal.');
    expect(f.screen.mood.rows(f.screen.ctx)).toEqual(f.dwarves.slice(18));
    // The cursor is on the first holder, the listed thought marked, and Enter now inspects.
    expect(f.screen.mood.selected(f.screen.ctx)).toBe(f.dwarves[18]);
    const side = f.side();
    expect(side[4]).toMatch(/^│ •\+10 Had a lavish meal\./);
    expect(side.join('\n')).not.toContain('Ketil Ironvein');
    expect(side.join('\n')).toContain('[Enter] inspect  [Esc] all');
    f.screen.key(press('Esc'));
    expect(f.screen.mood.held).toBeNull();
    expect(f.screen.ui.panel).toBe('mood');
    expect(f.screen.mood.rows(f.screen.ctx)).toHaveLength(30);
    // A click on a summary row lists its holders as well.
    const row = f.side().findIndex((l) => l.includes('Had a fine meal.'));
    f.screen.pointerDown({ col: 80 - 36 + 5, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.screen.mood.held).toBe('Had a fine meal.');
    expect(f.screen.mood.rows(f.screen.ctx)).toEqual([f.dwarves[3], f.dwarves[13], f.dwarves[23]]);
  });

  it('names two dwarves apart that share a given name and the start of a family name', () => {
    // The whole name when it fits; else the initial and the family name; else cut.
    const all = ['Ragnhild Brightvein', 'Ragnhild Brimhammer', 'Ragna Ironvein', 'Ragnhild Ironvein'];
    expect(fitName('Ragnhild Brightvein', 19, all)).toBe('Ragnhild Brightvein');
    expect(fitName('Ragnhild Brightvein', 14, all)).toBe('R. Brightvein');
    expect(fitName('Ragnhild Brimhammer', 14, all)).toBe('R. Brimhammer');
    expect(fitName('Ragnhild Brightvein', 12, all)).toBe('R. Brightve»');
    expect(fitName('Ragnhild Brimhammer', 12, all)).toBe('R. Brimhamm»');
    // "R. Ironvein" would name both: the whole name is cut instead.
    expect(fitName('Ragna Ironvein', 12, all)).toBe('Ragna Ironv»');
    expect(fitName('Ragnhild Ironvein', 12, all)).toBe('Ragnhild Ir»');
    // In the panels, at sidebar width, both are whole.
    const f = setup('t639-names');
    f.screen.openPanel('mood');
    let text = f.side().join('\n');
    expect(text).toContain('Ragnhild Brightvein');
    expect(text).toContain('Ragnhild Brimhammer');
    f.screen.openPanel('units');
    text = f.side().join('\n');
    expect(text).toContain('Ragnhild Brightvein');
    expect(text).toContain('Ragnhild Brimhammer');
  });
});

describe('T-639 the Units panel at thirty dwarves', () => {
  it('marks a title holder after the name, and [S-w] hurt while the wounded come first', () => {
    const f = setup('t639-units');
    f.w.submit({ type: 'AssignTitle', dwarfId: f.dwarves[2] as EntityId, title: 'thane' });
    f.w.step(1);
    f.screen.openPanel('units');
    let side = f.side();
    expect(side.join('\n')).toMatch(/Ketil Ironvein ♦ +[☺☻‼] /);
    expect(side.find((l) => l.includes('[S-w] hurt'))).not.toContain('■');
    f.screen.key(press('W', { shift: true }));
    side = f.side();
    expect(side.find((l) => l.includes('[S-w] hurt'))).toMatch(/\[S-m\] squad {2}\[S-w\] hurt ■/);
    // The caption is a button as well.
    f.screen.key(press('W', { shift: true }));
    const row = f.side().findIndex((l) => l.includes('[S-w] hurt'));
    f.screen.pointerDown({ col: 80 - 36 + (f.side()[row] as string).indexOf('[S-w]') + 1, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.screen.units.woundedFirst).toBe(true);
    f.screen.key(press('W', { shift: true }));
    expect(f.side().find((l) => l.includes('[S-w] hurt'))).not.toContain('■');
  });

  it('giving and taking away a title writes a note naming the title', () => {
    const f = setup('t639-title-note');
    const log = new AnnouncementLog(strings, registry);
    log.register(f.w.game.world.registrations.announcements);
    const thane = f.dwarves[2] as EntityId;
    f.w.submit({ type: 'AssignTitle', dwarfId: thane, title: 'thane' });
    f.w.step(1);
    f.w.submit({ type: 'AssignTitle', dwarfId: 0, title: 'chief_medic' });
    f.w.submit({ type: 'AssignTitle', dwarfId: 0, title: 'thane' });
    f.w.step(1);
    const lines = f.w.events('TitleAssigned').map((e) => log.announce(e as GameEvent, f.w.readers, 1)?.line.text ?? null);
    expect(lines).toEqual(['Ketil Ironvein is now the Thane.', null, 'Ketil Ironvein is no longer the Thane.']);
  });
});

describe('T-639 thoughts in the inspector and on duty', () => {
  it('Look lists only the thoughts that round to a whole point or more', () => {
    const f = setup('t639-look');
    const id = f.dwarves[0] as EntityId;
    vi.spyOn(f.w.readers.of<MoraleReader>('15'), 'thoughts').mockReturnValue([thought('The Thane sleeps in a hovel.', -0.4), thought('Ate in a decent hall.', 0.3), thought('My friend is dead.', -6)]);
    f.screen.inspectCreature(id);
    const text = f.side().join('\n');
    expect(text).toContain('-6 My friend is dead.');
    expect(text).not.toContain('The Thane sleeps in a hovel.');
    expect(text).not.toContain('Ate in a decent hall.');
  });

  it('a soldier on duty is not restless; off duty, the same purpose makes it so', () => {
    const w = new TestWorld({ seed: 't639-duty', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const soldier = w.spawnDwarf({ at: w.index(10, 10, z), name: 'Palnir Wolfaxe', ageYears: 30 });
    w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    w.step(1);
    const combat = w.readers.of<CombatReader>('16');
    const squad = combat.squads()[0]!;
    w.submit({ type: 'SetSquadMembers', squadId: squad.id, members: [soldier] });
    w.submit({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' });
    w.step(1);
    expect(combat.onDuty(soldier)).toBe(true);
    const restless = (): boolean => {
      const needs = w.game.world.entities.get(soldier, C.Needs)!;
      w.game.world.entities.add(soldier, C.Needs, { ...needs, purpose: 90 });
      w.step(TICKS_PER_HOUR + 1);
      return w.readers.of<MoraleReader>('15').thoughts(soldier).some((t) => t.id === 'restless');
    };
    expect(restless()).toBe(false);
    w.submit({ type: 'SetSquadMode', squadId: squad.id, mode: 'off' });
    w.step(1);
    expect(combat.onDuty(soldier)).toBe(false);
    expect(restless()).toBe(true);
  });
});
