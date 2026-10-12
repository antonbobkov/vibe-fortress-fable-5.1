/**
 * U-03: panel hotkeys always win (`docs/archive/ui-fixes/README.md` D-U2; `reports/audits/ui-audit.md`
 * issue 4, M3, S4). A panel letter opens or closes its panel whatever panel is open; a panel's own
 * accelerator on one of those letters takes `Shift` and is shown `[S-m]`; and every destructive
 * single-key action asks through the confirmation dialog, default No.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import { acceleratorLabel, acceleratorOf, DEFAULT_PANEL_LETTERS, FORTRESS_PANEL_KEYS, Keymap, type KeymapRow } from '@ui/keymap';
import { ConfirmScreen } from '@ui/screens/confirm';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { helpKeyRows } from '@ui/panels/help';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

interface Asked { id: string; params: Record<string, unknown> }

interface World {
  readonly w: TestWorld;
  readonly shop: number;
  readonly busyShop: number;
  readonly pile: number;
  readonly cow: number;
  readonly dog?: number;
  readonly squad: number;
  readonly table: number;
  /** U-05: a lever, a cage it can be linked to, and a bed in a bedroom. */
  readonly lever: number;
  readonly bed: number;
}

/** A world with one of everything a panel acts on. Its commands are never applied by a screen below. */
function world(seed: string): World {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const shop = w.build('carpenter', w.index(15, 15, z));
  const busyShop = w.build('carpenter', w.index(25, 15, z));
  const table = w.build('table', w.index(40, 20, z), 'oak');
  const lever = w.build('lever', w.index(44, 20, z));
  w.build('cage_building', w.index(46, 20, z), 'oak');
  const bed = w.build('bed', w.index(48, 20, z), 'oak');
  w.zone('bedroom', [w.index(48, 20, z), w.index(49, 20, z)]);
  w.spawnDwarf({ at: w.index(17, 19, z), skills: { carpentry: 6 } });
  const pile = w.zone('stockpile', [w.index(30, 30, z), w.index(31, 30, z)]);
  const cow = w.spawnTame('cow', w.index(34, 34, z));
  const dog = w.spawnTame('dog', w.index(35, 34, z));
  w.spawnItem('stone_block', 'iron', w.index(36, 36, z), 2);
  // A finished workshop takes orders from the tick after it is built.
  w.step(1);
  w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
  w.submit({ type: 'AddWorkOrder', workshopId: busyShop, order: { recipeId: 'make_bed', mode: 'once', remaining: 2, threshold: 0, priority: 5 } });
  w.step(1);
  const squad = w.readers.of<CombatReader>('16').squads()[0]?.id ?? 0;
  expect(squad).not.toBe(0);
  return { w, shop, busyShop, pile, cow, dog, squad, table, lever, bed };
}

interface Fixture {
  readonly screen: FortressScreen;
  readonly sent: Command[];
  readonly asked: Asked[];
  /** Each time the screen asked for the labor manager (U-06). */
  readonly managers: unknown[];
}

/** A fresh screen over the world; `answer` is what the dialog says (null: there is no dialog). */
function screenOf(world: World, answer: boolean | null = false, keys: Keymap = keymap, now: () => number = () => 1000): Fixture {
  const { w } = world;
  const sent: Command[] = [];
  const asked: Asked[] = [];
  const managers: unknown[] = [];
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { sent.push(cmd); },
    speed: () => 1,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now,
    laborManager: (open) => { managers.push(open); },
    ...(answer === null ? {} : {
      confirm: (id: string, params: Readonly<Record<string, unknown>>, reply: (yes: boolean) => void): void => {
        asked.push({ id, params: params as Record<string, unknown> });
        reply(answer);
      },
    }),
  };
  return { screen: new FortressScreen(host, keys, strings), sent, asked, managers };
}

/** The build tool on the bed (U-04: a type a drag places many of). */
function bedTool(f: Fixture): void {
  f.screen.openPanel('build');
  f.screen.build.choose('f');
  f.screen.build.list.selected = f.screen.build.rows(f.screen.ctx).findIndex((row) => row.id === 'bed');
  expect(f.screen.build.multi(f.screen.ctx)).toBe(true);
}

