/** T-M6-17: a raid view with combat layers and its optional squad station overlay. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { LOG_ROWS } from '@render/constants';
import { OVERLAY_SQUAD_STATIONS, type ViewState } from '@render/compositor';
import { STATUS_ROWS } from '@core/constants';
import { TestWorld } from '../../scenarios/test-world';
import { BuildingsSystem } from '@systems/buildings';
import { asRows, compose, readGolden, updating, writeGolden } from './render-fixtures';

const NAME = 'm6-raid';
const Z = FLAT_TEST_SURFACE_Z;
const X = 20;
const Y = 20;
const COLS = 12;
const ROWS = 8 + LOG_ROWS + STATUS_ROWS;

function scene(): TestWorld {
  const w = new TestWorld({ seed: NAME, world: 'flat-test', embark: 'none', startTick: 8 * 50 });
  const at = (dx: number, dy: number): number => w.index(X + dx, Y + dy, Z);
  const dwarf = w.spawnDwarf({ at: at(2, 2) });
  const enemy = w.spawnCreature('gloam_warrior', at(5, 2), 'hostile:gloam');
  w.game.world.entities.add(enemy, C.Hostile, {
    partyId: 0, role: 'warrior', behaviorState: 'attack', stealthed: false,
    spotted: true, breakingDoorId: 0, breakingSince: 0,
  });
  const hidden = w.spawnCreature('gloam_warrior', at(6, 2), 'hostile:gloam');
  w.game.world.entities.add(hidden, C.Hostile, {
    partyId: 0, role: 'thief', behaviorState: 'sneak', stealthed: true,
    spotted: false, breakingDoorId: 0, breakingSince: 0,
  });
  w.map.setFlag(at(4, 3), TileFlag.Web, true);
  w.build('stone_fall_trap', at(6, 4), 'granite');
  const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'drawbridge',
    origin: at(3, 4), width: 2, height: 1, orientation: 0, materialChoice: 'oak' });
  if (!placed.ok) throw new Error(`bridge: ${placed.reason}`);
  (w.game.world.scheduler.byId('14') as BuildingsSystem).completeNow(
    (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding,
    w.game.registry.table('materials').index('oak'),
  );
  const projectile = w.game.world.entities.create('projectile');
  w.game.world.entities.add(projectile, C.Projectile, {
    itemId: 0, from: at(3, 2), to: at(5, 2), progress: 1,
    shooterId: dwarf, targetId: enemy, hitRoll: 1, damage: 4, damageType: 'pierce', line: [at(4, 2), at(5, 2)],
  });
  w.game.world.entities.add(projectile, C.Position, { x: X + 4, y: Y + 2, z: Z });
  const squad = w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate' });
  if (!squad.ok) throw new Error(String(squad.reason));
  const id = w.readers.of<{ squads(): readonly { id: number }[] }>('16').squads()[0]?.id;
  if (id === undefined) throw new Error('no squad');
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: id, tile: at(3, 3) });
  w.game.world.applyCommand({ type: 'SetSquadPatrol', squadId: id, tiles: [at(4, 3), at(5, 3)] });
  return w;
}

function view(overlays?: string[]): ViewState {
  return { camX: X, camY: Y, z: Z, sidebarOpen: false, cursor: null, animFrame: 0, ...(overlays === undefined ? {} : { overlays }) };
}

describe('T-M6-17 golden: m6-raid', () => {
  it('matches raid, squad station overlay and unconscious blink cells', () => {
    const w = scene();
    const dwarf = w.readers.entities.with(C.Brain)[0];
    if (dwarf === undefined) throw new Error('no dwarf');
    const normal = asRows(compose(w.readers, view(), COLS, ROWS));
    const stations = asRows(compose(w.readers, view(['zones', OVERLAY_SQUAD_STATIONS]), COLS, ROWS));
    const body = w.game.world.entities.get(dwarf, C.Body);
    if (body === undefined) throw new Error('no body');
    body.conscious = false;
    const blink = asRows(compose(w.readers, { ...view(), animFrame: 2 }, COLS, ROWS));
    const cells = [...normal, ...stations, ...blink];
    if (updating(NAME)) writeGolden(NAME, {
      $note: 'npm run golden:update -- render/m6-raid; normal, squad stations, unconscious blink views stacked',
      view: { seed: NAME, camX: X, camY: Y, z: Z, cols: COLS, rows: ROWS }, cells,
    });
    expect(cells).toEqual(readGolden(NAME)?.cells);
  });
});
