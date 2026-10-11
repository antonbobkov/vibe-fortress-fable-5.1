/** T-M6-16: fixed 36-cell buffers for the M6 fortress panels. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
import { MockCanvas, mockCanvasFactory } from '../../unit/render/canvas-mock';
import { cellRows, surface } from '../../unit/ui/ui-fixture';

const name = 'render/m6-panels';
const file = fileURLToPath(new URL('./m6-panels.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === name || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';
const names = ['military', 'threats', 'hospital', 'look', 'combat_log'] as const;
type PanelName = typeof names[number];
interface PanelGolden { text: string[]; cells: string[][] }
let game: Game;
let golden: Record<string, PanelGolden> = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { panels: Record<string, PanelGolden> }).panels : {};

function render(which: PanelName): PanelGolden {
  const s = surface(36, 32);
  const rect = { col: 0, row: 0, cols: 36, rows: 32 };
  const f = game.fortress;
  if (which === 'military') drawMilitaryPanel(s, rect, f.military, f.ctx);
  else if (which === 'threats') drawThreatsPanel(s, rect, f.threats, f.ctx);
  else if (which === 'hospital') drawZonesPanel(s, rect, f.zones, f.ctx);
  else if (which === 'look') drawLookPanel(s, rect, f.ctx.readers, f.ctx.registry, f.ctx.strings, f.lookTile(), 2);
  else if (which === 'combat_log') drawLogPanel(s, rect, f.log.lines, 2, f.ctx.strings, () => {});
  return { text: s.lines(), cells: cellRows(s) };
}

describe('T-M6-16 golden: military, threats, hospital, creature health, and combat log', () => {
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

    if (update) {
      const next: Record<string, PanelGolden> = {};
      for (const panel of names) next[panel] = render(panel);
      writeFileSync(file, `${JSON.stringify({ $note: 'npm run golden:update -- render/m6-panels', panels: next }, null, 2)}\n`, 'utf8');
      golden = next;
    }
  });

  for (const panel of names) it(`${panel} matches its cell buffer`, () => {
    expect(golden[panel]).toBeDefined();
    expect(render(panel)).toEqual(golden[panel]);
  });
});