/** Every state a panel letter must still work in: each panel, and each panel with something selected or a tool chosen. */
const STATES: readonly { readonly name: string; readonly open: (f: Fixture, world: World) => void }[] = [
  ...['designate', 'build', 'zones', 'units', 'labors', 'jobs', 'orders', 'stocks', 'military', 'animals', 'threats', 'civilizations',
    'population', 'mood', 'log', 'overlays', 'calendar', 'help', 'debug', 'depot'].map((id) => ({ name: id, open: (f: Fixture) => f.screen.openPanel(id) })),
  { name: 'look', open: (f) => f.screen.look({ x: 20, y: 20, z }) },
  { name: 'look at a building', open: (f) => f.screen.look({ x: 40, y: 20, z }) },
  { name: 'workshop', open: (f, world) => { f.screen.workshopId = world.shop; f.screen.openPanel('workshop'); } },
  { name: 'workshop with orders', open: (f, world) => { f.screen.workshopId = world.busyShop; f.screen.openPanel('workshop'); } },
  { name: 'orders of a workshop, one selected', open: (f, world) => { f.screen.orders.workshopId = world.busyShop; f.screen.openPanel('orders'); } },
  { name: 'designate with the dig tool', open: (f) => { f.screen.openPanel('designate'); f.screen.tool.choose('d'); } },
  { name: 'build with a category', open: (f) => { f.screen.openPanel('build'); f.screen.build.choose('w'); } },
  // U-04: a drag of a 1×1 type in progress, and the out-of-stock line (`o` then opens the picker, still on Orders).
  { name: 'build dragging a row of beds', open: (f) => { bedTool(f); f.screen.build.anchor = { x: 30, y: 30, z }; f.screen.build.end = { x: 32, y: 30, z }; } },
  { name: 'build with beds out of stock', open: (f) => { bedTool(f); f.screen.placeMany({ x: 30, y: 30, z }, { x: 32, y: 30, z }); expect(f.screen.statusRow2()).toContain('[o] order 3'); f.sent.length = 0; } },
  // U-05: the building panel, its link-target chooser and its owner chooser.
  { name: 'the building panel on a table', open: (f, world) => { f.screen.openBuilding(world.table); expect(f.screen.ui.panel).toBe('building'); } },
  { name: 'the building panel choosing a link target', open: (f, world) => { f.screen.openBuilding(world.lever); f.screen.key(press('i')); expect(f.screen.building.linking).toBe(true); } },
  { name: 'the building panel choosing an owner', open: (f, world) => { f.screen.openBuilding(world.bed); f.screen.key(press('w')); expect(f.screen.building.choosing).toBe(true); } },
  { name: 'zones with a tool', open: (f) => { f.screen.openPanel('zones'); f.screen.zones.choose('s'); } },
  { name: 'zones with a zone selected', open: (f, world) => { f.screen.openPanel('zones'); f.screen.zones.selected = world.pile; } },
  ...(['tree', 'barrel', 'bag', 'bin', 'priority', 'minQuality', 'maxQuality'] as const).map((focus) => ({
    name: `U-07 stockpile ${focus}`, open: (f: Fixture, world: World) => { f.screen.openPanel('zones'); f.screen.zones.selected = world.pile; f.screen.zones.stockpile.focus = focus; },
  })),
  { name: 'U-07 preset dropdown', open: (f, world) => { f.screen.openPanel('zones'); f.screen.zones.selected = world.pile; f.screen.key(press('P', { shift: true })); expect(f.screen.zones.stockpile.preset.open).toBe(true); } },
  { name: 'U-07 material classes', open: (f, world) => { f.screen.openPanel('zones'); f.screen.zones.selected = world.pile; f.screen.key(press('v')); expect(f.screen.zones.stockpile.materialsOpen).toBe(true); } },
  { name: 'U-07 room owner picker', open: (f, world) => { f.screen.openPanel('zones'); f.screen.zones.selected = world.w.readers.of<BuildingsReader>('14').zoneAt(world.w.index(48, 20, z)); f.screen.key(press('O', { shift: true })); expect(f.screen.zones.ownerOpen).toBe(true); } },
  { name: 'stocks picking goods for the depot', open: (f) => { f.screen.openPanel('stocks'); f.screen.stocks.startDepot(1); } },
  { name: 'T-241 Jobs labor filter', open: (f) => { f.screen.openPanel('jobs'); f.screen.jobs.labor = 'carpentry'; } },
  { name: 'T-241 Jobs state filter', open: (f) => { f.screen.openPanel('jobs'); f.screen.jobs.state = 'blocked'; } },
  { name: 'T-241 Jobs text filter', open: (f) => { f.screen.openPanel('jobs'); f.screen.jobs.filter.value = 'bed'; } },
  { name: 'T-241 Stocks text filter', open: (f) => { f.screen.openPanel('stocks'); f.screen.stocks.filter.value = 'iron'; } },
  { name: 'military setting a station', open: (f) => { f.screen.openPanel('military'); f.screen.military.settingStation = true; } },
  // U-06's lists and choosers: marks, the squad's add list, the leader and title choosers.
  { name: 'military choosing members to add', open: (f) => { f.screen.openPanel('military'); f.screen.military.openChoice(f.screen.ctx, 'add'); expect(f.screen.military.memberChoice?.kind).toBe('add'); } },
  { name: 'military with a member marked', open: (f) => { f.screen.openPanel('military'); f.screen.military.openChoice(f.screen.ctx, 'add'); f.screen.key(press(' ')); expect(f.screen.military.memberChoice?.marks.size).toBe(1); } },
  { name: 'units with a dwarf marked', open: (f) => { f.screen.openPanel('units'); f.screen.key(press(' ')); expect(f.screen.units.marks.size).toBe(1); } },
  { name: 'units choosing a title', open: (f) => { f.screen.openPanel('units'); f.screen.key(press('T', { shift: true })); expect(f.screen.units.choice?.kind).toBe('title'); } },
  { name: 'units choosing a squad', open: (f) => { f.screen.openPanel('units'); f.screen.key(press('M', { shift: true })); expect(f.screen.units.choice?.kind).toBe('squad'); } },
  { name: 'civilizations choosing a request', open: (f) => { f.screen.openPanel('civilizations'); f.screen.civilizations.choosingRequest = true; } },
  { name: 'a map selection', open: (f) => { f.screen.look({ x: 36, y: 36, z }); f.screen.selection = { a: { x: 36, y: 36, z }, b: { x: 37, y: 37, z } }; } },
  ...([0, 1] as const).map(selected => ({ name: `T-246 animal training choice ${selected}`, open: (f: Fixture, world: World) => { f.screen.openPanel('animals'); expect(world.dog).toBeGreaterThan(0); f.screen.animals.list.selected = f.screen.animals.rows(f.screen.ctx).indexOf(world.dog ?? 0); f.screen.key(press('T', { shift: true })); expect(f.screen.animals.trainChoice).not.toBeNull(); f.screen.animals.trainChoice!.selected = selected; } })),
  { name: 'no panel', open: (f) => f.screen.openPanel(null) },
];

