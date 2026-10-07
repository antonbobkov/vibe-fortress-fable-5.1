/** U-07 M7/M9/§4.4: stockpile settings and current room facts without advancing simulation. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { AnnouncementLog } from '@ui/announcements';
import { Keymap } from '@ui/keymap';
import { helpKeyRows } from '@ui/panels/help';
import { drawZonesPanel, ZoneTool } from '@ui/panels/zones';
import { STOCKPILE_FIELDS } from '@ui/panels/stockpile-editor';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
function fixture() {
  const w = new TestWorld({ seed: 'u07-zones', world: 'flat-test', embark: 'none' });
  const dwarf = w.spawnDwarf({ at: w.index(18, 18, z), name: 'Urist Stone' });
  const pile = w.zone('stockpile', [w.index(30, 30, z), w.index(31, 30, z)]);
  const room = w.zone('bedroom', [w.index(40, 30, z), w.index(41, 30, z)]);
  w.build('bed', w.index(40, 30, z), 'oak');
  w.step(1);
  const sent: Command[] = [];
  const notices: string[] = [];
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings, panelLetters: keymap.panelLetters(),
    submit: (cmd) => { sent.push(cmd); expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    notice: (text) => notices.push(text), focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  const tool = new ZoneTool(); tool.selected = pile;
  const it = w.readers.of<ItemsReader>('13');
  const b = w.readers.of<BuildingsReader>('14');
  return { w, dwarf, pile, room, ctx, tool, it, b, sent, notices };
}

function click(s: ReturnType<typeof surface>, needle: string, offset = 1): void {
  const rows = s.lines();
  const row = rows.findIndex((r) => r.includes(needle));
  expect(row, needle).toBeGreaterThanOrEqual(0);
  const hit = s.hitAt((rows[row] as string).indexOf(needle) + offset, row);
  expect(hit, needle).not.toBeNull();
  hit?.action();
}

describe('U-07 stockpile editor (M7)', () => {
  it('chooses a preset by Shift accelerator and first letter, never a bare panel letter', () => {
    const f = fixture();
    const tick = f.w.readers.calendar.tick;
    expect(f.tool.editorKey(f.ctx, press('p'))).toBe(false);
    f.tool.editorKey(f.ctx, press('P', { shift: true }));
    expect(f.tool.stockpile.preset.open).toBe(true);
    f.tool.editorKey(f.ctx, press('w'));
    f.tool.editorKey(f.ctx, press('Enter'));
    expect(f.it.stockpile(f.pile)?.filter.categories).toEqual(['wood']);
    expect(f.w.readers.calendar.tick).toBe(tick);
  });

  it('navigates the category tree and applies tri-state toggles from Space', () => {
    const f = fixture();
    f.tool.editorKey(f.ctx, press('→'));
    expect(f.tool.tree.expanded.has('food')).toBe(true);
    f.tool.editorKey(f.ctx, press('↓'));
    f.tool.editorKey(f.ctx, press('Space'));
    expect(f.it.stockpile(f.pile)?.filter.categories).toEqual(['food/meat']);
    f.tool.editorKey(f.ctx, press('←'));
    expect(f.tool.tree.selected).toBe(0);
    f.tool.editorKey(f.ctx, press('Space'));
    expect(f.it.stockpile(f.pile)?.filter.categories).toEqual(['food']);
    f.tool.editorKey(f.ctx, press('Space'));
    expect(f.it.stockpile(f.pile)?.filter.categories).toEqual([]);
  });

  it('edits all six numeric fields, preserving other settings', () => {
    const f = fixture();
    const tick = f.w.readers.calendar.tick;
    const before = f.it.stockpile(f.pile)!;
    f.tool.editorKey(f.ctx, press('q'));
    for (const field of STOCKPILE_FIELDS) {
      expect(f.tool.stockpile.focus).toBe(field);
      f.tool.editorKey(f.ctx, press(field === 'maxQuality' ? '←' : '→'));
      f.tool.editorKey(f.ctx, press('Tab'));
    }
    const after = f.it.stockpile(f.pile)!;
    expect(after.containersWanted).toEqual({ barrel: before.containersWanted.barrel + 1, bag: before.containersWanted.bag + 1, bin: before.containersWanted.bin + 1 });
    expect(after.priority).toBe(before.priority + 1);
    expect(after.filter).toEqual({ ...before.filter, minQuality: 1, maxQuality: 4 });
    expect(after.linkedSources).toEqual(before.linkedSources);
    expect(f.w.readers.calendar.tick).toBe(tick);
  });

  it('rejects crossed quality bounds and negative container counts with messages', () => {
    const f = fixture();
    const hash = f.w.hash();
    f.tool.stockpile.adjust(f.ctx, f.pile, 'barrel', -1);
    f.tool.stockpile.adjust(f.ctx, f.pile, 'minQuality', 6);
    f.tool.stockpile.adjust(f.ctx, f.pile, 'maxQuality', -6);
    expect(f.sent).toEqual([]);
    expect(f.notices).toEqual([strings.get('ui.zone.edit.bounds'), strings.get('ui.zone.edit.quality'), strings.get('ui.zone.edit.quality')]);
    expect(f.w.hash()).toBe(hash);
  });

  it('selects material classes with arrows and Space, and cancels without changing the filter', () => {
    const f = fixture();
    f.tool.editorKey(f.ctx, press('v'));
    f.tool.editorKey(f.ctx, press('Space')); // Any -> none.
    const classes = f.tool.stockpile.classes(f.ctx);
    for (let n = 0; n <= classes.indexOf('metal'); n += 1) f.tool.editorKey(f.ctx, press('↓'));
    f.tool.editorKey(f.ctx, press('Space'));
    expect(f.it.stockpile(f.pile)?.filter.materialClasses).toEqual(['metal']);
    const hash = f.w.hash();
    expect(f.tool.cancelEditor()).toBe(true);
    expect(f.w.hash()).toBe(hash);
  });

  it('mouse preset, numeric and material controls use the same commands; truncated values have tooltips', () => {
    const f = fixture();
    const draw = () => { const s = surface(36, 40); drawZonesPanel(s, { col: 0, row: 0, cols: 32, rows: 40 }, f.tool, f.ctx); return s; };
    click(draw(), '[S-p] Preset');
    click(draw(), 'Weapons and armor');
    expect(f.it.stockpile(f.pile)?.filter.categories).toEqual(['weapon', 'ammo', 'armor']);
    expect(draw().tooltips.some((t) => t.text.includes('Weapons and armor'))).toBe(true);
    const s = draw();
    const row = s.lines().findIndex((r) => r.includes('Barrels wanted'));
    s.hitAt(26, row)?.action();
    expect(f.it.stockpile(f.pile)?.containersWanted.barrel).toBe(1);
    click(draw(), '[v] materials');
    click(draw(), 'any');
    click(draw(), 'Metal');
    expect(f.it.stockpile(f.pile)?.filter.materialClasses).toEqual(['metal']);
  });
});

describe('U-07 room panel and stockpile announcements (M9, §4.4)', () => {
  it('reports exact missing requirements for every room type without mutating world state', () => {
    const f = fixture();
    const expected = { bedroom: ['bed'], dining_hall: ['table_chair'], hearth_hall: ['hearth'], hospital: ['bed', 'chest'], barracks: [], tomb: ['coffin'] };
    let x = 10;
    for (const [type, missing] of Object.entries(expected)) {
      const id = f.w.zone(type, [f.w.index(x, 45, z)]); x += 3;
      const hash = f.w.hash();
      expect(f.b.roomDiagnostics(id)?.missing).toEqual(missing);
      expect(f.b.roomScore(id)?.requirementsMet).toBe(missing.length === 0);
      f.tool.selected = id;
      const s = surface(36, 40);
      drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, f.tool, f.ctx);
      for (const code of missing) expect(s.lines().join('\n')).toContain(strings.get(`ui.zone.needs.${code}`));
      expect(f.w.hash()).toBe(hash);
    }
  });

  it('counts unique diagonal border tiles and ignores planned doors until they are built', () => {
    const f = fixture();
    const zz = z - 7;
    f.w.digRoom(30, 30, zz, 3, 3);
    const tiles = Array.from({ length: 9 }, (_, n) => f.w.index(30 + n % 3, 30 + Math.floor(n / 3), zz));
    const room = f.w.zone('barracks', tiles);
    const gap = f.w.index(29, 29, zz);
    f.w.map.setKind(gap, TileKind.Floor, 1);
    expect(f.b.roomDiagnostics(room)?.openBorder).toEqual([gap]);
    expect(f.b.roomScore(room)?.enclosed).toBe(false);
    f.w.map.setKind(gap, TileKind.Fortification, 1);
    expect(f.b.roomDiagnostics(room)?.openBorder).toEqual([]);
    const doorAt = f.w.index(31, 29, zz);
    f.w.discover(doorAt);
    f.w.map.setKind(doorAt, TileKind.Floor, 1);
    const door = f.w.build('door', doorAt, 'oak');
    const record = f.w.game.world.entities.get(door, C.Building)!;
    f.w.game.world.entities.add(door, C.Building, { ...record, state: 'planned' });
    expect(f.b.roomDiagnostics(room)?.openBorder).toEqual([doorAt]);
    f.w.game.world.entities.add(door, C.Building, record);
    expect(f.b.roomDiagnostics(room)?.openBorder).toEqual([]);
  });

  it('reuses the owner picker for keyboard assignment and mouse clearing', () => {
    const f = fixture(); f.tool.selected = f.room;
    f.tool.editorKey(f.ctx, press('O', { shift: true }));
    expect(f.tool.ownerOpen).toBe(true);
    f.tool.editorKey(f.ctx, press('↓'));
    f.tool.editorKey(f.ctx, press('Enter'));
    expect(f.b.ownerOf(f.room)).toBe(f.dwarf);
    f.tool.startOwner(f.ctx);
    const s = surface(36, 40);
    drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, f.tool, f.ctx);
    click(s, 'Nobody');
    expect(f.b.ownerOf(f.room)).toBe(0);
    expect(f.sent.map((c) => c.type)).toEqual(['AssignRoom', 'AssignRoom']);
  });

  it('names the preset and focuses the full stockpile', () => {
    const f = fixture();
    f.ctx.submit({ type: 'SetStockpileFilter', zoneId: f.pile, filter: 'wood' });
    const log = new AnnouncementLog(strings, f.w.game.registry);
    log.register(f.w.game.world.registrations.announcements);
    const result = log.announce({ type: 'StockpileFull', id: f.pile }, f.w.readers, f.w.readers.calendar.tick);
    expect(result?.line.text).toBe('Stockpile #1 (Wood) is full.');
    expect(result?.focus).toBe(f.b.zone(f.pile)?.tiles[0]);
  });

  it('explains unavailable ownership and cancels the picker without commands or ticks', () => {
    const f = fixture();
    const empty = f.w.zone('bedroom', [f.w.index(50, 30, z)]);
    f.tool.selected = empty;
    f.tool.startOwner(f.ctx);
    expect(f.notices.at(-1)).toBe(strings.get('ui.zone.edit.no_bed'));
    const bed = f.w.build('bed', f.w.index(50, 30, z), 'oak');
    expect(f.b.get(bed)).toMatchObject({ state: 'built', origin: f.w.index(50, 30, z) });
    expect(f.b.roomDiagnostics(empty)?.missing).toEqual([]);
    f.tool.startOwner(f.ctx);
    expect(f.tool.ownerOpen).toBe(true);
    f.tool.cancelEditor();
    // Exercise an unavailable registration independently of normal immediate zone creation.
    const registration = f.w.game.world.entities.with(C.Room).find((id) => f.w.game.world.entities.get(id, C.Room)?.zoneId === empty)!;
    f.w.game.world.entities.remove(registration, C.Room);
    f.tool.startOwner(f.ctx);
    expect(f.notices.at(-1)).toBe(strings.get('ui.zone.edit.pending_room'));
    f.tool.selected = f.room;
    f.tool.startOwner(f.ctx);
    const hash = f.w.hash();
    expect(f.tool.cancelEditor()).toBe(true);
    expect(f.tool.ownerOpen).toBe(false);
    expect(f.sent).toEqual([]);
    expect(f.w.hash()).toBe(hash);
  });

  it('Help covers the editor actions and follows rebound accelerator letters', () => {
    const rows = helpKeyRows(keymap, strings).filter((r) => r.category === 'zones');
    expect(rows).toHaveLength(8);
    expect(rows.some((r) => r.text.startsWith('[S-p] preset'))).toBe(true);
    expect(rows.some((r) => r.text.startsWith('[S-o] bedroom owner'))).toBe(true);
    expect(rows.some((r) => r.text.includes('Space checkbox'))).toBe(true);
    const rebound = new Keymap(keymap.bindings);
    const population = rebound.bindings.findIndex((b) => b.context === 'fortress_panel' && b.id === 'population');
    expect(rebound.rebind(population, { key: 'g', ctrl: false, shift: false })).toBeNull();
    const newRows = helpKeyRows(rebound, strings).filter((r) => r.category === 'zones');
    expect(newRows.some((r) => r.text.startsWith('[p] preset'))).toBe(true);
    expect(newRows.some((r) => r.text.startsWith('[S-g] tree'))).toBe(true);
  });

  it('highlights every visible open border tile; Space and numeric controls do not change speed', () => {
    const f = fixture();
    const ui = defaultUiState(z); ui.camX = 28; ui.camY = 28;
    const speeds: number[] = [];
    const host: FortressHost = {
      readers: f.w.readers, registry: f.w.game.registry, ui, submit: f.ctx.submit,
      speed: () => 0, setSpeed: (n) => speeds.push(n), pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => f.w.game.world.registrations.panels, announcements: () => f.w.game.world.registrations.announcements, now: () => 0,
    };
    const screen = new FortressScreen(host, keymap, strings);
    screen.openPanel('zones'); ui.cursor = { x: 30, y: 30 };
    screen.key(press('Enter'));
    expect(screen.zones.selected).toBe(f.pile);
    screen.key(press('Space')); screen.key(press('q')); screen.key(press('+')); screen.key(press('Tab'));
    expect(speeds).toEqual([]);
    expect(ui.sidebar).toBe(true);
    expect(f.it.stockpile(f.pile)?.containersWanted.barrel).toBe(1);
    screen.zones.selected = f.room; ui.camX = 38;
    const hash = f.w.hash();
    const s = surface(80, 42); screen.draw(s);
    for (const tile of f.b.roomDiagnostics(f.room)!.openBorder) {
      const col = tile % f.w.map.w - ui.camX;
      const row = Math.floor(tile / f.w.map.w) % f.w.map.h - ui.camY;
      expect(s.cells.get(col, row).bg).toBe(s.theme.bad);
    }
    expect(f.w.hash()).toBe(hash);
  });
});
