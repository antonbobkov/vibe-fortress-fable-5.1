/**
 * T-658: the Military panel's `[w] weapon` list says which of a row's free weapons are training
 * weapons (wooden, 16 § Training), as it says which are tools, so a spare training sword no longer
 * reads as a plain `sword (1, current)` while the stock line under the armed line says
 * "No sword in stock" (T-654).
 *
 * The fortress: seed `t658-wood`, the default embark (its axe and picks are tools, its crossbow a
 * launcher), a squad of three on Train preferring swords, with a spare oak training sword in stock.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat';
import { drawMilitaryPanel } from '@ui/panels/military';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { surface } from './ui-fixture';

let game: Game;
let members: EntityId[] = [];

const ROWS = 48;

const index = (table: string, id: string): number => game.fortress.ctx.registry.table(table).index(id);

/** An item made on the first member's tile. */
function spawn(type: string, material: string): EntityId {
  const pos = game.host.readers.entities.get(members[0] as EntityId, C.Position);
  if (pos === undefined) throw new Error('no position');
  return game.host.world.services.spawn.item(index('items', type), index('materials', material), game.host.readers.map.index(pos.x, pos.y, pos.z), 1, 1);
}

/** The weapon list's rows, trimmed. */
function openWeapons(): string[] {
  game.fortress.military.openChoice(game.fortress.ctx, 'weapon');
  const s = surface(36, ROWS);
  drawMilitaryPanel(s, { col: 0, row: 0, cols: 36, rows: ROWS }, game.fortress.military, game.fortress.ctx);
  game.fortress.military.memberChoice = null;
  return s.lines().map((line) => line.trim());
}

describe('T-658 the weapon list says which weapons are wooden', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 't658-wood', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    game.host.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    game.host.step(1);
    const squadId = game.host.readers.of<CombatReader>('16').squads()[0]?.id ?? 0;
    members = game.host.readers.of<{ list(): number[] }>('10').list().slice(0, 3);
    game.host.submit({ type: 'SetSquadMembers', squadId, members });
    game.host.submit({ type: 'SetSquadMode', squadId, mode: 'train' });
    const squad = game.host.readers.of<CombatReader>('16').squad(squadId);
    game.host.submit({ type: 'SetSquadEquipment', squadId, equipment: { ...squad?.equipment, weaponClass: 'sword' } });
    game.host.step(1);
    // The test steps no further, so no member claims the sword.
    spawn('training_sword', 'oak');
  });

  it('a spare training sword with no real one reads as one wooden sword', () => {
    const weapons = openWeapons();
    expect(weapons).toContain('sword (1, wooden, current)');
    // The `any` row has both notes: the embark's axe and two picks, and the training sword.
    expect(weapons).toContain('any (4, 3 tools, one wooden)');
  });

  it('with an iron short sword added, the row counts two, one wooden', () => {
    spawn('short_sword', 'iron');
    const weapons = openWeapons();
    expect(weapons).toContain('sword (2, one wooden, current)');
    expect(weapons).toContain('any (5, 3 tools, one wooden)');
  });
});