describe('U-03 panel hotkeys always win (D-U2, M3, S4)', () => {
  const shared = world('u03-hotkeys');

  it('the panel letters are the keymap\'s fortress_panel rows', () => {
    expect(Array.from(keymap.panelLetters()).sort()).toEqual(FORTRESS_PANEL_KEYS.map((p) => p.key).sort());
    expect(Array.from(DEFAULT_PANEL_LETTERS).sort()).toEqual(Array.from(keymap.panelLetters()).sort());
    expect(screenOf(shared).screen.panelLetters()).toEqual(keymap.panelLetters());
  });

  // The table: every state × every panel letter.
  for (const state of STATES) {
    it(`no panel letter is shadowed by an accelerator: ${state.name}`, () => {
      for (const { id, key } of FORTRESS_PANEL_KEYS) {
        const f = screenOf(shared);
        state.open(f, shared);
        const was = f.screen.ui.panel;
        expect(f.screen.key(press(key)), `${key} in ${state.name}`).toBe(true);
        // The letter opens its panel, or closes it when it was the open one.
        expect(f.screen.ui.panel, `${key} in ${state.name}`).toBe(was === id ? null : id);
        // It did nothing else: no command, no question, no tool left behind from the old panel.
        expect(f.sent, `${key} in ${state.name}`).toEqual([]);
        expect(f.asked, `${key} in ${state.name}`).toEqual([]);
        expect(f.managers, `${key} in ${state.name}`).toEqual([]);
        if (id !== 'build') expect(f.screen.build.active).toBe(false);
        if (id !== 'zones') expect(f.screen.zones.active).toBe(false);
        if (id !== 'designate') expect(f.screen.tool.active).toBe(false);
      }
    });
  }

  it('the open panel\'s own key closes it; Designate opens with Dig chosen (D-241)', () => {
    let time = 1000;
    const f = screenOf(shared, false, keymap, () => time);
    for (const { id, key } of FORTRESS_PANEL_KEYS) {
      f.screen.key(press(key));
      expect(f.screen.ui.panel).toBe(id);
      f.screen.key(press(key));
      expect(f.screen.ui.panel).toBeNull();
    }
    f.screen.key(press('d'));
    expect(f.screen.tool.kind).toBe('dig');
    expect(f.screen.statusRow2()).toBe('Designate closed \u00b7 [d] opens it again');
    time += 10000; // The T-252 close notice expires; the armed tool hint returns.
    expect(f.screen.statusRow2()).toMatch(/^Dig · priority 5/);
    f.screen.key(press('d'));
    expect(f.screen.tool.active).toBe(false);
  });

  it('an accelerator on a panel letter takes Shift; a free letter does not', () => {
    expect(acceleratorOf(press('m'))).toBe('');
    expect(acceleratorOf(press('M', { shift: true }))).toBe('m');
    expect(acceleratorOf(press('m', { shift: true }))).toBe('m');
    expect(acceleratorOf(press('w'))).toBe('w');
    expect(acceleratorOf(press('W', { shift: true }))).toBe('w');
    expect(acceleratorOf(press('m', { shift: true, ctrl: true }))).toBe('');
    expect(acceleratorOf(press('Enter'))).toBe('');
    expect(acceleratorLabel('m')).toBe('[S-m]');
    expect(acceleratorLabel('w')).toBe('[w]');
    // A rebound panel key frees its old letter and reserves the new one.
    const rebound = Keymap.fromRows(registry.derived<readonly KeymapRow[]>('keymap'));
    const at = rebound.bindings.findIndex((b) => b.context === 'fortress_panel' && b.id === 'military');
    expect(rebound.rebind(at, { key: 'y', ctrl: false, shift: false })).toBeNull();
    const f = screenOf(shared, false, rebound);
    expect(f.screen.panelLetters().has('m')).toBe(false);
    expect(f.screen.panelLetters().has('y')).toBe(true);
    f.screen.key(press('y'));
    expect(f.screen.ui.panel).toBe('military');
  });

  it('Shift+letter runs the panel\'s action and leaves the panel open', () => {
    const cases: readonly { open: (f: Fixture) => void; key: string; check: (f: Fixture) => void }[] = [
      { open: (f) => { f.screen.openPanel('stocks'); f.screen.stocks.tree.selected = 0; }, key: 'f', check: (f) => expect(f.sent[0]?.type).toBe('ForbidItem') },
      { open: (f) => f.screen.openPanel('military'), key: 's', check: (f) => expect(f.screen.military.settingStation).toBe(true) },
      { open: (f) => f.screen.openPanel('military'), key: 'p', check: (f) => expect(f.screen.military.settingPatrol).toBe(true) },
      { open: (f) => f.screen.openPanel('military'), key: 'j', check: (f) => expect(f.sent[0]?.type).toBe('SetSquadEquipment') },
      { open: (f) => f.screen.openPanel('military'), key: 't', check: (f) => expect(f.sent[0]).toMatchObject({ type: 'SetSquadMode', mode: 'train' }) },
      { open: (f) => f.screen.openPanel('animals'), key: 'p', check: (f) => expect(f.sent[0]?.type).toBe('AssignPasture') },
      { open: (f) => f.screen.openPanel('animals'), key: 'n', check: (f) => expect(f.screen.animals.name.focused).toBe(true) },
      { open: (f) => f.screen.openPanel('build'), key: 'f', check: (f) => expect(f.screen.build.category).toBe('furniture') },
      { open: (f) => f.screen.openPanel('zones'), key: 'b', check: (f) => expect(f.screen.zones.kind).toBe('bedroom') },
      { open: (f) => f.screen.openPanel('designate'), key: 'c', check: (f) => expect(f.screen.tool.kind).toBe('channel') },
      { open: (f) => { f.screen.openPanel('mood'); f.screen.mood.sorted = false; }, key: 's', check: (f) => expect(f.screen.mood.sorted).toBe(true) },
      { open: (f) => { f.screen.workshopId = shared.busyShop; f.screen.openPanel('workshop'); }, key: 'o', check: (f) => expect(f.screen.orders.workshopId).toBe(shared.busyShop) },
      // U-06's accelerators follow the same rule.
      { open: (f) => f.screen.openPanel('units'), key: 't', check: (f) => expect(f.screen.units.choice?.kind).toBe('title') },
      { open: (f) => f.screen.openPanel('units'), key: 'm', check: (f) => expect(f.screen.units.choice?.kind).toBe('squad') },
      { open: (f) => f.screen.openPanel('military'), key: 'a', check: (f) => expect(f.screen.military.memberChoice?.kind).toBe('add') },
      { open: (f) => { f.screen.openPanel('units'); f.screen.key(press(' ')); }, key: 'l', check: (f) => expect(f.managers).toHaveLength(1) },
    ];
    for (const c of cases) {
      const f = screenOf(shared);
      c.open(f);
      const panel = f.screen.ui.panel;
      expect(f.screen.key(press(c.key.toUpperCase(), { shift: true })), c.key).toBe(true);
      c.check(f);
      if (c.key !== 'o') expect(f.screen.ui.panel).toBe(panel);
    }
    // The military panel's clear-patrol moved off Shift+p, which is now "add": `[y] clear`.
    const f = screenOf(shared);
    f.screen.openPanel('military');
    f.screen.key(press('y'));
    expect(f.sent).toEqual([{ type: 'SetSquadPatrol', squadId: shared.squad, tiles: [] }]);
  });

  it('the labor manager is a screen of its own: a panel letter there never reaches the fortress', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 'u03-labor-manager', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const sent: Command[] = [];
    game.handleKey(press('l'));
    game.handleKey(press('Enter'));
    expect(game.screen).toBe('labor_manager');
    const submit = game.host.submit.bind(game.host);
    game.host.submit = (cmd: Command) => { sent.push(cmd); return submit(cmd); };
    for (const { key } of FORTRESS_PANEL_KEYS) {
      expect(game.handleKey(press(key)), key).toBe(true);
      expect(game.screen, key).toBe('labor_manager');
      expect(game.ui.panel, key).toBe('labors');
    }
    // Its own letters (`a` row, `c` column, `t` templates) are labor toggles: nothing destructive, no question.
    expect(sent.every((cmd) => cmd.type === 'SetLabor' || cmd.type === 'SetLaborPriority')).toBe(true);
    game.handleKey(press('Esc'));
    game.handleKey(press('Esc'));
    expect(game.screen).toBe('fortress');
    // Back on the fortress the panel letters work at once.
    game.handleKey(press('s'));
    expect(game.ui.panel).toBe('stocks');
  });

  it('a focused text field takes letters as text', () => {
    const f = screenOf(shared);
    f.screen.openPanel('units');
    f.screen.key(press('/'));
    for (const ch of 'smd') f.screen.key(press(ch));
    expect(f.screen.units.filter).toBe('smd');
    expect(f.screen.ui.panel).toBe('units');
    f.screen.key(press('Enter'));
    f.screen.key(press('s'));
    expect(f.screen.ui.panel).toBe('stocks');
    // The order picker's filter too.
    f.screen.key(press('o'));
    f.screen.key(press('N', { shift: true }));
    for (const ch of 'bed') f.screen.key(press(ch));
    expect(f.screen.orders.picker.filter).toBe('bed');
    expect(f.screen.ui.panel).toBe('orders');
  });

  it('T-121: zone inspector and Help captions follow rebound panel letters while fixed captions retain defaults', () => {
    const keys = new Keymap(keymap.bindings);
    const population = keys.bindings.findIndex((b) => b.context === 'fortress_panel' && b.id === 'population');
    expect(keys.rebind(population, { key: 'g', ctrl: false, shift: false })).toBeNull();
    const f = screenOf(shared, false, keys);
    f.screen.zones.selected = shared.pile;
    f.screen.openPanel('zones');
    const s = surface(80, 42);
    f.screen.draw(s);
    expect(s.lines().join('\n')).toContain('[p] Preset');
    expect(s.lines().join('\n')).toContain('[S-g]');
    const help = helpKeyRows(keys, strings).filter((r) => r.category === 'zones').map((r) => r.text).join('\n');
    expect(help).toContain('[p]');
    expect(help).toContain('[S-g]');
    const military = keys.bindings.findIndex((b) => b.context === 'fortress_panel' && b.id === 'military');
    expect(keys.rebind(military, { key: 'y', ctrl: false, shift: false })).toBeNull();
    f.screen.openPanel('stocks');
    const stocks = surface(80, 42); f.screen.draw(stocks);
    expect(stocks.lines().join('\n')).toContain('[S-m] melt');
    f.screen.key(press('g'));
    expect(f.screen.ui.panel).toBe('population');
    expect(f.sent).toEqual([]);
  });

  it('the panels show the moved accelerators as [S-letter]', () => {
    const shown = (open: (f: Fixture) => void): string => {
      const f = screenOf(shared);
      open(f);
      const s = surface(80, 42);
      f.screen.draw(s);
      return s.lines().join('\n');
    };
    expect(shown((f) => f.screen.openPanel('stocks'))).toContain('[S-f] forbid  [S-d] dump');
    expect(shown((f) => f.screen.openPanel('stocks'))).toContain('[S-m] melt  [S-t] to depot');
    expect(shown((f) => f.screen.openPanel('military'))).toContain('[S-s] set  [S-c] clear');
    expect(shown((f) => f.screen.openPanel('military'))).toContain('[S-p] add [y] clear');
    expect(shown((f) => f.screen.openPanel('animals'))).toContain('[S-p] pasture  [S-s] slaughter');
    expect(shown((f) => f.screen.openPanel('designate'))).toContain('[S-d] Dig');
    expect(shown((f) => f.screen.openPanel('designate'))).toContain('[w] Stairwell');
    expect(shown((f) => f.screen.openPanel('build'))).toContain('[S-m] Mechan');
    expect(shown((f) => f.screen.openPanel('zones'))).toContain('[S-s] Stockpile');
    expect(shown((f) => { f.screen.workshopId = shared.shop; f.screen.openPanel('workshop'); })).toContain('[S-s] suspend  [x] take apart');
    expect(shown((f) => { f.screen.look({ x: 36, y: 36, z }); f.screen.selection = { a: { x: 36, y: 36, z }, b: { x: 37, y: 37, z } }; }))
      .toContain('[S-f] forbid  [S-d] dump  [S-t] to depot');
  });
});

