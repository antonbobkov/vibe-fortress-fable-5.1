/**
 * `tr_deepsilver_gate` of `04-implementation/acceptance-tests.md` § 03 Terrain: "designate a
 * deepsilver tile before confirmation | rejected `deepsilver_unconfirmed`; after
 * `ConfirmDeepsilver`, accepted; `DeepsilverMined` on completion".
 *
 * A seen deepsilver wall stands in the `flat-test` surface (laid through 03's terrain API); one
 * miner digs it once the designation is accepted (T-M1-10).
 */

import { expect } from 'vitest';
import { LOCAL_MAP_H, LOCAL_MAP_W } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { TerrainReader } from '@systems/terrain';
import type { Scenario } from './runner';
import { onlyMiner } from './m1-helpers';

const X = 30;
const Y = 30;
const Z = 32;
const TILE = (Z * LOCAL_MAP_H + Y) * LOCAL_MAP_W + X;

const scenario: Scenario = {
  id: 'tr_deepsilver_gate',
  milestone: 1,
  seed: 'tr-deepsilver-gate',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    onlyMiner(w);
    const ore = w.game.registry.table('materials').index('deepsilver_ore');
    const i = w.index(X, Y, Z);
    w.game.world.services.terrain.setKind(i, TileKind.Wall, ore);
    w.game.world.services.terrain.setFlag(i, TileFlag.Discovered, true);
  },
  commands: [
    { tick: 0, command: { type: 'Designate', tiles: [TILE], kind: 'dig', priority: 4 } },
    { tick: 1, command: { type: 'ConfirmDeepsilver' } },
    { tick: 2, command: { type: 'Designate', tiles: [TILE], kind: 'dig', priority: 4 } },
  ],
  run: (w) => {
    w.step(4);
    const tile = w.index(X, Y, Z);
    expect(w.readers.of<TerrainReader>('03').designationAt(tile)?.priority).toBe(4);
    w.until((world) => world.events('DeepsilverMined').length > 0, 2_000);
  },
  expect: (w) => {
    const tile = w.index(X, Y, Z);
    const log = w.game.world.commandLog.all();
    expect(log.map((e) => e.result)).toEqual([{ ok: false, reason: 'deepsilver_unconfirmed' }, { ok: true }, { ok: true }]);
    expect(w.events('CommandRejected').map((e) => e['reason'])).toEqual(['deepsilver_unconfirmed']);
    expect(w.game.world.fortress.deepsilverConfirmed).toBe(true);
    const mined = w.events('DeepsilverMined');
    expect(mined).toHaveLength(1);
    expect(mined[0]).toMatchObject({ tile, minerId: w.game.arrival?.dwarves[0] });
    expect(w.map.kindAt(tile)).toBe(TileKind.Floor);
    expect(w.readers.of<TerrainReader>('03').designationAt(tile)).toBeNull();
    // Deepsilver is an ore: it is always kept, and mining it is a mineral find.
    expect(w.events('MineralMined').map((e) => e['material'])).toEqual(['deepsilver_ore']);
    expect(w.events('VeinFound')).toHaveLength(1);
  },
};

export default scenario;
