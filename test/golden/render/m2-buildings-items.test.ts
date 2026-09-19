/**
 * Golden render `m2-buildings-items` (`M2-things.md` T-M2-10): the `flat-test` fortress with the
 * default embark (the wagon's pattern and the party beside it), a built carpenter's workshop, a
 * planned wall, a built bed, a door in a wall gap (closed, then locked), items on the ground (a
 * corpse over a log, a single stone), a stockpile and a bedroom zone, composed with the default
 * overlays and again with `stockpile usage` on. Covers 23 § Compositor steps 4, 5 and 8.
 */

import { describe, it, expect } from 'vitest';
import { STATUS_ROWS } from '@core/constants';
import { TileKind } from '@core/map3d';
import { LOG_ROWS } from '@render/constants';
import { OVERLAY_STOCKPILE_USAGE, type ViewState } from '@render/compositor';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';
import { asRows, compose, readGolden, updating, writeGolden } from './render-fixtures';

const NAME = 'm2-buildings-items';
const COLS = 28;
const ROWS = 14 + LOG_ROWS + STATUS_ROWS;

function scene(): { w: TestWorld; camX: number; camY: number } {
  const w = new TestWorld({ seed: 'm2-buildings-items', world: 'flat-test', embark: 'default' });
  const wagon = w.game.arrival?.wagon;
  if (wagon === undefined) throw new Error('no arrival');
  const z = FLAT_TEST_SURFACE_Z;
  const x0 = wagon.x + 4;
  const y0 = wagon.y + 3;
  w.build('carpenter', w.index(x0, y0, z), 'oak');
  w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'wall', origin: w.index(x0 + 4, y0, z), materialChoice: 'granite' });
  w.build('bed', w.index(x0 + 6, y0, z), 'oak');
  const granite = w.game.registry.table('materials').index('granite');
  w.game.world.services.terrain.setKind(w.index(x0 + 7, y0 + 3, z), TileKind.Wall, granite);
  w.game.world.services.terrain.setKind(w.index(x0 + 9, y0 + 3, z), TileKind.Wall, granite);
  w.build('door', w.index(x0 + 8, y0 + 3, z), 'oak');
  w.spawnItem('log', 'oak', w.index(x0 + 1, y0 + 5, z));
  w.spawnItem('corpse', 'granite', w.index(x0 + 1, y0 + 5, z));
  w.spawnItem('raw_stone', 'granite', w.index(x0 + 3, y0 + 5, z));
  const pile = w.zone('stockpile', rect(w, x0, y0 + 7, z, 3, 2));
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'stone' });
  w.zone('bedroom', rect(w, x0 + 5, y0 + 7, z, 2, 2));
  w.step(1);
  return { w, camX: wagon.x - 4, camY: Math.max(0, wagon.y - 2) };
}

function view(camX: number, camY: number, overlays?: string[]): ViewState {
  const base = { camX, camY, z: FLAT_TEST_SURFACE_Z, sidebarOpen: false, cursor: null };
  return overlays === undefined ? base : { ...base, overlays };
}

describe('T-M2-10 golden: m2-buildings-items', () => {
  it('matches test/golden/render/m2-buildings-items.json', () => {
    const { w, camX, camY } = scene();
    const plain = asRows(compose(w.readers, view(camX, camY), COLS, ROWS));
    const door = w.readers.of<{ byType(t: string): number[] }>('14').byType('door')[0] as number;
    w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' });
    const locked = asRows(compose(w.readers, view(camX, camY, ['designations', 'zones', OVERLAY_STOCKPILE_USAGE]), COLS, ROWS));
    const cells = [...plain, ...locked];
    if (updating(NAME)) {
      writeGolden(NAME, { $note: `npm run golden:update -- render/${NAME}; two views stacked: default overlays; the door locked with stockpile usage on`, view: { seed: 'm2-buildings-items', camX, camY, z: FLAT_TEST_SURFACE_Z, cols: COLS, rows: ROWS }, cells });
    }
    const golden = readGolden(NAME);
    expect(golden).not.toBeNull();
    expect(cells).toEqual(golden?.cells);
  });
});