/** Each destructive single key: the state it is pressed in, the question it asks, and the command a Yes sends. */
const DESTRUCTIVE: readonly {
  readonly name: string;
  readonly open: (f: Fixture, world: World) => void;
  readonly key: ReturnType<typeof press>;
  readonly confirm: string;
  readonly command: string;
}[] = [
  { name: 'stocks [S-m] melt', open: (f) => { f.screen.openPanel('stocks'); selectStock(f, 'stone'); }, key: press('M', { shift: true }), confirm: 'c_melt_items', command: 'MeltItem' },
  { name: 'stocks [S-d] dump', open: (f) => { f.screen.openPanel('stocks'); selectStock(f, 'stone'); }, key: press('D', { shift: true }), confirm: 'c_dump_items', command: 'DumpItem' },
  { name: 'a selection\'s [S-d] dump', open: (f) => { f.screen.look({ x: 36, y: 36, z }); f.screen.selection = { a: { x: 36, y: 36, z }, b: { x: 37, y: 37, z } }; }, key: press('D', { shift: true }), confirm: 'c_dump_selection', command: 'DumpItem' },
  { name: 'animals [S-s] slaughter', open: (f) => f.screen.openPanel('animals'), key: press('S', { shift: true }), confirm: 'c_slaughter_animal', command: 'MarkSlaughter' },
  { name: 'workshop [S-s] suspend', open: (f, world) => { f.screen.workshopId = world.shop; f.screen.openPanel('workshop'); }, key: press('S', { shift: true }), confirm: 'c_suspend_workshop', command: 'SuspendWorkshop' },
  { name: 'workshop [x] take apart', open: (f, world) => { f.screen.workshopId = world.shop; f.screen.openPanel('workshop'); }, key: press('x'), confirm: 'c_deconstruct_building', command: 'DeconstructBuilding' },
  { name: 'workshop with orders [x] take apart', open: (f, world) => { f.screen.workshopId = world.busyShop; f.screen.openPanel('workshop'); }, key: press('x'), confirm: 'c_deconstruct_workshop', command: 'DeconstructBuilding' },
  { name: 'look [x] take apart', open: (f) => f.screen.look({ x: 40, y: 20, z }), key: press('x'), confirm: 'c_deconstruct_building', command: 'DeconstructBuilding' },
  { name: 'military [x] disband', open: (f) => f.screen.openPanel('military'), key: press('x'), confirm: 'c_disband_squad', command: 'DisbandSquad' },
  { name: 'zones [x] remove', open: (f, world) => { f.screen.openPanel('zones'); f.screen.zones.selected = world.pile; }, key: press('x'), confirm: 'c_remove_zone', command: 'RemoveZone' },
  { name: 'orders [x] remove', open: (f, world) => { f.screen.orders.workshopId = world.busyShop; f.screen.openPanel('orders'); }, key: press('x'), confirm: 'c_remove_order', command: 'RemoveWorkOrder' },
];

