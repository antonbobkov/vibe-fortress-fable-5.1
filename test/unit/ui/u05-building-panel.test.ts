/**
 * U-05: the building panel (`reports/audits/ui-audit.md` M4, § 5.4 "Missing UI for implemented commands";
 * `02-systems/14-buildings-and-rooms.md` § Player-facing behavior: "Clicking a building opens its
 * panel: state, mode toggles, links, owner, deconstruct"). Each kind of building shows its actions
 * and each action sends its command; the lever's link target is picked on the map; every failure
 * says why; and the two hints the audit called impossible to follow name steps and keys.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import { rejectionText } from '@ui/messages';
import { drawBuildingPanel } from '@ui/panels/building';
import { drawDesignatePanel } from '@ui/panels/designate';
import { helpKeyRows } from '@ui/panels/help';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { CellPointer } from '@ui/screen';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

interface Asked { id: string; params: Record<string, unknown> }

interface Fixture {
  readonly w: TestWorld;
  readonly screen: FortressScreen;
  readonly sent: Command[];
  readonly asked: Asked[];
  /** What the confirmation dialog answers. */
  answer: boolean;
  /** Let the status message run out. */
  later(): void;
}

/** A fortress screen over a flat world. Commands are recorded and reach the world on its next step. */
function setup(seed: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const sent: Command[] = [];
  const asked: Asked[] = [];
  const state = { answer: true, now: 1000 };
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => state.now,
    confirm: (id, params, reply) => { asked.push({ id, params: params as Record<string, unknown> }); reply(state.answer); },
  };
  const screen = new FortressScreen(host, keymap, strings);
  return { w, screen, sent, asked, get answer() { return state.answer; }, set answer(value: boolean) { state.answer = value; }, later: () => { state.now += 60_000; } };
}

/** The map cell of a tile. */
function at(f: Fixture, x: number, y: number, button = 0): CellPointer {
  return { col: LAYOUT.map.col + x - f.screen.ui.camX, row: LAYOUT.map.row + y - f.screen.ui.camY, button, shift: false, ctrl: false, alt: false, meta: false };
}

function click(f: Fixture, x: number, y: number, button = 0): void {
  f.screen.pointerDown(at(f, x, y, button));
  f.screen.pointerUp(at(f, x, y, button));
}

function wall(f: Fixture, x: number, y: number): void {
  f.w.game.world.services.terrain.setKind(f.w.index(x, y, z), TileKind.Wall, 1);
}

/** A door in a doorway at (x, y). */
function door(f: Fixture, x: number, y: number): number {
  wall(f, x, y - 1);
  wall(f, x, y + 1);
  return f.w.build('door', f.w.index(x, y, z), 'oak');
}

/** The panel as drawn: its text, and a click on the line holding `needle`. */
function panel(f: Fixture): { text: string; lines: string[]; click(needle: string): void } {
  const s = surface(40, 40);
  drawBuildingPanel(s, { col: 0, row: 0, cols: 40, rows: 40 }, f.screen.building, f.screen.ctx, (id) => f.screen.deconstruct(id));
  return {
    text: s.lines().join('\n'),
    lines: s.lines(),
    click: (needle) => {
      const row = s.lines().findIndex((line) => line.includes(needle));
      expect(row, needle).toBeGreaterThanOrEqual(0);
      const hit = s.hitAt((s.lines()[row] as string).indexOf(needle) + 1, row);
      expect(hit, needle).not.toBeNull();
      hit?.action();
    },
  };
}

/** Open the panel on a building the way the player does: a click on it. */
function open(f: Fixture, id: number): void {
  const origin = f.w.readers.of<BuildingsReader>('14').get(id)?.origin ?? -1;
  const map = f.w.readers.map;
  click(f, origin % map.w, Math.floor(origin / map.w) % map.h);
  expect(f.screen.ui.panel).toBe('building');
  expect(f.screen.building.id).toBe(id);
  f.sent.length = 0;
}

