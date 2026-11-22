/**
 * T-332: what the Orders, Add order, Workshop, Animals, Mood, Population and farm-plot panels say
 * for a fixed state. They were stored cell buffers (T-M4-17, U-03); each assertion now names what
 * a row means. The fortress: seed `m4-panels`, a two-tile farm plot, a maintained still order, and
 * a finished carpenter's workshop with one order for five doors.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { WorkshopsReader } from '@systems/workshops';
import { drawAnimalsPanel } from '@ui/panels/animals';
import { drawMoodPanel } from '@ui/panels/mood';
import { drawPopulationPanel } from '@ui/panels/population';
import { drawOrdersPanel, drawWorkshopPanel } from '@ui/panels/orders';
import { drawZonesPanel } from '@ui/panels/zones';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import type { Surface } from '@ui/surface';
import { fgOfText, hexOf, surface, theme } from './ui-fixture';

type PanelName = 'orders' | 'picker' | 'workshop' | 'animals' | 'wild' | 'mood' | 'population' | 'farm';
let game: Game;
let carpenter = 0;

function draw(which: PanelName): Surface {
  const s = surface(36, 32);
  const rect = { col: 0, row: 0, cols: 36, rows: 32 };
  const f = game.fortress;
  if (which === 'orders') drawOrdersPanel(s, rect, f.orders, f.ctx);
  else if (which === 'picker') {
    f.orders.openPicker(f.ctx);
    drawOrdersPanel(s, rect, f.orders, f.ctx);
    f.orders.picker.open = false;
  } else if (which === 'workshop') drawWorkshopPanel(s, rect, carpenter, f.orders, f.ctx);
  else if (which === 'animals' || which === 'wild') {
    f.animals.tab = which === 'wild' ? 1 : 0;
    drawAnimalsPanel(s, rect, f.animals, f.ctx);
  } else if (which === 'mood') drawMoodPanel(s, rect, f.mood, f.ctx);
  else if (which === 'population') drawPopulationPanel(s, rect, f.ctx);
  else drawZonesPanel(s, rect, f.zones, f.ctx);
  return s;
}

/** The panel's rows with the one-column margin and trailing blanks taken off. */
function render(which: PanelName): string[] {
  return draw(which).lines().map((line) => line.trimEnd().replace(/^ /, ''));
}

