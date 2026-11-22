/**
 * T-679: the log can be browsed, and an entry with a place goes there. `Enter` (or a click on the
 * chosen entry) centres the map on the entry's tile and level, marks it and opens the tile list there,
 * whoever has moved on from it; `[v]` opens the view of the creature or item the entry names while it
 * still exists. Lines keep a place and what they name where the event tells them, saved with the log.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { GameEvent } from '@core/events';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog, focusOf, subjectOf } from '@ui/announcements';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const centred: { x: number; y: number; z: number }[] = [];
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { w.submit(cmd); },
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: (x, y, level) => { centred.push({ x, y, z: level }); },
    home: () => {},
    zoom: () => {},
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (_id, _params, reply) => reply(true),
  };
  return { w, screen: new FortressScreen(host, keymap, strings), centred };
}

const event = (fields: Record<string, unknown>): GameEvent => fields as unknown as GameEvent;

function draw(screen: FortressScreen): string[] {
  const s = surface(80, 42);
  screen.draw(s);
  return s.lines();
}

describe('T-679 the log goes to an entry’s place', () => {
  it('Enter goes to the event’s tile after its creature has moved on, and [v] opens the creature where it is now', () => {
    const { w, screen, centred } = setup('t679-goto');
    const at = w.index(10, 10, z);
    const dwarf = w.spawnDwarf({ at, name: 'Ketil Ironvein' });
    screen.onEvents([event({ type: 'CreatureUnconscious', id: dwarf })]);
    const line = screen.log.lines[screen.log.lines.length - 1];
    expect(line?.focus).toBe(at);
    expect(line?.subject).toBe(dwarf);
    // The dwarf walks off; the entry keeps its tile.
    w.movement.teleport(dwarf, w.index(20, 12, z));
    screen.key(press('a'));
    expect(screen.ui.panel).toBe('log');
    screen.key(press('ArrowDown'));
    draw(screen);
    expect(screen.logView.line).toBe(line);
    // The action row offers both.
    const footer = draw(screen).find((l) => l.includes('[Enter] go  [v]'));
    expect(footer).toContain(`[v] ${screen.logSubject(line!)?.name ?? '?'}`);
    centred.length = 0;
    expect(screen.key(press('Enter'))).toBe(true);
    expect(centred).toEqual([{ x: 10, y: 10, z }]);
    expect(screen.ui.mark).toEqual({ x: 10, y: 10, z });
    expect(screen.ui.panel).toBe('look');
    expect(screen.lookAt.kind).toBe('tile');
    expect(screen.ui.cursor).toEqual({ x: 10, y: 10 });
    // Back to the log (Backspace, or its letter), which keeps its choice; [v] opens the dwarf's view where the dwarf is now.
    screen.key(press('Backspace'));
    expect(screen.ui.panel).toBe('log');
    expect(screen.logView.chosen).toBe(true);
    expect(screen.logView.line).toBe(line);
    centred.length = 0;
    expect(screen.key(press('v'))).toBe(true);
    expect(screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    expect(centred).toEqual([{ x: 20, y: 12, z }]);
    screen.key(press('a'));
    expect(screen.ui.panel).toBe('log');
    expect(screen.logView.line).toBe(line);
  });

  it('the log keeps its filter for the way back from a go-to, and drops it when another panel opens', () => {
    const { w, screen } = setup('t679-filter');
    const tick = w.readers.calendar.tick;
    screen.log.append('note', 'A wolf at the gate.', tick, w.index(5, 5, z));
    screen.log.append('note', 'Something else.', tick, w.index(6, 6, z));
    screen.key(press('a'));
    screen.key(press('/'));
    for (const ch of 'wolf') screen.key(press(ch));
    screen.key(press('Esc'));
    draw(screen);
    screen.key(press('Enter'));
    expect(screen.ui.panel).toBe('look');
    screen.key(press('Backspace'));
    expect(screen.ui.panel).toBe('log');
    expect(screen.logView.filter.value).toBe('wolf');
    screen.key(press('Enter'));
    screen.key(press('u'));
    expect(screen.ui.panel).toBe('units');
    expect(screen.logView.filter.value).toBe('');
  });

  it('a first click on an entry centres and marks; a click on the chosen entry opens its tile list', () => {
    const { w, screen, centred } = setup('t679-click');
    const tile = w.index(14, 9, z);
    screen.log.append('alert', 'Short line.', w.readers.calendar.tick, tile);
    screen.key(press('a'));
    const lines = draw(screen);
    const row = lines.findIndex((l) => l.includes('Short line.'));
    const col = (lines[row] as string).indexOf('Short line.');
    const click = (): void => {
      screen.pointerDown({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
      screen.pointerUp({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    };
    click();
    expect(centred).toEqual([{ x: 14, y: 9, z }]);
    expect(screen.ui.mark).toEqual({ x: 14, y: 9, z });
    expect(screen.ui.panel).toBe('log');
    draw(screen);
    click();
    expect(screen.ui.panel).toBe('look');
    expect(screen.ui.cursor).toEqual({ x: 14, y: 9 });
  });

  it('an entry with no place, or whose creature is gone, says so on the status row', () => {
    const { w, screen } = setup('t679-gone');
    const dwarf = w.spawnDwarf({ at: w.index(12, 12, z) });
    screen.onEvents([event({ type: 'CreatureUnconscious', id: dwarf })]);
    w.game.world.entities.destroy(dwarf);
    screen.key(press('a'));
    screen.key(press('ArrowDown'));
    expect(draw(screen).join('\n')).toContain('[Enter] go there');
    screen.key(press('v'));
    expect(screen.ui.panel).toBe('log');
    expect(screen.statusRow2()).toContain(strings.get('ui.log.gone'));
    screen.log.append('note', 'Nowhere at all.', w.readers.calendar.tick);
    screen.logView.reset();
    expect(draw(screen).join('\n')).toContain(strings.get('ui.log.nowhere'));
    screen.key(press('Enter'));
    expect(screen.ui.panel).toBe('log');
    expect(screen.statusRow2()).toContain(strings.get('ui.log.no_place'));
  });
});

describe('T-679 lines keep a place and what they name', () => {
  it('an item’s line has the item’s tile and the item; a building’s line its first tile', () => {
    const w = new TestWorld({ seed: 't679-places', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tile = w.index(8, 8, z);
    const dwarf = w.spawnDwarf({ at: w.index(30, 8, z) });
    const sword = w.spawnItem('log', 'oak', tile);
    const masterwork = event({ type: 'MasterworkCreated', itemId: sword, crafterId: dwarf });
    expect(focusOf(masterwork, w.readers)).toBe(tile);
    expect(subjectOf(masterwork, w.readers)).toBe(sword);
    const table = w.build('table', w.index(15, 15, z), 'oak');
    expect(focusOf(event({ type: 'TrapTriggered', trapId: table }), w.readers)).toBe(w.index(15, 15, z));
    // A line naming a creature that is gone and one that is here names the one here.
    expect(subjectOf(event({ type: 'KillRecorded', victimId: 123456, killerId: dwarf }), w.readers)).toBe(dwarf);
  });

  it('a theft after the thief left the map goes to where its party was last told of', () => {
    const w = new TestWorld({ seed: 't679-theft', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const log = new AnnouncementLog(strings, registry);
    log.register([
      { type: 'ThreatWarning', spec: { severity: 'alert', stringKey: 'ui.log.empty' } },
      { type: 'ThiefEscaped', spec: { severity: 'alert', stringKey: 'ui.log.empty' } },
    ] as never);
    const seen = w.index(3, 4, z);
    log.announce(event({ type: 'ThreatWarning', partyId: 77, tile: seen }), w.readers, 10);
    const theft = log.announce(event({ type: 'ThiefEscaped', id: 999999, partyId: 77 }), w.readers, 20);
    expect(theft?.line.focus).toBe(seen);
    expect(theft?.focus).toBe(seen);
  });

  it('saves and loads what a line names with its place', () => {
    const ui = defaultUiState(z);
    const saved = toSaved(ui, [{ tick: 5, severity: 'alert', text: 'Named.', count: 1, focus: 40, subject: 4242 }]);
    const lines = fromSaved(defaultUiState(z), JSON.parse(JSON.stringify(saved)));
    expect(lines[0]).toMatchObject({ focus: 40, subject: 4242 });
  });
});
