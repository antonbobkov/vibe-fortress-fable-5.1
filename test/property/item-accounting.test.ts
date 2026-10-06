import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HeadlessGame, buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag } from '@core/components';
import type { EntityId } from '@core/types';
import { ItemsSystem, type ItemsReader } from '@systems/items';

/**
 * `testing-strategy.md` § Property tests, "item accounting": random craft/haul/destroy streams;
 * `counts` equals a recount from entities. The stream draws every mutation of the item API
 * (T-M2-01; hauling and crafting reach items only through these calls).
 */

const TYPES: readonly [string, string][] = [
  ['log', 'oak'],
  ['bolt', 'copper'],
  ['stone_block', 'granite'],
  ['bin', 'oak'],
  ['barrel', 'pine'],
  ['drink', 'ale'],
  ['table', 'granite'],
  ['breastplate', 'steel'],
];

type Op =
  | { k: 'spawn'; type: number; count: number; quality: number; x: number }
  | { k: 'split'; pick: number; n: number }
  | { k: 'merge'; a: number; b: number }
  | { k: 'destroy'; pick: number }
  | { k: 'consume'; pick: number; n: number }
  | { k: 'flag'; pick: number; flag: number; on: boolean }
  | { k: 'owner'; pick: number; on: boolean }
  | { k: 'put'; pick: number; into: number }
  | { k: 'out'; pick: number }
  | { k: 'carry'; pick: number }
  | { k: 'drop'; pick: number; x: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ k: fc.constant('spawn' as const), type: fc.nat(TYPES.length - 1), count: fc.integer({ min: 1, max: 60 }), quality: fc.nat(5), x: fc.integer({ min: 3, max: 12 }) }),
  fc.record({ k: fc.constant('split' as const), pick: fc.nat(), n: fc.integer({ min: 1, max: 30 }) }),
  fc.record({ k: fc.constant('merge' as const), a: fc.nat(), b: fc.nat() }),
  fc.record({ k: fc.constant('destroy' as const), pick: fc.nat() }),
  fc.record({ k: fc.constant('consume' as const), pick: fc.nat(), n: fc.integer({ min: 1, max: 30 }) }),
  fc.record({ k: fc.constant('flag' as const), pick: fc.nat(), flag: fc.constantFrom(ItemFlag.Forbidden, ItemFlag.Reserved, ItemFlag.Dump), on: fc.boolean() }),
  fc.record({ k: fc.constant('owner' as const), pick: fc.nat(), on: fc.boolean() }),
  fc.record({ k: fc.constant('put' as const), pick: fc.nat(), into: fc.nat() }),
  fc.record({ k: fc.constant('out' as const), pick: fc.nat() }),
  fc.record({ k: fc.constant('carry' as const), pick: fc.nat() }),
  fc.record({ k: fc.constant('drop' as const), pick: fc.nat(), x: fc.integer({ min: 3, max: 12 }) }),
);

describe('T-M2-01 property: item accounting', () => {
  it('counts and wealth equal a recount from the entities after any stream of item operations', () => {
    const registry = contentRegistry();
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 120 }), (ops) => {
        const game = new HeadlessGame({ seed: 'accounting', map: buildFlatTestMap(registry, 16, 16), systems: [new ItemsSystem()] });
        const api = game.world.services.items;
        if (api === null) throw new Error('no item API');
        const reader = game.world.readers.of<ItemsReader>('13');
        const alive = (): EntityId[] => game.world.entities.with(C.Item);
        const pick = (n: number): EntityId => {
          const ids = alive();
          return ids.length === 0 ? 0 : (ids[n % ids.length] as EntityId);
        };
        const carrier = game.world.entities.create('creature');
        const at = (x: number): number => game.map.index(x, 8, 32);
        for (const op of ops) {
          const id = 'pick' in op ? pick(op.pick) : 0;
          switch (op.k) {
            case 'spawn': {
              const [t, m] = TYPES[op.type] as [string, string];
              game.spawn.item(registry.table('items').index(t), registry.table('materials').index(m), at(op.x), op.count, op.quality);
              break;
            }
            case 'split':
              if (id !== 0) api.split(id, op.n);
              break;
            case 'merge':
              api.merge(pick(op.a), pick(op.b));
              break;
            case 'destroy':
              if (id !== 0) api.destroy(id, 'test');
              break;
            case 'consume':
              if (id !== 0) api.consume(id, op.n);
              break;
            case 'flag':
              if (id !== 0) api.setFlag(id, op.flag, op.on);
              break;
            case 'owner':
              if (id !== 0) api.setOwner(id, op.on ? carrier : 0);
              break;
            case 'put':
              if (id !== 0) api.putIn(id, pick(op.into));
              break;
            case 'out':
              if (id !== 0) api.takeOut(id);
              break;
            case 'carry':
              if (id !== 0) api.attachToCarrier(id, carrier);
              break;
            case 'drop':
              if (id !== 0) api.dropAt(id, at(op.x));
              break;
          }
        }
        const core = (game.world.scheduler.byId('13') as ItemsSystem).core;
        const recount = core.recount();
        const seen = new Set<number>();
        for (const [type, total, available] of recount.rows) {
          seen.add(type);
          expect([type, reader.count(type), reader.available(type)]).toEqual([type, total, available]);
        }
        for (const type of reader.stockedTypes()) expect(seen.has(type)).toBe(true);
        expect(core.wealth).toBe(recount.wealth);
        // Every container lists exactly the living items that name it.
        for (const c of game.world.entities.with(C.Container)) {
          const named = alive().filter((i) => game.world.entities.get(i, C.Item)?.containerId === c);
          expect(reader.inContainer(c)).toEqual(named);
        }
      }),
      { numRuns: 40 },
    );
  });
});