describe('T-332 panels: orders, add order, workshop, animals, mood, population and farm settings', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 'm4-panels', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const map = game.host.readers.map;
    const tiles = [map.index(40, 30, game.ui.z), map.index(41, 30, game.ui.z)];
    game.host.submit({ type: 'CreateZone', zoneType: 'farm_plot', tiles });
    game.host.step(1);
    game.fortress.zones.selected = game.host.readers.of<BuildingsReader>('14').zoneAt(tiles[0] as number);
    const recipe = game.host.readers.of<WorkshopsReader>('12').recipesFor('still')[0];
    if (recipe === undefined) throw new Error('still recipe missing');
    game.host.submit({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId: recipe.id, mode: 'maintain', threshold: 20, remaining: 1, priority: 5 } });
    game.host.step(1);
    // A finished carpenter's workshop with one order for five doors (U-03).
    const buildings = game.host.readers.of<BuildingsReader>('14');
    const system = game.host.world.scheduler.byId('14') as BuildingsSystem;
    for (let y = 12; y < map.h - 12 && carpenter === 0; y += 1) for (let x = 12; x < map.w - 12 && carpenter === 0; x += 1) {
      const origin = map.index(x, y, game.ui.z);
      if (buildings.ghost('carpenter', origin, 0).reason !== null) continue;
      if (!game.host.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'carpenter', origin, orientation: 0, materialChoice: 0 }).ok) continue;
      carpenter = system.lastPlacedBuilding;
      system.completeNow(carpenter, game.host.headless.registry.table('materials').index('oak'));
    }
    if (carpenter === 0) throw new Error('no place for the carpenter');
    game.host.step(1);
    game.host.submit({ type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_door_wood', mode: 'once', threshold: 0, remaining: 5, priority: 5 } });
    game.host.step(1);
  });

  it('Orders groups the orders by workshop, says why one waits, and shows the selected order and the standing orders', () => {
    const rows = render('orders');
    expect(rows[0]).toBe('[n] new order  all workshops');
    expect(rows[1]).toMatch(/^─+ Carpenter's workshop #\d+ ─+$/);
    expect(rows[2]).toBe('x5 Door · in progress');
    expect(rows[3]).toMatch(/^─+ Any workshop ─+$/);
    // The maintained order waits because the fortress has no still.
    expect(rows[4]).toBe('≥20 Brew drink · no still');
    // An order that cannot be made is drawn in the alert colour; one in progress is not.
    const orders = draw('orders');
    expect(fgOfText(orders, 4, '≥20')).toBe(hexOf(theme.alert));
    expect(fgOfText(orders, 2, 'x5')).not.toBe(hexOf(theme.alert));
    expect(rows.slice(19, 21).join(' ')).toBe('In progress: a dwarf is at work on it.');
    expect(rows[21]).toBe('Count [-] 5 [+] [+/-] Shift ±10');
    expect(rows[22]).toBe('[m] once  [p] priority 5');
    expect(rows[23]).toBe('[f] any material ▼');
    expect(rows[24]).toBe('[x] remove [r] repeat [S-↑↓] move');
    expect(rows[25]).toMatch(/^─+ Standing orders ─+$/);
    expect(rows.slice(26, 32)).toEqual(['[■] Harvest', '[■] Collect Products', '[■] Butcher', '[■] Haul Refuse', '[■] Rearm Traps', '[■] Melt Marked']);
  });

  it('Add order lists recipes by group, marks the ones that cannot be made with the reason, and shows the order being built', () => {
    const rows = render('picker');
    expect(rows[0]).toBe('Add order');
    expect(rows[1]).toMatch(/^Find \[ _+ \]$/);
    expect(rows[2]).toMatch(/^─+ Ammo ─+/);
    expect(rows[3]).toMatch(/^○ Arrowheads · no forge/);
    // A recipe that cannot be made is drawn dimmer than one that can.
    const picker = draw('picker');
    expect(fgOfText(picker, 4, '○ Bolts')).toBe(hexOf(theme.dim));
    expect(fgOfText(picker, 8, '• Wooden bolts')).not.toBe(hexOf(theme.dim));
    // A recipe that can be made carries no reason; one that cannot carries the missing workshop.
    expect(rows.find((row) => row.startsWith('• Wooden bolts'))).toBeDefined();
    expect(rows.find((row) => row.startsWith('• Wooden bolts'))).not.toContain('·');
    expect(rows.some((row) => row.startsWith("○ Bone arrows · no craftsdwarf's"))).toBe(true);
    expect(rows.some((row) => row.startsWith('○ Cap · no leatherworks'))).toBe(true);
    expect(rows.some((row) => row.startsWith('○ Bracers · no leatherworks'))).toBe(true);
    // A note too long for the row goes on under it rather than being cut.
    expect(rows.map((row) => row.replace(/\s*[│█]$/, '')).join('\n').replace(/\n {2}(?=\S)/g, ' ')).toContain("○ Bone arrows · no craftsdwarf's workshop");
    const cannot = rows.filter((row) => row.startsWith('○'));
    expect(cannot.length).toBeGreaterThan(8);
    for (const row of cannot) expect(row).toContain(' · ');
    expect(rows.some((row) => /^─+ Armor ─+/.test(row))).toBe(true);
    expect(rows[27]).toMatch(/^ {2}Quantity \[-\] +1 \[\+\]$/);
    expect(rows[28]).toBe('  Mode     once: make 1');
    expect(rows[29]).toBe('  Material any material');
    expect(rows[30]).toBe('  Where    any forge');
    expect(rows[31]).toBe('[Enter] add [Tab] next [Esc] back');
  });

  it('Workshop names the building and its worker, lists what it can make, and lists its own orders', () => {
    const rows = render('workshop');
    expect(rows[0]).toMatch(/^Carpenter's workshop #\d+$/);
    expect(rows[1]).toBe('Worker: any');
    expect(rows[3]).toMatch(/^─+ Recipes ─+$/);
    for (const recipe of ['Wooden bolts', 'Buckler', 'Shield', 'Barrel', 'Bin', 'Bucket', 'Bed', 'Door', 'Chair']) {
      expect(rows.some((row) => row.startsWith(`• ${recipe}`)), recipe).toBe(true);
    }
    expect(rows.some((row) => /^─+ Furniture ─+/.test(row))).toBe(true);
    expect(rows[23]).toMatch(/^─+ Orders \(1\) ─+$/);
    expect(rows[24]).toBe('x5 Door · in progress');
    expect(rows[27]).toBe('[n] new order  [o] its orders');
    expect(rows[28]).toBe('[f] material  [w] worker');
    expect(rows[29]).toBe('[S-s] suspend  [x] take apart');
  });

  it('Animals lists the tame animals the tab counts, and names the keys that manage them', () => {
    const rows = render('animals');
    expect(rows[0]).toMatch(/^\[1\] Tame \((\d+)\) {2}\[2\] Wild \(0\)$/);
    expect(rows[1]).toMatch(/^Animal +Pasture Fed Trained$/);
    const count = Number(/Tame \((\d+)\)/.exec(rows[0] ?? '')?.[1]);
    expect(count).toBe(3);
    // T-640: the two unnamed dogs are one row, by species; the glyph set draws `×` as `x`.
    const listed = rows.slice(2, 24).filter((row) => row !== '');
    expect(listed.map((row) => row.split(/ {2,}/)[0])).toEqual(['cat', 'dog x2']);
    expect(rows[24]).toBe('1 cat · no pasture');
    expect(rows[26]).toBe('[p] pasture  [S-s] slaughter');
    expect(rows[27]).toBe('[c] cap [a] assign [n] name');
    expect(rows[28]).toBe('[t] train');
    expect(rows[29]).toBe('Breeding cap: 12');
  });

  it('Wild lists no wild animals while none are in view, and offers the hunt toggle', () => {
    const rows = render('wild');
    expect(rows[0]).toMatch(/\[2\] Wild \(0\)$/);
    expect(rows[1]).toMatch(/^Species +Hunt +Doing$/);
    expect(rows.slice(2, 26).filter((row) => row !== '')).toEqual([]);
    expect(rows[27]).toBe('[h] hunt toggle');
  });

  it('Mood gives the hall spirit, the thoughts held by most, and each dwarf with its tier and its top thought', () => {
    const rows = render('mood');
    const dwarves = game.host.readers.of<{ list(): number[] }>('10').list();
    expect(rows[0]).toMatch(/^Hall spirit \S Fine \(\d+\)$/);
    // T-639: the summary, its count drawn `x` (the glyph set has no `×`).
    expect(rows[1]).toBe('Thoughts held by most');
    expect(rows[2]).toBe(' -1 The Thane sleeps in a hove» x6');
    expect(rows[3]).toMatch(/^Name +Tier$/);
    const listed = rows.slice(4, 28).filter((row) => row !== '' && !row.startsWith('  '));
    expect(listed).toHaveLength(dwarves.length);
    for (const row of listed) expect(row).toMatch(/^\S+ \S+ +Fine$/);
    // Each dwarf's whole name, and its top thought whole on the row under it.
    expect(rows[4]).toBe('Ludin Grimfell   Fine');
    expect(rows[5]).toBe('  -1 The Thane sleeps in a hovel.');
    expect(rows[28]).toMatch(/^─+$/);
    expect(rows[29]).toBe('[Enter] holders  [s] sort tier');
  });

  it('Population gives the count, the cap, the hall spirit, the next evaluation and the last wave', () => {
    const rows = render('population');
    const dwarves = game.host.readers.of<{ list(): number[] }>('10').list();
    expect(rows[0]).toBe(`${dwarves.length} dwarves (0 children)`);
    expect(rows[1]).toBe('Cap [-] 80 [+]');
    expect(rows[2]).toMatch(/^Hall spirit: Fine \(\d+\)$/);
    expect(rows[3]).toBe('Next evaluation: Summer');
    expect(rows[4]).toMatch(/^Eligible: no · hall spirit below /);
    expect(rows[5]).toBe('Last wave: none');
    expect(rows[6]).toBe('Waves so far: 0');
  });

  it('a selected farm plot shows its settings in the menu\'s place, one crop choice for each season, and the crop count of its tiles', () => {
    const rows = render('farm');
    // T-680: the settings replace the menu of kinds; [y] goes back to it.
    expect(rows[0]).toBe('[y] zones menu');
    expect(rows[1]).toMatch(/^─+ Selected: Farm plot #\d+ \(2 t\) ─+$/);
    // The highlight (►) starts on the current season; each row ends with the seeds in stock when a crop is set.
    expect(rows.slice(2, 6)).toEqual([
      '►Spring  [ none         ▼ ]',
      'Summer  [ none         ▼ ]',
      'Autumn  [ none         ▼ ]',
      'Winter  [ none         ▼ ]',
    ]);
    expect(rows[6]).toBe('Crops: 0 growing, 0 ready, 2 empty');
    expect(rows[7]).toBe('Fertilize: off (0 in stock)');
    expect(rows[8]).toBe('↑↓ season · Enter choose crop');
    expect(rows[9]).toBe('[a] all seasons');
    expect(rows[10]).toBe('[w] fertilize');
    expect(rows[31]).toBe('[x] remove zone  [e] resize');
  });
});
