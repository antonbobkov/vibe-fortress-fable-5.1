/**
 * T-332: what the Military, Threats, hospital Zones, Look and combat Log panels say for a fixed
 * state. They were stored cell buffers (T-M6-16); each assertion now names what a row means. The
 * fortress: seed `m6-panels`, a squad of one in training, a two-tile hospital zone, one admitted
 * patient with an infected, bandaged cut, and the first attack of an engagement in the log.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { C } from '@core/components';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import { drawMilitaryPanel } from '@ui/panels/military';
import { drawThreatsPanel } from '@ui/panels/threats';
import { drawZonesPanel } from '@ui/panels/zones';
import { drawLookPanel } from '@ui/panels/look';
import { drawLogPanel } from '@ui/panels/log';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { surface } from './ui-fixture';

type PanelName = 'military' | 'threats' | 'hospital' | 'look' | 'combat_log';
let game: Game;
let patientName = '';

function render(which: PanelName): string[] {
  const s = surface(36, 32);
  const rect = { col: 0, row: 0, cols: 36, rows: 32 };
  const f = game.fortress;
  if (which === 'military') drawMilitaryPanel(s, rect, f.military, f.ctx);
  else if (which === 'threats') drawThreatsPanel(s, rect, f.threats, f.ctx);
  else if (which === 'hospital') drawZonesPanel(s, rect, f.zones, f.ctx);
  else if (which === 'look') drawLookPanel(s, rect, f.ctx.readers, f.ctx.registry, f.ctx.strings, f.lookTile(), 2);
  else drawLogPanel(s, rect, f.log.lines, 2, f.ctx.strings, f.ctx.readers.calendar.tick, () => {});
  return s.lines().map((line) => line.trimEnd().replace(/^ /, ''));
}

describe('T-332 panels: military, threats, hospital, creature health, and combat log', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 'm6-panels', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const map = game.host.readers.map;
    const z = game.ui.z;

    // 1. Create a squad with member and training mode
    game.host.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    game.host.step(1);
    const squadId = game.host.readers.of<CombatReader>('16').squads()[0]?.id ?? 0;
    const dwarves = game.host.readers.of<{ list(): number[] }>('10').list();
    const dwarfId = dwarves[0] ?? 0;
    if (dwarfId !== 0 && squadId !== 0) {
      game.host.submit({ type: 'SetSquadMembers', squadId, members: [dwarfId] });
      game.host.submit({ type: 'SetSquadMode', squadId, mode: 'train' });
    }

    // 2. Create hospital zone
    const hospTiles = [map.index(40, 31, z), map.index(41, 31, z)];
    game.host.submit({ type: 'CreateZone', zoneType: 'hospital', tiles: hospTiles });
    game.host.step(1);
    const hospZoneId = game.host.readers.of<BuildingsReader>('14').zoneAt(hospTiles[0] as number);
    game.fortress.zones.selected = hospZoneId;

    // 3. Add wound and make patient for look panel
    if (dwarfId !== 0) {
      const body = game.host.world.entities.get(dwarfId, C.Body);
      if (body) {
        body.parts[2]!.wounds.push({
          type: 'cut',
          severity: 'serious',
          bleed: 0,
          pain: 10,
          healRemaining: 2000,
          damage: 10,
          bandaged: true,
          sutured: false,
          splinted: false,
          cleaned: false,
          dressed: false,
          // A bandaged, low-pain cut stays admitted because it still needs infection care.
          infected: true,
          infectedSince: 0,
          createdTick: 0,
        });
        body.diagnosed = true;
      }
      game.host.world.entities.add(dwarfId, C.Patient, { hospitalZoneId: hospZoneId, bedId: 0, needs: ['rest'], admittedTick: 0 });
      const dwarfPos = game.host.readers.entities.get(dwarfId, C.Position);
      if (dwarfPos) {
        game.fortress.lookTile = () => map.index(dwarfPos.x, dwarfPos.y, dwarfPos.z);
      }
    }

    // 4. Add the first attack of an engagement to the combat tab.
    game.host.world.emit({
      type: 'AttackResolved',
      attackerId: dwarfId,
      defenderId: dwarves[1] ?? dwarfId,
      part: 'head',
      damageType: 'edge',
      amount: 5,
      outcome: 'hit',
    });
    game.host.step(1);
    const look = render('look');
    patientName = /^─+ Creature: (.+?) ─+$/.exec(look[2] ?? '')?.[1] ?? '';
  });

  it('Military shows the alert and what it means, the squad table, and the selected squad with its mode, members, gear and orders', () => {
    const rows = render('military');
    expect(rows[0]).toBe('Alert: Calm');
    expect(rows[1]).toBe('[1] Calm  [2] Watch  [3] Hearth');
    expect(rows[2]).toBe('Calm: everyone works.');
    expect(rows[4]).toMatch(/^Squad +Size +Mode$/);
    expect(rows[5]).toMatch(/^The Hearthguard +1\/6 +train$/);
    expect(rows[6]).toBe('[+] new squad  [x] disband');
    expect(rows[7]).toMatch(/^─+ The Hearthguard ─+$/);
    expect(rows[8]).toBe('Leader  none');
    expect(rows[10]).toBe('Mode: train');
    expect(rows[11]).toBe('[S-o] Off [S-t] Train [v] Active');
    expect(rows[12]).toMatch(/^Members \S+ \S+\.$/);
    expect(rows[14]).toBe('Gear [w] weapon [any ▼]');
    expect(rows[17]).toBe('Station none');
    expect(rows[19]).toBe('Patrol none [S-p] add [y] clear');
    expect(rows[20]).toBe('Orders [S-k] kill [S-f] follow');
    expect(rows[22]).toBe('No barracks  [S-b] assign');
  });

  it('Threats gives peril and renown, the active threats, the next arrivals and the state of each cavern', () => {
    const rows = render('threats');
    expect(rows[0]).toMatch(/^Peril \d+ · Renown \d+(\.\d+)?$/);
    expect(rows[1]).toMatch(/^Wealth and population draw attenti/);
    expect(rows[2]).toBe('Active: none');
    expect(rows[3]).toMatch(/^Thieves from (Spring|Summer|Autumn|Winter), Y\d+$/);
    expect(rows[4]).toMatch(/^─+ Caverns ─+$/);
    expect(rows.slice(5, 8)).toEqual(['1: sealed', '2: sealed', '3: sealed']);
  });

  it('a selected hospital zone says what its room lacks and who is admitted', () => {
    const rows = render('hospital');
    expect(rows[0]).toBe('[y] zone types');
    expect(rows[1]).toMatch(/^─+ Selected: Hospital #\d+ \(2 t\) ─+$/);
    expect(rows[2]).toMatch(/^Room: Bare \(score \d+\)$/);
    expect(rows[4]).toMatch(/^Not enclosed: \d+ open border tiles$/);
    expect(rows[5]).toBe('Needs a bed');
    expect(rows[6]).toBe('Needs a chest');
    expect(rows[7]).toBe('Beds: 0  Traction: 0  Chests: 0');
    expect(rows[8]).toBe('Supplies (current / wanted):');
    expect(rows.slice(9, 15).map((row) => row.replace(/ +\[-\]\[\+\]$/, ''))).toEqual([
      'Cloth: 0/10', 'Thread: 0/5', 'Splints: 0/4', 'Crutches: 0/2', 'Brightleaf: 0/6', 'Buckets: 0/2',
    ]);
    for (const row of rows.slice(9, 15)) expect(row).toMatch(/\[-\]\[\+\]$/);
    expect(rows[15]).toBe('Patients:');
    expect(rows[16]).toContain(`${patientName}: suture`);
    expect(rows[31]).toBe('[x] remove zone  [S-e] resize');
  });

  it('Look names the creature, its activity, skills, mood, blood and pain, the missing care, and every body part', () => {
    const rows = render('look');
    expect(rows[0]).toMatch(/^Look · \(\d+, \d+, z32\)$/);
    expect(rows[1]).toMatch(/^Tabs: \[1\]Tile \[2\]Items\(0\) \[3\]Creat/);
    expect(patientName).toMatch(/^\S+ \S+$/);
    expect(rows[3]).toBe('Activity: Resting in hospital');
    expect(rows[4]).toBe('Skills');
    expect(rows[5]).toMatch(/^ {2}\w[\w ]* \d+ \(\w+\)$/);
    expect(rows[8]).toMatch(/^Mood: Fine \(\d+\)$/);
    expect(rows[10]).toMatch(/^Health: Blood 100%, Pain \d+$/);
    expect(rows[11]).toBe('Care: no free hospital bed.');
    expect(rows[12]).toBe('  Conscious');
    expect(rows[13]).toMatch(/^ {2}head ▓+ 30\/30 hp$/);
    expect(rows[14]).toMatch(/^ {2}torso ▓+ 60\/60 hp$/);
    expect(rows[15]).toMatch(/^ {2}left arm ▓+ 36\/36 hp$/);
    // The wound is listed under the part it is on, with its dressing and its infection.
    expect(rows[16]).toMatch(/^ {4}serious cut \(bandaged, infecte/);
  });

  it('the combat log names the tabs and shows the first attack of the engagement with its sender, damage and kind', () => {
    const rows = render('combat_log');
    expect(rows[0]).toBe('[1] All  [2] Alerts  [3] Combat');
    expect(rows[2]).toMatch(/^Sp 1 ! \S+ hits \S+: 5 edge\.$/);
  });
});
