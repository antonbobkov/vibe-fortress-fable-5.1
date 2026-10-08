import { describe, expect, it } from 'vitest';
import { C, ItemFlag } from '@core/components';
import type { EntityId } from '@core/types';
import { TileKind } from '@core/map3d';
import { entityIndex } from '@core/entities';
import { ItemSearch, type ItemFilter, type SearchHost, type SearchOptions } from '@systems/items/search';
import type { ItemsSystem } from '@systems/items';
import type { CombatReader } from '@systems/combat/reader';
import { equipHostileCreature } from '@systems/threats/gear';
import { fireRanged } from '@systems/combat/ranged';
import type { TickContext } from '@core/system';
import { ItemSearch as LegacySearch } from './legacy-search';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M8-01 indexed search retains the original choices', () => {
  it('updates held stock and per-tile maxima after real squad claims and hostile gear generation', () => {
    const w = new TestWorld({ seed: 'm801-direct-combat', world: 'flat-test', embark: 'none' });
    const world = w.game.world;
    const core = (world.scheduler.byId('13') as ItemsSystem).core;
    const tile = w.index(10, 10, 32);
    const soldier = w.spawnDwarf({ at: tile });
    // T-161: exercise a squad claim without an unmet civilian axe requirement.
    expect(world.applyCommand({ type: 'SetLabor', dwarfId: soldier, labor: 'woodcutting', on: false })).toEqual({ ok: true });
    const spare = w.spawnItem('axe', 'iron', tile);
    const chosen = world.services.spawn.item(w.game.registry.table('items').index('axe'),
      w.game.registry.table('materials').index('steel'), tile, 1, 5);
    expect(core.bestUnattendedItems()).toEqual([chosen]);
    const initiallyHeld = world.entities.with(C.Item).filter((id) => core.get(id)?.carriedBy === soldier);
    expect(core.carriedItems(soldier)).toEqual(initiallyHeld);
    expect(world.applyCommand({ type: 'CreateSquad', name: 'Index guards' })).toEqual({ ok: true });
    const squad = w.readers.of<CombatReader>('16').squads()[0];
    expect(squad).toBeDefined();
    expect(world.applyCommand({ type: 'SetSquadEquipment', squadId: squad?.id,
      equipment: { weaponClass: 'axe' } })).toEqual({ ok: true });
    expect(world.applyCommand({ type: 'SetSquadMembers', squadId: squad?.id,
      members: [soldier] })).toEqual({ ok: true });
    expect(world.entities.get(soldier, C.Equipment)?.weapon).toBe(chosen);
    expect(core.carriedItems(soldier)).toEqual([...initiallyHeld, chosen]);
    expect(core.bestUnattendedItems()).toEqual([spare]);

    const hostile = w.spawnCreature('dwarf', w.index(20, 20, 32), 'hostile:hillfolk');
    equipHostileCreature(world, w.game.registry, world.rngFor('m801-gear'), hostile,
      w.index(20, 20, 32), 'warriors', 1, false);
    const worn = world.entities.with(C.Item).filter((id) => core.get(id)?.carriedBy === hostile);
    expect(worn.length).toBeGreaterThan(0);
    expect(core.carriedItems(hostile)).toEqual(worn);
    expect(core.bestUnattendedItems()).toEqual([spare]);
  });

  it('removes the last held arrow from the carrier index while its real projectile is in flight', () => {
    const w = new TestWorld({ seed: 'm801-projectile-index', world: 'flat-test', embark: 'none' });
    const world = w.game.world;
    const core = (world.scheduler.byId('13') as ItemsSystem).core;
    const tile = w.index(10, 10, 32);
    const shooter = w.spawnDwarf({ at: tile });
    const target = w.spawnCreature('deer', w.index(15, 10, 32), 'wild');
    const bow = w.spawnItem('bow', 'oak', tile);
    const arrow = w.spawnItem('arrow', 'iron', tile);
    core.attachToCarrier(bow, shooter); core.attachToCarrier(arrow, shooter);
    const equipment = world.entities.get(shooter, C.Equipment);
    if (equipment === undefined) throw new Error('missing shooter equipment');
    equipment.weapon = bow;
    expect(core.carriedItems(shooter)).toContain(arrow);
    const ctx: TickContext = { world, registry: w.game.registry, readers: w.readers, tick: w.tick,
      terrain: world.services.terrain, jobs: world.services.jobs, spawn: world.services.spawn,
      register: world.registrations, rng: world.rngFor('16'), emit: (event) => world.events.emit(event) };
    expect(fireRanged(ctx, shooter, target, new Map())).toBe(true);
    expect(world.entities.with(C.Projectile)).toHaveLength(1);
    expect(core.carriedItems(shooter)).not.toContain(arrow);
    expect(core.bestUnattendedItems()).not.toContain(arrow);
  });

  it('matches the scan through create, reserve, carry, container movement, split, consume, type change, slot reuse and rebuild', () => {
    const w = new TestWorld({ seed: 'm801-search-index', world: 'flat-test', embark: 'none' });
    w.step(1);
    const system = w.game.world.scheduler.byId('13') as ItemsSystem;
    const core = system.core;
    const host: SearchHost = { core, entities: w.readers.entities, spatial: () => w.readers.spatial,
      pathing: () => w.readers.pathing, stockpileAt: (t) => system.stockpiles.stockpileAt(t) };
    const indexed = new ItemSearch(host);
    const legacy = new LegacySearch(host);
    const from = w.index(10, 10, 32);
    const filters: ItemFilter[] = [{ category: 'wood' }, { edible: true }, { drinkable: true },
      { category: 'craft' }, { emptyContainer: 'bin' }, { category: 'food', minQuality: 2 }, { types: [1, 2, 3] }];
    const options: SearchOptions[] = [{ reservable: true }, { reservable: false }, { reservable: true, stockpiledContainerClass: 'barrel' }];
    const compare = (): void => {
      for (const filter of filters) for (const opts of options) {
        expect(indexed.findItems(filter, 5, from, 'walker', opts), JSON.stringify([filter, opts]))
          .toEqual(legacy.findItems(filter, 5, from, 'walker', opts));
      }
      for (const id of w.game.world.entities.with(C.Item)) expect(core.carriedItems(core.item(id).carriedBy).includes(id))
        .toBe(core.item(id).carriedBy !== 0);
      const byTile = new Map<number, EntityId>();
      for (const id of w.game.world.entities.with(C.Item)) {
        const item = core.item(id);
        if (item.carriedBy !== 0 || item.containerId !== 0 || (item.flags & ItemFlag.Forbidden) !== 0) continue;
        const tile = core.tileOf(id);
        if (tile < 0) continue;
        const best = byTile.get(tile);
        if (best === undefined || core.value(id) > core.value(best)) byTile.set(tile, id);
      }
      expect(core.bestUnattendedItems()).toEqual([...byTile.values()]
        .sort((a, b) => core.value(b) - core.value(a) || entityIndex(a) - entityIndex(b)));
    };
    compare(); // Build empty caches before the first creation.
    const log = w.spawnItem('log', 'oak', w.index(11, 10, 32));
    const far = w.spawnItem('log', 'oak', w.index(90, 90, 32));
    const barrel = w.spawnItem('barrel', 'oak', w.index(12, 10, 32));
    const bin = w.spawnItem('bin', 'oak', w.index(13, 10, 32));
    const drink = w.spawnItem('drink', 'dimcap_ale', { containerId: barrel }, 10);
    const food = w.spawnItem('raw_meat', 'granite', w.index(14, 10, 32), 5);
    const ring = w.spawnItem('ring', 'granite', { containerId: bin });
    w.zone('stockpile', [w.index(12, 10, 32)]);
    compare();
    core.reserve(log, 7); core.setFlag(barrel, ItemFlag.Forbidden, true); compare();
    core.release(log); core.setFlag(barrel, ItemFlag.Forbidden, false);
    const carrier = w.spawnDwarf({ at: from });
    core.attachToCarrier(bin, carrier); core.attachToCarrier(log, carrier); compare();
    core.dropAt(bin, w.index(40, 40, 32)); core.dropAt(log, w.index(41, 40, 32)); compare();
    core.takeOut(drink); core.putIn(ring, bin); compare();
    const part: EntityId = core.split(food, 2); core.consume(part, 1); compare();
    core.setRot(food, 2, w.game.registry.table('items').index('rotten')); compare();
    core.destroy(far, 'test'); w.spawnItem('log', 'oak', w.index(9, 10, 32)); compare();
    core.resetSearchIndex(); w.spatial.rebuild(); compare();
    // The source itself is impassable: even a matching nearby or exact item must fail.
    w.carve(from, TileKind.Wall);
    w.pathing.connectivity.rebuildDirty();
    expect(w.readers.pathing.labelOf(from, 'walker')).toBe(0);
    filters.push({ itemId: log });
    compare();
  });

  it('retains the first entity slot for per-tile value ties after reuse, and only excludes forbidden or attended items', () => {
    const w = new TestWorld({ seed: 'm801-unattended', world: 'flat-test', embark: 'none' });
    const core = (w.game.world.scheduler.byId('13') as ItemsSystem).core;
    const tile = w.index(10, 10, 32);
    const first = w.spawnItem('log', 'oak', tile);
    const later = w.spawnItem('log', 'oak', tile);
    expect(core.bestUnattendedItems()).toEqual([first]);
    core.destroy(first, 'test');
    const reused = w.spawnItem('log', 'oak', tile);
    expect(reused).toBeGreaterThan(later);
    expect(core.bestUnattendedItems()).toEqual([reused]);
    core.reserve(reused, 7); core.setFlag(reused, ItemFlag.Merchant, true);
    expect(core.bestUnattendedItems()).toEqual([reused]);
    core.setFlag(reused, ItemFlag.Forbidden, true);
    expect(core.bestUnattendedItems()).toEqual([later]);
    core.setFlag(reused, ItemFlag.Forbidden, false);
    expect(core.bestUnattendedItems()).toEqual([reused]);
    core.resetSearchIndex();
    expect(core.bestUnattendedItems()).toEqual([reused]);
  });
});
