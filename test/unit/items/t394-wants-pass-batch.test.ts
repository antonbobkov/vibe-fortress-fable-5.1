import { describe, it, expect } from 'vitest';
import { ItemFlag } from '@core/components';
import type { ItemsSystem } from '@systems/items';
import { sortedInsert, sortedMerge } from '@systems/items/state';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';

const Z = 32;

function sys(w: TestWorld): ItemsSystem {
  return w.game.world.scheduler.byId('13') as unknown as ItemsSystem;
}

/** Counts the `splice` calls an array receives from now on. */
function countSplices(list: number[]): { readonly calls: () => number } {
  let n = 0;
  const splice = list.splice.bind(list) as (...args: number[]) => number[];
  Object.defineProperty(list, 'splice', {
    enumerable: false,
    value: (...args: number[]) => {
      n += 1;
      return splice(...args);
    },
  });
  return { calls: () => n };
}

describe('T-394 the pass over the wants set does not splice per item', () => {
  it('sortedMerge is the repeated sortedInsert', () => {
    const cases: [number[], number[]][] = [
      [[], []], [[], [3, 5]], [[1, 2], []], [[1, 2], [3, 4]], [[3, 4], [1, 2]], [[1, 3, 5], [2, 3, 6]], [[2, 4], [2, 4]], [[1, 9], [2, 3, 4, 10]],
    ];
    for (const [a, b] of cases) {
      const expected = a.slice();
      for (const v of b) sortedInsert(expected, v);
      const merged = a.slice();
      sortedMerge(merged, b);
      expect(merged).toEqual(expected);
    }
  });

  it('items with no home leave wants and join noHome in ascending order, with no splice, and return the same way', () => {
    const w = new TestWorld({ seed: 'wants-batch', world: 'flat-test' });
    const h = sys(w).hauling;
    const logs: number[] = [];
    for (let k = 0; k < 300; k += 1) logs.push(w.spawnItem('log', 'oak', w.index(30 + (k % 20), 30 + Math.floor(k / 20), Z)));
    expect(h.wants).toEqual(logs);
    const onWants = countSplices(h.wants);
    const onNoHome = countSplices(h.noHome);
    w.step(10);
    expect(h.wants).toEqual([]);
    expect(h.noHome).toEqual(logs);
    expect(onWants.calls()).toBe(0);
    expect(onNoHome.calls()).toBe(0);
    // A stockpile that takes wood: the whole set returns to wants in one step, in order.
    const sp = w.zone('stockpile', rect(w, 10, 10, Z, 2, 2));
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: sp, filter: 'wood' } as never);
    expect(h.noHome).toEqual([]);
    expect(h.wants).toEqual(logs);
    expect(onWants.calls()).toBe(0);
    expect(onNoHome.calls()).toBe(0);
  });

  it('a pass settles into the arrays what it holds back: items found later sort in among the earlier ones', () => {
    const w = new TestWorld({ seed: 'wants-batch-2', world: 'flat-test' });
    const h = sys(w).hauling;
    const a = w.spawnItem('log', 'oak', w.index(40, 40, Z));
    const b = w.spawnItem('log', 'oak', w.index(41, 40, Z));
    w.step(10);
    expect(h.noHome).toEqual([a, b]);
    const c = w.spawnItem('log', 'oak', w.index(42, 40, Z));
    w.step(10);
    expect(h.noHome).toEqual([a, b, c]);
    expect(h.wants).toEqual([]);
    // One leaves noHome by being forbidden and comes back through the set to noHome in its place.
    w.items.setFlag(b, ItemFlag.Forbidden, true);
    expect(h.noHome).toEqual([a, c]);
    w.items.setFlag(b, ItemFlag.Forbidden, false);
    expect(h.wants).toEqual([b]);
    w.step(10);
    expect(h.noHome).toEqual([a, b, c]);
    expect(h.wants).toEqual([]);
  });

  it('the scans of a stockpile give the slot findSlot gives, for tiles, stacks, barrels and reservations', () => {
    const w = new TestWorld({ seed: 'wants-scan', world: 'flat-test', embark: 'default' });
    const h = sys(w).hauling;
    const store = h.host.store;
    const core = h.host.core;
    const apply = (cmd: Record<string, unknown>): void => void w.game.world.applyCommand(cmd as never);
    const tiles = rect(w, 20, 20, Z, 4, 1);
    const pile = w.zone('stockpile', tiles);
    apply({ type: 'SetStockpileFilter', zoneId: pile, filter: 'everything' });
    const away = w.index(40, 40, Z);
    const probes = (): number[] => [
      w.spawnItem('log', 'oak', away, 1), w.spawnItem('log', 'oak', away, 7), w.spawnItem('log', 'birch', away, 1),
      w.spawnItem('ring', 'granite', away, 1), w.spawnItem('drink', 'ale', away, 3), w.spawnItem('drink', 'ale', away, 20),
    ];
    const agree = (ids: number[]): void => {
      for (const id of ids) {
        const it = core.get(id)!;
        const cls = core.container(id) !== undefined ? 'none' : core.host.facts.row(it.type).container;
        const viaScan = cls === 'none' ? store.slotInScan(store.scanTiles(pile), id) : store.slotInContainerScan(pile, id, cls, store.scanContainers(pile, cls));
        expect(viaScan, `item ${id} (${cls})`).toEqual(store.findSlot(pile, id));
      }
    };
    let ids = probes();
    agree(ids);
    // Stacks on three tiles, one free: the free tile.
    w.spawnItem('log', 'oak', tiles[0]!, 5);
    w.spawnItem('ring', 'granite', tiles[1]!, 1);
    w.spawnItem('log', 'birch', tiles[2]!, 2);
    ids = probes();
    agree(ids);
    // No free tile: only a stack with room takes a log.
    w.spawnItem('log', 'oak', tiles[3]!, 30);
    ids = probes();
    agree(ids);
    // A reservation on a stack's tile takes it out of the offer.
    store.reserve({ tile: tiles[0]!, container: 0, merge: 0, key: `t${tiles[0]}` }, 99);
    agree(probes());
    // A barrel on the pile with room, then with a reservation promising some of it.
    const barrel = w.spawnItem('barrel', 'oak', tiles[1]!, 1);
    agree(probes());
    const inbound = w.spawnItem('drink', 'ale', away, 18);
    store.reserve({ tile: tiles[1]!, container: barrel, merge: 0, key: `c${barrel}:${inbound}` }, 98);
    agree(probes());
    // A stockpile that wants a barrel it has not got.
    apply({ type: 'SetStockpileContainers', zoneId: pile, wants: { barrel: 3 } });
    agree(probes());
  });
});
