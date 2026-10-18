/** T-383: `findItems` finds in one pass what `findItem` repeated with `excludeIds` finds one at a time. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { ItemFlag } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { ItemFilter, ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

/** What `findItems` was before: `findItem` again and again, the ids found so far excluded. */
function oneByOne(reader: ItemsReader, filter: ItemFilter, count: number, from: number): number[] {
  const found: number[] = [];
  const exclude = [...(filter.excludeIds ?? [])];
  while (found.length < count) {
    const id = reader.findItem({ ...filter, excludeIds: exclude }, from, 'walker', { reservable: true });
    if (id === 0) break;
    found.push(id);
    exclude.push(id);
  }
  return found;
}

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('T-383 findItems in one pass', () => {
  it('returns the items in the order findItem gives them one at a time', () => {
    const w = new TestWorld({ seed: 't383-order', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const reader = w.readers.of<ItemsReader>('13');
    const rnd = lcg(383);
    const ids: number[] = [];
    // Logs spread over every search radius, with ties of distance; some forbidden or reserved; some in a barrel; some walled off.
    for (let k = 0; k < 160; k += 1) {
      const x = 8 + Math.floor(rnd() * 80);
      const y = 8 + Math.floor(rnd() * 80);
      ids.push(w.spawnItem('log', k % 3 === 0 ? 'pine' : 'oak', w.index(x, y, Z), 1 + Math.floor(rnd() * 3)));
    }
    for (let k = 0; k < ids.length; k += 7) w.items.setFlag(ids[k] as number, ItemFlag.Forbidden, true);
    for (let k = 3; k < ids.length; k += 11) w.items.setFlag(ids[k] as number, ItemFlag.Reserved, true);
    const barrel = w.spawnItem('barrel', 'oak', w.index(50, 50, Z));
    for (let k = 0; k < 4; k += 1) expect(w.items.putIn(w.spawnItem('log', 'oak', w.index(50, 50, Z)), barrel)).toBe(true);
    const island = w.index(88, 88, Z);
    for (const n of w.map.neighbors8(island)) w.carve(n, TileKind.Wall);
    w.spawnItem('log', 'oak', island);
    w.step(1);
    const log = w.game.registry.table('items').index('log');
    const filters: ItemFilter[] = [{ type: log }, { type: log, materialId: w.game.registry.table('materials').index('oak') }, { type: log, excludeIds: ids.slice(0, 20) }];
    for (const from of [w.index(48, 48, Z), w.index(10, 10, Z), w.index(90, 20, Z), w.index(50, 50, Z)]) {
      for (const filter of filters) {
        const all = oneByOne(reader, filter, Number.MAX_SAFE_INTEGER, from);
        expect(all.length).toBeGreaterThan(20);
        expect(reader.findItems(filter, Number.MAX_SAFE_INTEGER, from)).toEqual(all);
        for (const count of [1, 2, 5, 40]) expect(reader.findItems(filter, count, from)).toEqual(all.slice(0, count));
      }
    }
  });

  it('reaches the contents of the wagon through the stock index, as findItem does one at a time', () => {
    const w = new TestWorld({ seed: 't383-wagon', world: 'flat-test', embark: 'default', surfaceWildlife: 'none' });
    const reader = w.readers.of<ItemsReader>('13');
    const wagon = w.readers.of<{ wagon(): EntityId }>('14').wagon();
    const inside = reader.inContainer(wagon);
    expect(inside.length).toBeGreaterThan(0);
    const types = [...new Set(inside.map((id) => reader.get(id)?.type ?? 0))];
    // Loose items of the same types lie on the ground too, so the radius search and the stock index both answer.
    for (const type of types) w.spawnItem(type, reader.get(inside.find((id) => reader.get(id)?.type === type) as EntityId)?.material ?? 0, w.index(30, 30, Z));
    w.step(1);
    for (const from of [w.index(30, 30, Z), w.index(5, 90, Z), w.index(48, 48, Z)]) {
      for (const type of types) {
        const all = oneByOne(reader, { type }, Number.MAX_SAFE_INTEGER, from);
        expect(all.some((id) => inside.includes(id)), `type ${type} from ${from}: a wagon item is found`).toBe(true);
        expect(reader.findItems({ type }, Number.MAX_SAFE_INTEGER, from)).toEqual(all);
        for (const count of [1, 2, 3]) expect(reader.findItems({ type }, count, from)).toEqual(all.slice(0, count));
      }
    }
  });

  it('finds the items of a large stock in one pass', () => {
    const w = new TestWorld({ seed: 't383-large', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const reader = w.readers.of<ItemsReader>('13');
    for (let k = 0; k < 3000; k += 1) w.spawnItem('log', 'oak', w.index(4 + (k % 88), 4 + Math.floor(k / 88), Z));
    w.step(1);
    const log = w.game.registry.table('items').index('log');
    const from = w.index(48, 48, Z);
    const started = performance.now();
    const found = reader.findItems({ type: log }, Number.MAX_SAFE_INTEGER, from);
    const ms = performance.now() - started;
    expect(found).toHaveLength(3000);
    // The repeated search took seconds for this many; one pass takes a few milliseconds.
    expect(ms).toBeLessThan(500);
  });
});