/** Move the panel's cursor to the line with this id and press Enter. */
function enterOn(f: Fixture, id: string): void {
  const rows = f.screen.building.lines(f.screen.ctx, (b) => f.screen.deconstruct(b)).filter((line) => line.run !== undefined);
  const index = rows.findIndex((line) => line.id === id);
  expect(index, id).toBeGreaterThanOrEqual(0);
  const cursor = f.screen.building.mode === 'main' ? f.screen.building.list : f.screen.building.pick;
  for (let k = 0; k < rows.length; k += 1) f.screen.key(press('ArrowUp'));
  for (let k = 0; k < index; k += 1) f.screen.key(press('ArrowDown'));
  expect(cursor.selected).toBe(index);
  f.screen.key(press('Enter'));
}

function notice(f: Fixture): string {
  return f.screen.currentNotice ?? '';
}

describe('U-05 the building panel (M4)', () => {
  it('U-05 a click on a building opens its panel; workshops and the depot keep theirs; right click still looks', () => {
    const f = setup('u05-open');
    const table = f.w.build('table', f.w.index(30, 30, z), 'oak');
    const shop = f.w.build('carpenter', f.w.index(40, 30, z));
    f.w.step(1);
    click(f, 30, 30);
    expect(f.screen.ui.panel).toBe('building');
    expect(f.screen.building.id).toBe(table);
    expect(panel(f).text).toContain('Table #1');
    expect(panel(f).text).toContain('Oak · built');
    click(f, 40, 30);
    expect(f.screen.ui.panel).toBe('workshop');
    expect(f.screen.workshopId).toBe(shop);
    click(f, 30, 30, 2);
    expect(f.screen.ui.panel).toBe('look');
    // The keyboard's way: Look on the tile, then Enter.
    f.screen.key(press('Enter'));
    expect(f.screen.ui.panel).toBe('building');
    expect(f.screen.building.id).toBe(table);
    // And back: the panel's "Look at the tile" line.
    enterOn(f, 'look');
    expect(f.screen.ui.panel).toBe('look');
    // Bare ground still opens Look.
    click(f, 20, 20);
    expect(f.screen.ui.panel).toBe('look');
    expect(f.sent).toEqual([]);
  });

  it('U-05 a door lists its modes with the current one marked, and each sends SetDoorMode', () => {
    const f = setup('u05-door');
    const id = door(f, 30, 30);
    f.w.step(1);
    open(f, id);
    const drawn = panel(f);
    expect(drawn.text).toContain('Door #1');
    for (const mode of ['• Open', '○ Locked', '○ No pets', '○ Lock on alert']) expect(drawn.text).toContain(mode);
    // By keyboard.
    enterOn(f, 'mode:lock_on_alert');
    expect(f.sent).toEqual([{ type: 'SetDoorMode', buildingId: id, mode: 'lock_on_alert' }]);
    expect(notice(f)).toBe('Door #1: Lock on alert.');
    f.w.step(1);
    expect(f.w.readers.of<BuildingsReader>('14').get(id)?.mode).toBe('lock_on_alert');
    expect(panel(f).text).toContain('• Lock on alert');
    expect(panel(f).text.replace(/\s+/g, ' ')).toContain('Open now: it locks when the alert is Hearth.');
    // By mouse.
    f.sent.length = 0;
    panel(f).click('Locked');
    expect(f.sent).toEqual([{ type: 'SetDoorMode', buildingId: id, mode: 'locked' }]);
    f.w.step(1);
    // The mode it has already: a message, no command.
    f.sent.length = 0;
    enterOn(f, 'mode:locked');
    expect(f.sent).toEqual([]);
    expect(notice(f)).toBe('Door #1 is set to Locked already.');
  });

  it('U-05 a hatch has its two modes (SetHatchMode); a trap its two (SetTrapMode)', () => {
    const f = setup('u05-hatch-trap');
    f.w.carve(f.w.index(30, 30, z), TileKind.StairsDown);
    const hatch = f.w.build('hatch', f.w.index(30, 30, z), 'oak');
    f.w.spawnItem('mechanism', 'granite', f.w.index(36, 36, z), 2);
    f.w.spawnItem('raw_stone', 'granite', f.w.index(36, 37, z), 2);
    const trap = f.w.build('stone_fall_trap', f.w.index(34, 30, z));
    f.w.step(2);
    open(f, hatch);
    expect(f.screen.building.lines(f.screen.ctx).filter((l) => l.id.startsWith('mode:')).map((l) => l.id)).toEqual(['mode:open', 'mode:locked']);
    enterOn(f, 'mode:locked');
    expect(f.sent).toEqual([{ type: 'SetHatchMode', buildingId: hatch, mode: 'locked' }]);
    open(f, trap);
    const drawn = panel(f);
    expect(drawn.text).toContain('Stone-fall trap #1');
    expect(drawn.text).toContain('Trap: armed');
    expect(drawn.text).toContain('• Enemies only');
    expect(drawn.text).toContain('○ Everyone');
    enterOn(f, 'mode:all');
    expect(f.sent).toEqual([{ type: 'SetTrapMode', trapId: trap, mode: 'all' }]);
    f.w.step(1);
    expect(panel(f).text).toContain('• Everyone');
  });

  it('U-05 the lever link flow picks the target on the map, with a message for every wrong pick', () => {
    const f = setup('u05-link');
    const lever = f.w.build('lever', f.w.index(30, 30, z));
    const table = f.w.build('table', f.w.index(32, 30, z), 'oak');
    f.w.step(1);
    open(f, lever);
    expect(panel(f).text).toContain('Lever #1');
    expect(panel(f).text).toContain('Lever: off');
    expect(panel(f).text).toContain('[i] link to');
    // Nothing to link to yet.
    f.screen.key(press('i'));
    expect(f.screen.building.linking).toBe(false);
    expect(notice(f)).toBe('Nothing to link to yet: build a door, hatch, floodgate, drawbridge, spike trap or cage first.');
    const bridge = f.w.build('drawbridge', f.w.index(34, 30, z));
    const gate = door(f, 36, 30);
    f.w.step(1);
    f.screen.key(press('i'));
    expect(f.screen.building.linking).toBe(true);
    f.later();
    expect(f.screen.statusRow2()).toBe('Link Lever #1: click a door, hatch, floodgate, drawbridge, spike trap or cage · [Esc] cancel');
    expect(panel(f).text).toContain('Link Lever #1 to:');
    expect(panel(f).text).toContain('Drawbridge #1: lowered');
    expect(panel(f).text).toContain('Door #1: open');
    // Bare ground, a table and the lever itself: each says why, and the flow goes on.
    click(f, 20, 20);
    expect(notice(f)).toBe('Nothing to link there: click a door, hatch, floodgate, drawbridge, spike trap or cage.');
    click(f, 32, 30);
    expect(notice(f)).toBe('Table #1 cannot be linked: only a door, hatch, floodgate, drawbridge, spike trap or cage.');
    click(f, 30, 30);
    expect(notice(f)).toBe('Lever #1 cannot be linked to itself.');
    expect(f.screen.building.linking).toBe(true);
    expect(f.screen.ui.panel).toBe('building');
    expect(f.sent).toEqual([]);
    expect(table).toBeGreaterThan(0);
    // The bridge, on the map.
    click(f, 34, 30);
    expect(f.sent).toEqual([{ type: 'LinkMechanism', sourceId: lever, targetId: bridge }]);
    expect(f.screen.building.linking).toBe(false);
    // No mechanism in stock: the message says where one comes from.
    expect(notice(f)).toBe('Lever #1 → Drawbridge #1 waits for a mechanism — order at a mechanic\'s workshop.');
    f.w.step(1);
    expect(panel(f).text).toContain('Drawbridge #1: no worker');
    // The door, from the list by keyboard; Esc leaves the chooser first.
    f.sent.length = 0;
    f.w.spawnItem('mechanism', 'granite', f.w.index(36, 36, z), 2);
    f.w.step(1);
    f.screen.key(press('i'));
    f.screen.key(press('Esc'));
    expect(f.screen.building.linking).toBe(false);
    expect(f.screen.ui.panel).toBe('building');
    f.screen.key(press('i'));
    enterOn(f, `candidate:${gate}`);
    expect(f.sent).toEqual([{ type: 'LinkMechanism', sourceId: lever, targetId: gate }]);
    expect(notice(f)).toBe('A mechanic will link Lever #1 to Door #1 (1 mechanism).');
    // Right click cancels the pick, not the panel.
    f.screen.key(press('i'));
    click(f, 20, 20, 2);
    expect(f.screen.building.linking).toBe(false);
    expect(f.screen.ui.panel).toBe('building');
  });

  it('U-05 a linked lever lists its targets, pulls ([y]) and unlinks ([r])', () => {
    const f = setup('u05-lever');
    const lever = f.w.build('lever', f.w.index(30, 30, z));
    const bridge = f.w.build('drawbridge', f.w.index(34, 30, z));
    f.w.spawnItem('mechanism', 'granite', f.w.index(31, 31, z), 2);
    f.w.spawnDwarf({ at: f.w.index(32, 32, z), skills: { mechanics: 5 } });
    f.w.step(1);
    open(f, lever);
    // Unlinked: pulling says so, and there is nothing to unlink.
    f.screen.key(press('y'));
    expect(f.sent).toEqual([{ type: 'PullLever', leverId: lever }]);
    expect(notice(f)).toBe('A dwarf will pull Lever #1, but it is linked to nothing yet.');
    expect(f.screen.building.lines(f.screen.ctx).some((l) => l.id === 'unlink')).toBe(false);
    f.screen.building.linkTo(f.screen.ctx, bridge);
    const linked = (): boolean => f.w.readers.of<BuildingsReader>('14').get(lever)?.linkedIds.includes(bridge) === true;
    f.w.until(() => linked(), 6000);
    expect(linked()).toBe(true);
    f.sent.length = 0;
    const drawn = panel(f);
    expect(drawn.text).toContain('Linked to (1)');
    expect(drawn.text).toMatch(/→ Drawbridge #1: (lowered|raised)/);
    // The bridge's own panel names the lever.
    open(f, bridge);
    expect(panel(f).text).toContain('← Lever #1');
    open(f, lever);
    panel(f).click('pull');
    expect(f.sent).toEqual([{ type: 'PullLever', leverId: lever }]);
    expect(notice(f)).toBe('A dwarf will pull Lever #1.');
    f.sent.length = 0;
    // Linked already: a message.
    f.screen.building.linkTo(f.screen.ctx, bridge);
    expect(notice(f)).toBe('Lever #1 is linked to Drawbridge #1 already.');
    expect(f.sent).toEqual([]);
    f.screen.key(press('r'));
    expect(f.sent).toEqual([{ type: 'UnlinkMechanism', sourceId: lever, targetId: bridge }]);
    expect(notice(f)).toBe('Lever #1 is no longer linked to Drawbridge #1.');
    f.w.step(1);
    expect(linked()).toBe(false);
  });

  it('U-05 a pressure plate chooses what presses it and how big or deep (SetPlateTrigger)', () => {
    const f = setup('u05-plate');
    const plate = f.w.build('pressure_plate', f.w.index(30, 30, z));
    f.w.step(1);
    open(f, plate);
    const drawn = panel(f);
    expect(drawn.text).toContain('Pressure plate #1');
    expect(drawn.text).toContain('• Enemies and wild creatures');
    expect(drawn.text).toContain('smallest size 0');
    expect(drawn.text).toContain('[i] link to');
    enterOn(f, 'trigger:anyone');
    expect(f.sent).toEqual([{ type: 'SetPlateTrigger', plateId: plate, trigger: { kind: 'creatures', minSize: 0, includeFortress: true } }]);
    f.w.step(1);
    f.sent.length = 0;
    f.screen.key(press('ArrowRight'));
    expect(f.sent).toEqual([{ type: 'SetPlateTrigger', plateId: plate, trigger: { kind: 'creatures', minSize: 10, includeFortress: true } }]);
    f.w.step(1);
    expect(panel(f).text).toContain('smallest size 10');
    f.sent.length = 0;
    enterOn(f, 'trigger:water');
    expect(f.sent).toEqual([{ type: 'SetPlateTrigger', plateId: plate, trigger: { kind: 'water', level: 1 } }]);
    f.w.step(1);
    expect(panel(f).text).toContain('• Water');
    expect(panel(f).text).toContain('depth 1 of 7 or more');
    // At the limit: a message, no command.
    f.sent.length = 0;
    f.screen.key(press('ArrowLeft'));
    expect(f.sent).toEqual([]);
    expect(notice(f)).toBe('That is as far as it goes.');
    enterOn(f, 'trigger:water');
    expect(f.sent).toEqual([]);
    expect(notice(f)).toBe('The plate is set to that already.');
    // The world took every trigger it was sent.
    expect(f.w.events('CommandRejected')).toEqual([]);
  });

  it('U-05 a cage releases after a confirmation (default No) and tames; an empty one says so', () => {
    const f = setup('u05-cage');
    const cage = f.w.build('cage_building', f.w.index(30, 30, z), 'oak');
    f.w.step(1);
    open(f, cage);
    expect(panel(f).text).toContain('Cage #1');
    expect(panel(f).text).toContain('Empty');
    f.screen.key(press('r'));
    expect(notice(f)).toBe('Cage #1 is empty.');
    f.screen.key(press('g'));
    expect(notice(f)).toBe('Cage #1 is empty.');
    expect(f.sent).toEqual([]);
    expect(f.asked).toEqual([]);
    // Something caught.
    const wolf = f.w.spawnCreature('wolf', f.w.index(30, 30, z), 'wild');
    const entities = f.w.game.world.entities;
    const building = entities.get(cage, C.Building);
    if (building === undefined) throw new Error('no cage');
    entities.add(cage, C.Building, { ...building, settings: { ...building.settings, occupantId: wolf } });
    expect(panel(f).text).toContain('Holds a wolf');
    f.answer = false;
    f.screen.key(press('r'));
    expect(f.asked).toEqual([{ id: 'c_release_cage', params: { creature: 'a wolf', cage: 'Cage #1' } }]);
    expect(f.sent).toEqual([]);
    f.answer = true;
    panel(f).click('release');
    expect(f.sent).toEqual([{ type: 'ReleaseCage', cageBuildingId: cage }]);
    f.sent.length = 0;
    f.screen.key(press('g'));
    expect(f.sent).toEqual([{ type: 'TameCaged', cageId: cage }]);
    expect(notice(f)).toBe('A trainer will tame a wolf.');
  });

  it('U-05 a bed gives its bedroom an owner from the list of dwarves, or nobody (AssignRoom)', () => {
    const f = setup('u05-bed');
    const bed = f.w.build('bed', f.w.index(30, 30, z), 'oak');
    const urist = f.w.spawnDwarf({ at: f.w.index(20, 20, z), name: 'Urist' });
    const kadol = f.w.spawnDwarf({ at: f.w.index(21, 20, z), name: 'Kadol' });
    f.w.step(1);
    open(f, bed);
    expect(panel(f).text).toContain('Bed #1');
    expect(panel(f).text).toContain('Owner: none (not in a bedroom)');
    f.screen.key(press('w'));
    expect(f.screen.building.choosing).toBe(false);
    expect(notice(f)).toBe('Bed #1 is in no bedroom: draw a Bedroom zone over it ([z] Zones) to give it an owner.');
    const room = f.w.zone('bedroom', [f.w.index(30, 30, z), f.w.index(31, 30, z)]);
    f.w.step(1);
    expect(panel(f).text).toContain('Owner: nobody (Bedroom #1)');
    f.screen.key(press('w'));
    expect(f.screen.building.choosing).toBe(true);
    const chooser = panel(f);
    expect(chooser.text).toContain('Owner of Bed #1:');
    expect(chooser.text).toContain('• Nobody');
    expect(chooser.text).toContain('○ Urist');
    expect(chooser.text).toContain('○ Kadol');
    enterOn(f, `owner:${kadol}`);
    expect(f.sent).toEqual([{ type: 'AssignRoom', zoneId: room, dwarfId: kadol }]);
    expect(notice(f)).toBe('Bed #1 now belongs to Kadol.');
    expect(f.screen.building.choosing).toBe(false);
    // Nobody, by mouse.
    f.sent.length = 0;
    panel(f).click('owner');
    panel(f).click('Nobody');
    expect(f.sent).toEqual([{ type: 'AssignRoom', zoneId: room, dwarfId: 0 }]);
    expect(notice(f)).toBe('Bed #1 belongs to nobody now.');
    expect(urist).toBeGreaterThan(0);
  });

  it('U-05 a coffin is kept for a dwarf or for anyone (AssignCoffin)', () => {
    const f = setup('u05-coffin');
    const coffin = f.w.build('coffin', f.w.index(30, 30, z), 'granite');
    const urist = f.w.spawnDwarf({ at: f.w.index(20, 20, z), name: 'Urist' });
    f.w.step(1);
    open(f, coffin);
    expect(panel(f).text).toContain('Coffin #1');
    expect(panel(f).text).toContain('Kept for anyone');
    f.screen.key(press('w'));
    enterOn(f, `owner:${urist}`);
    expect(f.sent).toEqual([{ type: 'AssignCoffin', coffinId: coffin, dwarfId: urist }]);
    f.w.step(1);
    expect(f.w.events('CommandRejected')).toEqual([]);
    expect(panel(f).text).toContain('Kept for Urist');
    f.sent.length = 0;
    f.screen.key(press('w'));
    enterOn(f, 'owner:0');
    expect(f.sent).toEqual([{ type: 'AssignCoffin', coffinId: coffin, dwarfId: 0 }]);
    // A coffin with a body in it takes no owner.
    const entities = f.w.game.world.entities;
    const building = entities.get(coffin, C.Building);
    if (building === undefined) throw new Error('no coffin');
    entities.add(coffin, C.Building, { ...building, settings: { ...building.settings, occupantId: urist } });
    f.sent.length = 0;
    expect(panel(f).text).toContain('Holds a body');
    f.screen.key(press('w'));
    expect(f.sent).toEqual([]);
    expect(notice(f)).toBe('Coffin #1 already holds a body.');
  });

  it('U-05 a planned building shows what it waits for, takes a priority (1-9) and can be cancelled', () => {
    const f = setup('u05-planned');
    f.w.spawnDwarf({ at: f.w.index(20, 20, z), skills: { carpentry: 3 } });
    f.w.submit({ type: 'PlaceBuilding', buildingType: 'bed', origin: f.w.index(30, 30, z), orientation: 0, materialChoice: 0 });
    f.w.step(60);
    const id = f.w.readers.of<BuildingsReader>('14').byType('bed')[0] ?? 0;
    expect(id).not.toBe(0);
    open(f, id);
    const drawn = panel(f);
    expect(drawn.text).toContain('Bed #1');
    expect(drawn.text).toContain('planned');
    // U-01's block text: the missing input and where to get it.
    expect(drawn.text.replace(/\s+/g, ' ')).toContain('Waiting: 1 bed - order at a carpenter\'s workshop');
    expect(drawn.text).toContain('Priority 5 · set 1 2 3 4 5 6 7 8 9');
    f.screen.key(press('2'));
    expect(f.sent).toEqual([{ type: 'SetBuildingPriority', buildingId: id, priority: 2 }]);
    expect(notice(f)).toBe('Bed #1: build priority 2.');
    f.w.step(1);
    expect(panel(f).text).toContain('Priority 2 · set');
    // A click on a digit.
    f.sent.length = 0;
    panel(f).click('7 8 9');
    expect(f.sent).toEqual([{ type: 'SetBuildingPriority', buildingId: id, priority: 7 }]);
    // No modes, no owner yet: only the plan's actions.
    expect(f.screen.building.lines(f.screen.ctx).map((l) => l.id)).toEqual(['title', 'state', 'waiting', 'priority', 'cancel']);
    f.sent.length = 0;
    f.screen.key(press('x'));
    expect(f.sent).toEqual([{ type: 'CancelBuilding', buildingId: id }]);
    f.w.step(1);
    expect(panel(f).text).toContain('That building is gone.');
  });

  it('U-05 take apart asks first (default No); a built building refuses a priority with a reason', () => {
    const f = setup('u05-take-apart');
    const table = f.w.build('table', f.w.index(30, 30, z), 'oak');
    f.w.step(1);
    open(f, table);
    expect(panel(f).text).toContain('[x] take apart');
    f.answer = false;
    f.screen.key(press('x'));
    expect(f.asked).toEqual([{ id: 'c_deconstruct_building', params: { building: 'Table #1' } }]);
    expect(f.sent).toEqual([]);
    f.answer = true;
    panel(f).click('take apart');
    expect(f.sent).toEqual([{ type: 'DeconstructBuilding', buildingId: table }]);
    f.sent.length = 0;
    expect(f.screen.building.setPriority(f.screen.ctx, 3)).toBeNull();
    expect(notice(f)).toBe('Only a planned building takes a priority.');
    // A digit is not the panel's key on a built building.
    expect(f.screen.building.key(f.screen.ctx, press('3'))).toBe(false);
    expect(f.sent).toEqual([]);
  });

  it('U-05 every refusal of the panel\'s commands has its own line', () => {
    const f = setup('u05-rejections');
    const ctx = f.screen.ctx;
    const cases: readonly [Command, string, string][] = [
      [{ type: 'LinkMechanism', sourceId: 1, targetId: 2 }, 'not_linkable', 'only a finished lever or plate links, and only to a door, hatch, floodgate, drawbridge, spike trap or cage'],
      [{ type: 'LinkMechanism', sourceId: 1, targetId: 2 }, 'assigned', 'that link exists or is being made already'],
      [{ type: 'UnlinkMechanism', sourceId: 1, targetId: 2 }, 'not_linkable', 'those two are not linked'],
      [{ type: 'SetDoorMode', buildingId: 1, mode: 'x' }, 'bad_setting', 'a door has no such mode'],
      [{ type: 'SetDoorMode', buildingId: 1, mode: 'open' }, 'no_tag', 'that is not a door'],
      [{ type: 'SetHatchMode', buildingId: 1, mode: 'x' }, 'bad_setting', 'a hatch is open or locked'],
      [{ type: 'SetTrapMode', trapId: 1, mode: 'x' }, 'bad_setting', 'a trap springs on enemies or on everyone'],
      [{ type: 'SetPlateTrigger', plateId: 1, trigger: {} }, 'bad_setting', 'a plate has no such trigger'],
      [{ type: 'PullLever', leverId: 1 }, 'no_tag', 'that is not a finished lever'],
      [{ type: 'ReleaseCage', cageBuildingId: 1 }, 'precondition_failed', 'the cage is empty or has no free floor beside it'],
      [{ type: 'TameCaged', cageId: 1 }, 'precondition_failed', 'that creature cannot be tamed'],
      [{ type: 'TameCaged', cageId: 1 }, 'no_kennel', 'there is no kennel'],
      [{ type: 'AssignRoom', zoneId: 1, dwarfId: 2 }, 'no_bed', 'that bedroom has no bed'],
      [{ type: 'AssignRoom', zoneId: 1, dwarfId: 2 }, 'precondition_failed', 'only a finished bedroom can be assigned'],
      [{ type: 'AssignCoffin', coffinId: 1, dwarfId: 2 }, 'precondition_failed', 'that coffin is not built or is taken'],
      [{ type: 'SetBuildingPriority', buildingId: 1, priority: 2 }, 'precondition_failed', 'only a planned building takes a priority'],
      [{ type: 'SetDesignationPriority', tiles: [1], priority: 2 }, 'not_found', 'some of those tiles are no longer designated'],
      [{ type: 'SetDoorMode', buildingId: 1, mode: 'open' }, 'not_found', 'that building no longer exists'],
    ];
    for (const [cmd, reason, text] of cases) expect(rejectionText(ctx, cmd, reason), `${cmd.type} ${reason}`).toBe(text);
  });

  it('U-05 the alert and gate hints name steps the player can take, with their keys', () => {
    const alert = strings.get('hint.hint_alert');
    const gate = strings.get('hint.hint_gate');
    expect(alert).toBe('Click a door and choose Lock on alert. Then [m] and [3] raise the Hearth alert: civilians go to the hearth and those doors lock, but a dwarf in dire need still goes out to eat, drink or sleep.');
    expect(gate).toBe('A drawbridge over a channel is the surest gate. Build a lever inside [b], click it, press [i] and click the bridge; [y] pulls it.');
    // The steps exist: the mode's name is the panel's, `[3]` raises the alert, `[i]` and `[y]` are the lever's keys.
    expect(alert).toContain(strings.get('ui.building.mode.lock_on_alert'));
    const f = setup('u05-hints');
    f.screen.key(press('m'));
    f.screen.key(press('3'));
    expect(f.sent).toEqual([{ type: 'SetAlert', level: 'hearth' }]);
    const lever = f.w.build('lever', f.w.index(30, 30, z));
    const bridge = f.w.build('drawbridge', f.w.index(34, 30, z));
    f.w.step(1);
    open(f, lever);
    f.screen.key(press('i'));
    click(f, 34, 30);
    f.screen.key(press('y'));
    expect(f.sent).toEqual([{ type: 'LinkMechanism', sourceId: lever, targetId: bridge }, { type: 'PullLever', leverId: lever }]);
  });

  it('U-05 Help lists the building panel\'s keys', () => {
    const rows = helpKeyRows(keymap, strings).map((row) => row.text);
    const from = rows.indexOf('Building panel (click a building)');
    expect(from).toBeGreaterThanOrEqual(0);
    expect(rows.slice(from + 1, from + 7)).toEqual([
      '↑↓ Enter  choose a mode, an owner, a link',
      'i link (pick on the map)  r unlink  y pull',
      'r release (asks first)  g tame',
      'w owner of a bed or a coffin',
      '1-9 build priority  x cancel / take apart',
      'Shift+P  last designation takes the priority',
    ]);
  });
});

describe('U-05 Designate: the last batch takes another priority (SetDesignationPriority)', () => {
  it('U-05 [S-p] sends the still-designated tiles of the last batch; with none it says so', () => {
    const f = setup('u05-designate');
    f.screen.key(press('d'));
    f.screen.key(press('P', { shift: true }));
    expect(f.sent).toEqual([]);
    expect(f.screen.currentNotice).toBe('No designation to re-prioritize: designate something first.');
    // Trees are not needed: smoothing… any designation the flat world takes. Channel two floor tiles.
    f.screen.key(press('C', { shift: true }));
    const a = { x: 30, y: 30, z };
    const b = { x: 31, y: 30, z };
    const commands = f.screen.commit(a, b);
    expect(commands.map((c) => c.type)).toEqual(['Designate']);
    f.w.step(1);
    expect(f.w.events('CommandRejected')).toEqual([]);
    f.sent.length = 0;
    f.screen.key(press('2'));
    f.screen.key(press('P', { shift: true }));
    expect(f.sent).toEqual([{ type: 'SetDesignationPriority', tiles: [f.w.index(30, 30, z), f.w.index(31, 30, z)], priority: 2 }]);
    expect(f.screen.currentNotice).toBe('2 designated tiles now have priority 2.');
    f.w.step(1);
    expect(f.w.events('CommandRejected')).toEqual([]);
    // The panel shows the action, and a click does the same.
    const s = surface(40, 20);
    let clicked = 0;
    drawDesignatePanel(s, { col: 0, row: 0, cols: 40, rows: 20 }, f.screen.tool, strings, () => { clicked += 1; });
    const row = s.lines().findIndex((line) => line.includes('[S-p] last batch to priority 2'));
    expect(row).toBeGreaterThanOrEqual(0);
    s.hitAt(3, row)?.action();
    expect(clicked).toBe(1);
  });
});
