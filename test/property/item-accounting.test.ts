import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HeadlessGame, buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag } from '@core/components';
import type { EntityId } from '@core/types';
import { TestWorld } from '../scenarios/test-world';
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


describe('T-162 property: squad item accounting', () => {
  it('claims, replacements and ranged equipment preserve counts and container inverses after every command', () => {
    const registry = contentRegistry();
    const gear: readonly [string, string][] = [['short_sword', 'iron'], ['short_sword', 'steel'],
      ['helm', 'iron'], ['shield', 'iron'], ['mail_shirt', 'iron'], ['crossbow', 'oak'],
      ['quiver', 'leather'], ['bolt', 'iron']];
    fc.assert(fc.property(fc.array(fc.record({ k: fc.constantFrom('spawn', 'contain', 'members', 'equipment', 'destroy'),
      type: fc.nat(gear.length - 1), quality: fc.nat(5), ranged: fc.boolean() }), { minLength: 1, maxLength: 60 }), (ops) => {
      const w = new TestWorld({ seed: 't162-squad-property', map: buildFlatTestMap(registry, 16, 16), embark: 'none' });
      const at = w.index(8, 8, 32);
      const a = w.spawnDwarf({ at, ageYears: 30 });
      const b = w.spawnDwarf({ at, ageYears: 30 });
      const barrel = w.spawnItem('barrel', 'oak', at);
      expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' })).toEqual({ ok: true });
      const squadId = w.game.world.entities.with(C.Squad)[0]!;
      const core = (w.game.world.scheduler.byId('13') as ItemsSystem).core;
      for (const op of ops) {
        if (op.k === 'spawn') {
          const [type, mat] = gear[op.type]!;
          w.spawnItem(type, mat, at, type === 'bolt' ? 25 : 1, op.quality);
        } else if (op.k === 'contain') {
          const loose = w.game.world.entities.with(C.Item).filter((id) => {
            const item = w.game.world.entities.get(id, C.Item)!;
            return item.carriedBy === 0 && item.ownerId === 0 && item.containerId === 0 && id !== barrel;
          });
          if (loose.length > 0) w.game.world.services.items!.putIn(loose[op.type % loose.length]!, barrel);
        } else if (op.k === 'destroy') {
          const loose = w.game.world.entities.with(C.Item).filter((id) => id !== barrel && w.game.world.entities.get(id, C.Item)?.carriedBy === 0);
          if (loose.length > 0) w.game.world.services.items!.destroy(loose[op.type % loose.length]!, 'test');
        } else if (op.k === 'members') {
          expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: op.ranged ? [a, b] : [a] })).toEqual({ ok: true });
        } else {
          expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId,
            equipment: { weaponClass: 'any', armor: 'any', ranged: op.ranged } })).toEqual({ ok: true });
        }
        expect(core.counts.serialize().map(([type, counts]) => [type, counts.total, counts.available])).toEqual(core.recount().rows);
        for (const holder of w.game.world.entities.with(C.Container)) {
          expect(w.game.world.entities.get(holder, C.Container)?.contents).toEqual(
            w.game.world.entities.with(C.Item).filter((id) => w.game.world.entities.get(id, C.Item)?.containerId === holder).sort((a, b) => a - b));
        }
      }
    }), { numRuns: 40, seed: 20261008 });
  });
});
