/**
 * U-06: the units panel's multi-select, mood glyph, titles, renames and sleep hour (UI audit M10),
 * the squad's multi-select member list, leader, barracks and name (M11, § 3 "Add 6 dwarves to a
 * squad"), the `text_input` dialog, and the help rows of the new keys.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import type { DwarvesReader } from '@systems/dwarves';
import { keyLabel, LEGACY_BINDINGS } from '@ui/keymap';
import { helpKeyRows } from '@ui/panels/help';
import { moodGlyph } from '@ui/panels/units';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { TextInputScreen } from '@ui/screens/text_input';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

interface Fixture {
  w: TestWorld;
  screen: FortressScreen;
  sent: Command[];
  dwarves: EntityId[];
  speeds: number[];
  /** The last `text_input` request: answer it to finish a rename. */
  prompts: { title: string; value: string; maxLength: number; answer: (text: string | null) => void }[];
  managers: { marked?: readonly EntityId[]; focus?: EntityId | undefined }[];
  draw(): string[];
  click(text: string): void;
}

function setup(seed: string, count: number, children = 0): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const dwarves: EntityId[] = [];
  for (let k = 0; k < count; k += 1) {
    dwarves.push(w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone`, ageYears: k < children ? 3 : 30 }));
  }
  const sent: Command[] = [];
  const speeds: number[] = [];
  const prompts: Fixture['prompts'] = [];
  const managers: Fixture['managers'] = [];
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 1,
    setSpeed: (s) => { speeds.push(s); },
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => layout,
    precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 0,
    prompt: (spec, answer) => { prompts.push({ ...spec, answer }); },
    laborManager: (open) => { managers.push(open); },
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = (): string[] => {
    const s = surface(80, 42);
    screen.draw(s);
    return s.lines();
  };
  /** Click the first cell of a text on the screen. */
  const click = (text: string): void => {
    const lines = draw();
    const row = lines.findIndex((l) => l.includes(text));
    if (row < 0) throw new Error(`not on screen: ${text}`);
    screen.pointerDown({ col: (lines[row] as string).indexOf(text) + 1, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
  };
  return { w, screen, sent, dwarves, speeds, prompts, managers, draw, click };
}

const combat = (w: TestWorld): CombatReader => w.readers.of<CombatReader>('16');
const dwarvesReader = (w: TestWorld): DwarvesReader => w.readers.of<DwarvesReader>('10');
const nameOf = (w: TestWorld, id: EntityId): string => w.readers.entities.get(id, C.Creature)?.name ?? '';

function squad(f: Fixture, name = 'The Hearthguard'): EntityId {
  f.w.submit({ type: 'CreateSquad', name });
  f.w.step(1);
  return combat(f.w).squads().find((sq) => sq.name === name)?.id ?? 0;
}

describe('U-06 units: marks and the mood glyph (M10)', () => {
  it('Space marks the cursor row instead of pausing; * marks all; Shift-click marks a range', () => {
    const f = setup('u06-units-marks', 8);
    f.screen.openPanel('units');
    f.draw();
    expect(f.screen.key(press(' '))).toBe(true);
    f.screen.key(press('↓'));
    f.screen.key(press('↓'));
    f.screen.key(press('Space'));
    expect(f.speeds).toEqual([]);
    expect(f.screen.units.marks.list(f.dwarves)).toEqual([f.dwarves[0], f.dwarves[2]]);
    const lines = f.draw();
    expect(lines.some((l) => l.includes('•Dwarf00 Ston'))).toBe(true);
    expect(lines.some((l) => l.includes('2 marked'))).toBe(true);
    // Shift-click the sixth row: the range from the last marked row.
    const row = lines.findIndex((l) => l.includes('Dwarf05 Ston'));
    f.screen.pointerDown({ col: (lines[row] as string).indexOf('Dwarf05') + 1, row, button: 0, shift: true, ctrl: false, alt: false, meta: false });
    expect(f.screen.units.marks.list(f.dwarves)).toEqual([f.dwarves[0], ...f.dwarves.slice(2, 6)]);
    f.screen.key(press('*', { shift: true }));
    expect(f.screen.units.marks.size).toBe(8);
    f.screen.key(press('*', { shift: true }));
    expect(f.screen.units.marks.size).toBe(0);
    // By mouse: the action row's buttons.
    f.click('[Space] mark');
    expect(f.screen.units.marks.size).toBe(1);
    f.click('[*] all');
    expect(f.screen.units.marks.size).toBe(8);
    // With the units panel closed, Space pauses as before.
    f.screen.openPanel(null);
    f.screen.key(press(' '));
    expect(f.speeds).toEqual([0]);
  });

  it('the mood tier glyph follows the name, and differs by more than its colour', () => {
    const f = setup('u06-units-mood', 3);
    f.screen.openPanel('units');
    const line = f.draw().find((l) => l.includes('Dwarf01 Ston')) ?? '';
    expect(line).toMatch(/Dwarf01 Ston\s+[☺☻‼] /);
    expect([moodGlyph(0), moodGlyph(1), moodGlyph(2), moodGlyph(4)]).toEqual([
      { glyph: '‼', color: 'danger' },
      { glyph: '☻', color: 'alert' },
      { glyph: '☺', color: 'text' },
      { glyph: '☺', color: 'text' },
    ]);
  });

  // U-03 (D-U2): bare `l` always opens Labors, so the marked dwarves' labor manager is `[S-l]`.
  it('[S-l] with marked dwarves opens the labor manager on them; Enter in the labors panel opens it on the row', () => {
    const f = setup('u06-units-labors', 5);
    f.screen.openPanel('units');
    f.draw();
    f.screen.key(press('l'));
    expect(f.managers).toEqual([]);
    expect(f.screen.ui.panel).toBe('labors');
    f.screen.key(press('↓'));
    f.screen.key(press('Enter'));
    expect(f.managers).toEqual([{ focus: f.dwarves[1] }]);
    f.click('[Enter] labor manager');
    expect(f.managers).toHaveLength(2);
    f.screen.openPanel('units');
    f.screen.key(press(' '));
    f.screen.key(press('↓'));
    f.screen.key(press(' '));
    f.screen.key(press('L', { shift: true }));
    expect(f.managers[2]).toEqual({ marked: [f.dwarves[0], f.dwarves[1]], focus: f.dwarves[1] });
  });

  it('[ and ] move the sleep hour of the selection (SetSchedule)', () => {
    const f = setup('u06-units-sleep', 3);
    f.screen.openPanel('units');
    const hour = f.w.readers.entities.get(f.dwarves[0] as EntityId, C.Schedule)?.sleepStartHour ?? -1;
    expect(f.draw().some((l) => l.includes(`sleep ${String(hour).padStart(2, '0')}h`))).toBe(true);
    f.screen.key(press(']'));
    expect(f.sent).toEqual([{ type: 'SetSchedule', dwarfId: f.dwarves[0], sleepStartHour: (hour + 1) % 24 }]);
    f.w.step(1);
    expect(f.w.readers.entities.get(f.dwarves[0] as EntityId, C.Schedule)?.sleepStartHour).toBe((hour + 1) % 24);
    f.sent.length = 0;
    f.screen.key(press('*', { shift: true }));
    f.screen.key(press('['));
    expect(f.sent.map((c) => c['dwarfId'])).toEqual(f.dwarves);
    expect(f.sent.every((c) => c.type === 'SetSchedule')).toBe(true);
  });
});

describe('U-06 units: titles and renames round-trip (M10)', () => {
  it('[S-t] gives a title to the cursor dwarf, shows the holder, and takes it away again', () => {
    const f = setup('u06-units-title', 4, 1);
    f.screen.openPanel('units');
    f.draw();
    f.screen.key(press('↓'));
    f.screen.key(press('T', { shift: true }));
    expect(f.screen.units.choice).toEqual({ kind: 'title', selected: 0 });
    let text = f.draw().join('\n');
    expect(text).toContain('Title for Dwarf01 Stone');
    expect(text).toMatch(/Thane\s+\(vacant\)/);
    expect(text).toMatch(/Chief medic\s+\(vacant\)/);
    f.screen.key(press('↓'));
    f.screen.key(press('Enter'));
    expect(f.sent).toEqual([{ type: 'AssignTitle', dwarfId: f.dwarves[1], title: 'warden' }]);
    expect(f.screen.units.choice).toBeNull();
    f.w.step(1);
    expect(dwarvesReader(f.w).holder('warden')).toBe(f.dwarves[1]);
    expect(f.w.events('TitleAssigned').length).toBeGreaterThan(0);
    // The list now names the holder; Enter on a held title takes it away.
    f.click('[S-t] title');
    text = f.draw().join('\n');
    expect(text).toMatch(/Warden\s+Dwarf01 Stone/);
    f.click('Warden');
    expect(f.sent[1]).toEqual({ type: 'AssignTitle', dwarfId: 0, title: 'warden' });
    expect(f.screen.currentNotice).toBe('Dwarf01 Stone is no longer the Warden.');
    f.w.step(1);
    expect(dwarvesReader(f.w).holder('warden')).toBe(0);
    // A child cannot hold one: nothing is sent and the status row says why.
    f.sent.length = 0;
    f.screen.key(press('↑'));
    f.screen.key(press('T', { shift: true }));
    f.screen.key(press('Enter'));
    expect(f.sent).toEqual([]);
    expect(f.screen.currentNotice).toBe('Dwarf00 Stone is a child: children cannot hold a title.');
    // Esc closes the chooser before the panel.
    f.screen.key(press('T', { shift: true }));
    f.screen.key(press('Esc'));
    expect(f.screen.units.choice).toBeNull();
    expect(f.screen.ui.panel).toBe('units');
  });

  it('[S-n] renames through the text input; cancel and an unchanged name send nothing', () => {
    const f = setup('u06-units-rename', 2);
    f.screen.openPanel('units');
    f.draw();
    f.screen.key(press('N', { shift: true }));
    expect(f.prompts).toHaveLength(1);
    expect(f.prompts[0]).toMatchObject({ title: 'Rename Dwarf00 Stone', value: 'Dwarf00 Stone', maxLength: 24 });
    f.prompts[0]?.answer(null);
    f.prompts[0]?.answer('Dwarf00 Stone');
    expect(f.sent).toEqual([]);
    f.click('[S-n] rename');
    f.prompts[1]?.answer('Urist Goldhand');
    expect(f.sent).toEqual([{ type: 'RenameDwarf', dwarfId: f.dwarves[0], name: 'Urist Goldhand' }]);
    f.w.step(1);
    expect(nameOf(f.w, f.dwarves[0] as EntityId)).toBe('Urist Goldhand');
    expect(f.draw().join('\n')).toContain('Urist Goldha');
  });

  it('the text input dialog edits, refuses an empty name with a reason, and cancels with Esc', () => {
    const answers: (string | null)[] = [];
    const dialog = new TextInputScreen({ title: 'Rename Ketil', value: 'Ketil', maxLength: 8 }, strings, (t) => answers.push(t));
    const s = surface(60, 20);
    dialog.draw(s);
    expect(s.lines().join('\n')).toContain('Rename Ketil');
    expect(s.lines().join('\n')).toContain('[Enter] accept');
    for (let k = 0; k < 5; k += 1) dialog.key(press('Backspace'));
    dialog.key(press('Enter'));
    expect(answers).toEqual([]);
    expect(dialog.message).toBe('Type at least 1 character.');
    for (const ch of 'Orm the Longwinded') dialog.key(press(ch));
    expect(dialog.field.value).toBe('Orm the ');
    dialog.key(press('Enter'));
    expect(answers).toEqual(['Orm the']);
    dialog.key(press('Esc'));
    expect(answers).toEqual(['Orm the', null]);
    // The buttons do the same by mouse.
    const s2 = surface(60, 20);
    dialog.draw(s2);
    const row = s2.lines().findIndex((l) => l.includes('[Esc] cancel'));
    dialog.pointerDown({ col: (s2.lines()[row] as string).indexOf('[Esc] cancel') + 1, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(answers).toEqual(['Orm the', null, null]);
  });
});

describe('U-06 squads: adding 6 dwarves takes one multi-select (M11)', () => {
  it('from the military panel: [S-a] (U-03: `a` opens the Log), six marks, Enter sends one SetSquadMembers', () => {
    const f = setup('u06-mil-add', 9, 1);
    const id = squad(f);
    f.screen.openPanel('military');
    f.draw();
    f.screen.key(press('A', { shift: true }));
    expect(f.draw().join('\n')).toContain('Add: 0 marked, 6 free');
    // The child is not offered.
    expect(f.draw().join('\n')).not.toContain('Dwarf00 Stone');
    for (let k = 0; k < 6; k += 1) {
      f.screen.key(press(' '));
      f.screen.key(press('↓'));
    }
    expect(f.speeds).toEqual([]);
    expect(f.draw().join('\n')).toContain('Add: 6 marked, 6 free');
    // A seventh has no room.
    f.screen.key(press(' '));
    expect(f.screen.currentNotice).toBe('The squad has room for 6 more.');
    f.sent.length = 0;
    f.screen.key(press('Enter'));
    expect(f.sent).toEqual([{ type: 'SetSquadMembers', squadId: id, members: f.dwarves.slice(1, 7) }]);
    f.w.step(1);
    expect(combat(f.w).squad(id)?.members).toEqual(f.dwarves.slice(1, 7));
    expect(f.w.events('CommandRejected')).toHaveLength(0);
    // A full squad says so instead of opening an empty list.
    f.screen.key(press('A', { shift: true }));
    expect(f.screen.military.memberChoice).toBeNull();
    expect(f.screen.currentNotice).toBe('The Hearthguard is full (6 members).');
    // Remove two by mouse: click two rows, then [Enter].
    f.click('[r] remove');
    f.click('Dwarf02 Stone');
    f.click('Dwarf04 Stone');
    f.sent.length = 0;
    f.click('[Enter] choose');
    expect(f.sent).toEqual([{ type: 'SetSquadMembers', squadId: id, members: [f.dwarves[1], f.dwarves[3], f.dwarves[5], f.dwarves[6]] }]);
  });

  it('Enter with nothing marked adds the cursor row; * marks as many as fit', () => {
    const f = setup('u06-mil-one', 8);
    const id = squad(f);
    f.screen.openPanel('military');
    f.draw();
    f.screen.key(press('A', { shift: true }));
    f.screen.key(press('↓'));
    f.screen.key(press('Enter'));
    expect(f.sent).toEqual([{ type: 'SetSquadMembers', squadId: id, members: [f.dwarves[1]] }]);
    f.w.step(1);
    f.screen.key(press('A', { shift: true }));
    f.screen.key(press('*', { shift: true }));
    expect(f.screen.military.memberChoice?.marks.size).toBe(5);
    f.screen.key(press('Enter'));
    f.w.step(1);
    expect(combat(f.w).squad(id)?.members).toHaveLength(6);
  });

  it('from the units panel: mark six, [S-m], Enter sends one SetSquadMembers and says who was left out', () => {
    const f = setup('u06-units-squad', 8, 1);
    f.screen.openPanel('units');
    f.draw();
    f.screen.key(press('M', { shift: true }));
    expect(f.screen.units.choice).toBeNull();
    expect(f.screen.currentNotice).toBe('There are no squads yet: make one in Military [m].');
    const id = squad(f);
    for (let k = 0; k < 7; k += 1) {
      f.screen.key(press(' '));
      f.screen.key(press('↓'));
    }
    f.screen.key(press('↑'));
    f.screen.key(press('M', { shift: true }));
    expect(f.draw().join('\n')).toContain('Add 7 to a squad');
    expect(f.draw().join('\n')).toMatch(/The Hearthguard\s+0\/6/);
    f.screen.key(press('Enter'));
    expect(f.sent).toEqual([{ type: 'SetSquadMembers', squadId: id, members: f.dwarves.slice(1, 7) }]);
    expect(f.screen.currentNotice).toBe('Added 6 to The Hearthguard; 1 left out (a child, already in a squad, or no room).');
    f.w.step(1);
    expect(combat(f.w).squad(id)?.members).toEqual(f.dwarves.slice(1, 7));
    expect(f.screen.units.marks.size).toBe(0);
  });
});

describe('U-06 squads: leader, barracks and name (M11)', () => {
  it('[S-l] picks the leader among the members', () => {
    const f = setup('u06-mil-leader', 4);
    const id = squad(f);
    f.screen.openPanel('military');
    f.draw();
    f.screen.key(press('L', { shift: true }));
    expect(f.screen.military.memberChoice).toBeNull();
    expect(f.screen.currentNotice).toBe('The Hearthguard has no members.');
    f.w.submit({ type: 'SetSquadMembers', squadId: id, members: f.dwarves.slice(0, 3) });
    f.w.step(1);
    f.screen.key(press('L', { shift: true }));
    expect(f.draw().join('\n')).toContain('Squad leader');
    f.screen.key(press('↓'));
    f.screen.key(press('↓'));
    f.screen.key(press('Enter'));
    expect(f.sent).toEqual([{ type: 'SetSquadLeader', squadId: id, leaderId: f.dwarves[2] }]);
    f.w.step(1);
    expect(combat(f.w).squad(id)?.leaderId).toBe(f.dwarves[2]);
    expect(f.draw().join('\n')).toMatch(/Leader\s+Dwarf02 Stone/);
    // By mouse.
    f.click('[S-l] pick');
    expect(f.draw().join('\n')).toContain('Dwarf02 Stone (leader)');
    f.click('Dwarf00 Stone');
    f.w.step(1);
    expect(combat(f.w).squad(id)?.leaderId).toBe(f.dwarves[0]);
  });

  it('[S-b] assigns a barracks zone with SetZoneSetting, and moves it', () => {
    const f = setup('u06-mil-barracks', 2);
    const id = squad(f);
    f.screen.openPanel('military');
    expect(f.draw().join('\n')).toContain('No barracks  [S-b] assign');
    f.screen.key(press('B', { shift: true }));
    expect(f.screen.military.memberChoice).toBeNull();
    expect(f.screen.currentNotice).toBe('There is no barracks zone: make one in Zones [z].');
    const tiles = (x: number): number[] => [f.w.index(x, 20, z), f.w.index(x + 1, 20, z)];
    const a = f.w.zone('barracks', tiles(20));
    const b = f.w.zone('barracks', tiles(30));
    f.screen.key(press('B', { shift: true }));
    const text = f.draw().join('\n');
    expect(text).toContain('None');
    expect(text).toContain('Barracks #1');
    expect(text).toContain('Barracks #2');
    f.screen.key(press('↓'));
    f.screen.key(press('↓'));
    f.screen.key(press('Enter'));
    expect(f.sent).toEqual([{ type: 'SetZoneSetting', zoneId: b, key: 'squad', value: id }]);
    f.w.step(1);
    const buildings = f.w.readers.of<BuildingsReader>('14');
    expect(buildings.zone(b)?.settings['squad']).toBe(id);
    expect(f.draw().join('\n')).toContain('Barracks #2  [S-b] change');
    // Moving it frees the old zone; "None" clears it.
    f.sent.length = 0;
    f.click('Barracks #2  [S-b] change');
    expect(f.draw().join('\n')).toContain('Barracks #2 (assigned)');
    f.click('Barracks #1');
    expect(f.sent).toEqual([
      { type: 'SetZoneSetting', zoneId: b, key: 'squad', value: 0 },
      { type: 'SetZoneSetting', zoneId: a, key: 'squad', value: id },
    ]);
    f.w.step(1);
    expect(buildings.zone(a)?.settings['squad']).toBe(id);
    expect(buildings.zone(b)?.settings['squad']).toBe(0);
    f.screen.key(press('B', { shift: true }));
    f.screen.key(press('Enter'));
    f.w.step(1);
    expect(buildings.zone(a)?.settings['squad']).toBe(0);
    expect(f.w.events('CommandRejected')).toHaveLength(0);
  });

  it('[S-n] renames the squad through the text input', () => {
    const f = setup('u06-mil-rename', 1);
    const id = squad(f);
    f.screen.openPanel('military');
    f.draw();
    f.screen.key(press('N', { shift: true }));
    expect(f.prompts[0]).toMatchObject({ title: 'Rename The Hearthguard', value: 'The Hearthguard', maxLength: 32 });
    f.prompts[0]?.answer('The Night Watch');
    expect(f.sent).toEqual([{ type: 'RenameSquad', squadId: id, name: 'The Night Watch' }]);
    f.w.step(1);
    expect(combat(f.w).squad(id)?.name).toBe('The Night Watch');
    f.click('[S-n] rename');
    expect(f.prompts[1]?.value).toBe('The Night Watch');
  });
});

describe('U-06 help and the app', () => {
  it('help lists the new keys; a keymap saved by index still finds the older bindings', () => {
    const rows = helpKeyRows(keymap).map((r) => r.text);
    for (const text of [
      'Space  mark the dwarf',
      '+ -  labor priority up / down',
      '1–9  set the labor priority',
      't  profession templates',
      '[S-t]  give or take away a title',
      '[S-n]  rename the dwarf',
      '[S-m]  add the marked dwarves to a squad',
      '[ ]  sleep an hour earlier / later',
      '[S-l]  choose the squad leader',
      '[S-b]  assign a barracks zone',
      '[S-n]  rename the squad',
    ]) expect(rows).toContain(text);
    // T-424: a rebinding is saved by the binding's name; one saved by index before that is read
    // through the order of that version, where these contexts followed the panel hotkeys.
    const firstNew = LEGACY_BINDINGS.findIndex((name) => /^(labor_manager|units_panel|military_panel)\//.test(name));
    expect(firstNew).toBeGreaterThan(LEGACY_BINDINGS.map((name) => name.split('/')[0]).lastIndexOf('fortress_panel'));
    for (const name of LEGACY_BINDINGS) expect(keymap.bindings.some((b) => `${b.context}/${b.spec.key === 'any-letter' ? 'any-letter' : keyLabel(b.spec)}` === name), name).toBe(true);
  });

  it('in the app: [l], Enter opens the labor manager and Esc returns; [u], Shift+N renames a dwarf', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 'u06-app', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const key = (k: string, shift = false): boolean => game.handleKey(press(k, { shift }));
    key('l');
    key('Enter');
    expect(game.screen).toBe('labor_manager');
    expect(game.textRows().join('\n')).toContain('Labor manager');
    key('t');
    key('2');
    game.host.step(1);
    const first = game.host.readers.of<DwarvesReader>('10').list()[0] as EntityId;
    const jobs = game.host.readers.of<{ laborEnabled(d: number, l: string): boolean }>('11');
    expect(registry.table('labors').ids().filter((l) => jobs.laborEnabled(first, l))).toEqual(['hauling']);
    key('Esc');
    expect(game.screen).toBe('fortress');
    key('u');
    key('N', true);
    expect(game.screen).toBe('text_input');
    for (let k = 0; k < 30; k += 1) key('Backspace');
    for (const ch of 'Kili Deepdelver') key(ch);
    key('Enter');
    expect(game.screen).toBe('fortress');
    game.host.step(1);
    expect(game.host.readers.entities.get(first, C.Creature)?.name).toBe('Kili Deepdelver');
  });
});
