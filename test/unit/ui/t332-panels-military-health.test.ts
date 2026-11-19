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
import type { Surface } from '@ui/surface';
import { fgOfText, hexOf, surface, theme } from './ui-fixture';

type PanelName = 'military' | 'threats' | 'hospital' | 'look' | 'combat_log';
let game: Game;
let patientName = '';

function draw(which: PanelName): Surface {
  const s = surface(36, 32);
  const rect = { col: 0, row: 0, cols: 36, rows: 32 };
  const f = game.fortress;
  if (which === 'military') drawMilitaryPanel(s, rect, f.military, f.ctx);
  else if (which === 'threats') drawThreatsPanel(s, rect, f.threats, f.ctx);
  else if (which === 'hospital') drawZonesPanel(s, rect, f.zones, f.ctx);
  else if (which === 'look') drawLookPanel(s, rect, f.ctx.readers, f.ctx.registry, f.ctx.strings, f.lookTile(), 2);
  else drawLogPanel(s, rect, f.log.lines, 2, f.ctx.strings, f.ctx.readers.calendar.tick, () => {});
  return s;
}

function render(which: PanelName): string[] {
  return draw(which).lines().map((line) => line.trimEnd().replace(/^ /, ''));
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
    expect(rows[9]?.trim()).toBe('[S-l] pick  [S-n] rename');
    expect(rows[10]).toBe('Mode: train');
    expect(rows[11]).toBe('[S-o] Off [S-t] Train [v] Active');
    expect(rows[12]).toMatch(/^Members \S+ \S+\.$/);
    expect(rows[13]?.trim()).toBe('[S-a] add  [r] remove');
    // The member holds nothing, and the stock has no weapon but the tools the workers need.
    expect(rows[14]).toMatch(/^Armed 0 of 1 · unarmed: \S+ \S+\.$/);
    expect(rows[15]).toBe('No weapon in stock: order one [o]');
    expect(rows[16]).toBe('  or buy one.');
    expect(rows[17]).toBe('Gear [w] weapon [any ▼]');
    expect(rows[18]?.trim()).toBe('[g] armor [any ▼]');
    expect(rows[19]?.trim()).toBe('[S-j] ranged');
    expect(rows[20]?.trim()).toBe('[S-d] draughts: none');
    expect(rows[21]).toBe('Station none');
    expect(rows[22]?.trim()).toBe('[S-s] set  [S-c] clear');
    expect(rows[23]).toBe('Patrol none [S-p] add [y] clear');
    expect(rows[24]).toBe('Orders [S-k] kill [S-f] follow');
    expect(rows[25]?.trim()).toBe('[q] cancel orders');
    // On Train with no barracks the row says the squad cannot train (T-624).
    expect(rows[26]).toBe('No barracks: the squad cannot');
    expect(rows[27]?.trim()).toBe('train. [z] Barracks, then [S-b].');
  });

  it('Threats gives peril and renown, the active threats, the next arrivals and the state of each cavern', () => {
    const rows = render('threats');
    expect(rows[0]).toMatch(/^Peril \d+ · Renown \d+(\.\d+)?$/);
    expect(rows[1]).toBe('Wealth and population draw attent»');
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
    expect(rows[3]).toBe('tiles 0 walls 0 furn. 0 size 2');
    expect(rows[4]).toMatch(/^Not enclosed: \d+ open border tiles$/);
    expect(rows[5]).toBe('Needs a bed');
    expect(rows[6]).toBe('Needs a chest');
    // What is missing is drawn in the warning colour, not the plain text colour.
    const s = draw('hospital');
    expect(fgOfText(s, 5, 'Needs a bed')).toBe(hexOf(theme.bad));
    expect(fgOfText(s, 6, 'Needs a chest')).toBe(hexOf(theme.bad));
    expect(fgOfText(s, 2, 'Room:')).not.toBe(hexOf(theme.bad));
    expect(rows[7]).toBe('Beds: 0  Traction: 0  Chests: 0');
    expect(rows[8]).toBe('Supplies (current / wanted):');
    expect(rows.slice(9, 17).map((row) => row.replace(/ +\[-\]\[\+\]$/, ''))).toEqual([
      'Cloth: 0/10', 'Thread: 0/5', 'Splints: 0/4', 'Crutches: 0/2', 'Brightleaf: 0/6', 'Buckets: 0/2', 'Honey: 0/0', 'Soap: 0/0',
    ]);
    for (const row of rows.slice(9, 17)) expect(row).toMatch(/\[-\]\[\+\]$/);
    expect(rows[17]).toBe('Patients:');
    expect(rows[18]).toContain(`${patientName}: suture`);
    expect(rows[31]).toBe('[x] remove zone  [S-e] resize');
  });

  it('Look names the creature, its activity, needs, skills, mood, blood and pain, the missing care, and every body part', () => {
    const rows = render('look');
    expect(rows[0]).toMatch(/^Look · \(\d+, \d+, z32\)$/);
    expect(rows[1]).toBe('[1]Tile [2]Items 0 [3]Who 1');
    expect(patientName).toMatch(/^\S+ \S+$/);
    // The identity line: the profession of the best skill, the age and the squad.
    expect(rows[3]).toBe('Miner · adult · The Hearthguard');
    expect(rows[4]).toBe('Activity: Resting in hospital');
    expect(rows[5]).toBe('Needs');
    expect(rows.slice(6, 10)).toEqual([
      'hunger  ░░░░  20 thirst  ░░░░  20', 'rest    ░░░░  20 social  ░░░░  20', 'comfort ░░░░  20 purpose ░░░░  20', 'joy     ░░░░  20',
    ]);
    expect(rows[10]).toBe('Skills');
    // Each skill has its progress to the next level as a bar.
    expect(rows.slice(11, 14)).toEqual(['  Axe 2 (Novice) ░░░░░', '  Building 3 (Novice) ░░░░░', '  Mining 5 (Adequate) ░░░░░']);
    expect(rows[14]).toMatch(/^Mood: Fine \(\d+\)$/);
    expect(rows[16]).toMatch(/^Health: Blood 100%, Pain \d+$/);
    expect(rows[17]).toBe('Care: no free hospital bed.');
    expect(rows[18]).toBe('  Conscious');
    expect(rows[19]).toMatch(/^ {2}head ▓+ 30\/30 hp$/);
    expect(rows[20]).toMatch(/^ {2}torso ▓+ 60\/60 hp$/);
    expect(rows[21]).toMatch(/^ {2}left arm ▓+ 36\/36 hp$/);
    // The wound is listed under the part it is on, with its dressing and its infection.
    expect(rows[22]).toBe('    serious cut (bandaged, infect»');
  });

  it('the combat log names the tabs and shows the first attack of the engagement with its sender, damage and kind', () => {
    const rows = render('combat_log');
    expect(rows[0]).toBe('[1] All  [2] Alerts  [3] Combat');
    expect(rows[2]).toMatch(/^Sp 1 ! \S+ hits \S+: 5 edge\.$/);
    // The first attack of an engagement is an alert line: its mark is in the alert colour.
    expect(fgOfText(draw('combat_log'), 2, '! ')).toBe(hexOf(theme.alert));
  });
});