function selectStock(f: Fixture, node: string): void {
  const rows = f.screen.stocks.visibleForest(f.screen.ctx).map((n) => n.id);
  expect(rows).toContain(node);
  f.screen.stocks.tree.selected = rows.indexOf(node);
}

describe('U-03 every destructive single-key action asks first, default No (D-U2)', () => {
  const shared = world('u03-destructive');

  for (const action of DESTRUCTIVE) {
    it(`${action.name} asks ${action.confirm}`, () => {
      // No: the question was asked and nothing was sent.
      const no = screenOf(shared, false);
      action.open(no, shared);
      expect(no.screen.key(action.key)).toBe(true);
      expect(no.asked.map((a) => a.id)).toEqual([action.confirm]);
      expect(no.sent).toEqual([]);
      // Yes: the command goes.
      const yes = screenOf(shared, true);
      action.open(yes, shared);
      yes.screen.key(action.key);
      expect(yes.asked.map((a) => a.id)).toEqual([action.confirm]);
      expect(yes.sent.map((c) => c.type)).toContain(action.command);
      // The dialog's default is No, its text has no unfilled placeholder, and Enter answers No.
      const row = registry.table<{ id: string; default: string }>('confirmations').byId(action.confirm);
      expect(row?.default).toBe('no');
      const answers: boolean[] = [];
      const dialog = new ConfirmScreen(registry, strings, action.confirm, yes.asked[0]?.params as Record<string, string | number>, (a) => answers.push(a));
      expect(dialog.defaultYes).toBe(false);
      expect(dialog.text).not.toMatch(/[{}]/);
      dialog.key(press('Enter'));
      expect(answers).toEqual([false]);
    });
  }

  it('the questions name the thing', () => {
    const text = (id: string, open: (f: Fixture) => void, key: ReturnType<typeof press>): string => {
      const f = screenOf(shared, false);
      open(f);
      f.screen.key(key);
      return new ConfirmScreen(registry, strings, id, f.asked[0]?.params as Record<string, string | number>, () => {}).text;
    };
    expect(text('c_suspend_workshop', (f) => { f.screen.workshopId = shared.shop; f.screen.openPanel('workshop'); }, press('S', { shift: true })))
      .toBe("Suspend Carpenter's workshop #1? Its current job stops and its orders wait until you resume it.");
    expect(text('c_deconstruct_building', (f) => f.screen.look({ x: 40, y: 20, z }), press('x'))).toBe('Take apart Table #1? Its materials are left where it stood.');
    expect(text('c_remove_zone', (f) => { f.screen.openPanel('zones'); f.screen.zones.selected = shared.pile; }, press('x'))).toBe('Remove Stockpile #1? Its settings are lost.');
    expect(text('c_remove_order', (f) => { f.screen.orders.workshopId = shared.busyShop; f.screen.openPanel('orders'); }, press('x'))).toBe('Remove the order for Bed? Work in progress on it stops.');
    expect(text('c_slaughter_animal', (f) => f.screen.openPanel('animals'), press('S', { shift: true }))).toBe('Slaughter the cow? It will be butchered for meat, hide and bone.');
    expect(text('c_dump_selection', (f) => { f.screen.look({ x: 36, y: 36, z }); f.screen.selection = { a: { x: 36, y: 36, z }, b: { x: 37, y: 37, z } }; }, press('D', { shift: true })))
      .toBe('Dump everything on these 4 tiles? Dwarves will carry it to a dump zone.');
  });

  it('a click asks the same question as the key', () => {
    const click = (open: (f: Fixture) => void, caption: string): Fixture => {
      const f = screenOf(shared, false);
      open(f);
      const s = surface(80, 42);
      f.screen.draw(s);
      const lines = s.lines();
      const row = lines.findIndex((line) => line.includes(caption));
      expect(row, caption).toBeGreaterThanOrEqual(0);
      s.hitAt((lines[row] as string).indexOf(caption) + 1, row)?.action();
      return f;
    };
    expect(click((f) => { f.screen.openPanel('stocks'); selectStock(f, 'stone'); }, '[S-m] melt').asked.map((a) => a.id)).toEqual(['c_melt_items']);
    expect(click((f) => { f.screen.openPanel('stocks'); selectStock(f, 'stone'); }, '[S-d] dump').asked.map((a) => a.id)).toEqual(['c_dump_items']);
    expect(click((f) => { f.screen.workshopId = shared.shop; f.screen.openPanel('workshop'); }, '[S-s] suspend').asked.map((a) => a.id)).toEqual(['c_suspend_workshop']);
    expect(click((f) => { f.screen.workshopId = shared.shop; f.screen.openPanel('workshop'); }, '[x] take apart').asked.map((a) => a.id)).toEqual(['c_deconstruct_building']);
    expect(click((f) => { f.screen.openPanel('zones'); f.screen.zones.selected = shared.pile; }, '[x] remove zone').asked.map((a) => a.id)).toEqual(['c_remove_zone']);
    expect(click((f) => { f.screen.orders.workshopId = shared.busyShop; f.screen.openPanel('orders'); }, '[x] remove').asked.map((a) => a.id)).toEqual(['c_remove_order']);
    expect(click((f) => f.screen.openPanel('military'), '[x] disband').asked.map((a) => a.id)).toEqual(['c_disband_squad']);
  });

  it('undoing a mark does not ask: resume, unmark, forbid', () => {
    const w = new TestWorld({ seed: 'u03-undo', world: 'flat-test', embark: 'none' });
    const shop = w.build('carpenter', w.index(15, 15, z));
    const cow = w.spawnTame('cow', w.index(34, 34, z));
    w.spawnItem('stone_block', 'iron', w.index(36, 36, z), 2);
    w.step(1);
    w.submit({ type: 'SuspendWorkshop', workshopId: shop, on: true });
    w.submit({ type: 'MarkSlaughter', animalId: cow });
    w.submit({ type: 'MeltItem', tiles: [w.index(36, 36, z)], on: true });
    w.step(1);
    expect(w.readers.entities.get(shop, C.Workshop)?.suspended).toBe(true);
    expect(w.readers.entities.get(cow, C.Tame)?.slaughter).toBe(true);
    const local: World = { w, shop, busyShop: shop, pile: 0, cow, squad: 0, table: 0, lever: 0, bed: 0 };
    const f = screenOf(local, false);
    f.screen.workshopId = shop;
    f.screen.openPanel('workshop');
    f.screen.key(press('S', { shift: true }));
    f.screen.openPanel('animals');
    f.screen.key(press('S', { shift: true }));
    f.screen.openPanel('stocks');
    selectStock(f, 'stone');
    f.screen.key(press('F', { shift: true }));
    expect(f.asked).toEqual([]);
    expect(f.sent.map((c) => c.type)).toEqual(['SuspendWorkshop', 'UnmarkSlaughter', 'ForbidItem']);
    expect(f.sent[0]).toMatchObject({ on: false });
    // Melting something that is not metal says so instead of asking.
    const wood = new TestWorld({ seed: 'u03-no-metal', world: 'flat-test', embark: 'none' });
    wood.spawnItem('log', 'oak', wood.index(36, 36, z), 1);
    wood.step(1);
    const g = screenOf({ ...local, w: wood }, false);
    g.screen.openPanel('stocks');
    g.screen.stocks.tree.selected = 0;
    g.screen.key(press('M', { shift: true }));
    expect(g.asked).toEqual([]);
    expect(g.sent).toEqual([]);
    expect(g.screen.statusRow2()).toBe('Nothing here is metal: only metal items melt.');
  });

  it('without a dialog (a bare host) the command goes as asked', () => {
    const f = screenOf(shared, null);
    f.screen.workshopId = shared.shop;
    f.screen.openPanel('workshop');
    f.screen.key(press('x'));
    expect(f.sent).toEqual([{ type: 'DeconstructBuilding', buildingId: shared.shop }]);
  });

  it('the building reader is the one the fixture expects', () => {
    expect(shared.w.readers.of<BuildingsReader>('14').at(shared.w.index(40, 20, z))).toBe(shared.table);
  });
});
