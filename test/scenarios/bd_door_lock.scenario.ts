/**
 * `bd_door_lock` of `04-implementation/acceptance-tests.md` § 14 Buildings: "locked door between a
 * dwarf and a stockpile | job `unreachable`; unlock resolves".
 *
 * A walled pen on the `flat-test` surface holds a stone stockpile; its one gap is a built door,
 * locked through `SetDoorMode`. A stone outside wants hauling into it: the haul job blocks
 * `unreachable`; `SetDoorMode open` lets the periodic retry reopen it and the stone is stored.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { BLOCKED_RETRY_TICKS } from '@systems/jobs/constants';
import type { Scenario } from './runner';
import { rect } from './m1-helpers';

const X0 = 60;
const Y0 = 30;
const SIZE = 7;
const Z = 32;
let door: EntityId = 0;
let pile: EntityId = 0;
let stone: EntityId = 0;

const scenario: Scenario = {
  id: 'bd_door_lock',
  milestone: 2,
  seed: 'bd-door-lock',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    const terrain = w.game.world.services.terrain;
    const granite = w.game.registry.table('materials').index('granite');
    for (let k = 0; k < SIZE; k += 1) {
      for (const [x, y] of [
        [X0 + k, Y0],
        [X0 + k, Y0 + SIZE - 1],
        [X0, Y0 + k],
        [X0 + SIZE - 1, Y0 + k],
      ] as const) {
        terrain.setKind(w.index(x, y, Z), TileKind.Wall, granite);
      }
    }
    const gate = w.index(X0 + 3, Y0, Z);
    terrain.setKind(gate, TileKind.Floor, granite);
    door = w.build('door', gate, 'oak');
    const r = w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' });
    if (!r.ok) throw new Error(`lock: ${r.reason}`);
    pile = w.zone('stockpile', rect(w, X0 + 2, Y0 + 2, Z, 3, 3));
    const f = w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'stone' });
    if (!f.ok) throw new Error(`filter: ${f.reason}`);
    stone = w.spawnItem('raw_stone', 'granite', w.index(50, 20, Z));
  },
  run: (w) => {
    const items = w.readers.of<ItemsReader>('13');
    w.until((x) => x.events('JobBlocked').some((e) => e['jobType'] === 'haul_to_stockpile'), 200);
    expect(w.events('JobBlocked').filter((e) => e['jobType'] === 'haul_to_stockpile')[0]).toMatchObject({ reason: 'unreachable' });
    w.step(50);
    expect(items.stockpileAt(items.tileOf(stone))).toBe(0);
    // Unlock.
    const r = w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'open' });
    expect(r).toEqual({ ok: true });
    const spent = w.until((x) => x.events('JobUnblocked').some((e) => e['jobType'] === 'haul_to_stockpile'), BLOCKED_RETRY_TICKS + 1);
    expect(spent).toBeLessThanOrEqual(BLOCKED_RETRY_TICKS);
    w.until(() => items.stockpileAt(items.tileOf(stone)) === pile, 1_500);
  },
};

export default scenario;
