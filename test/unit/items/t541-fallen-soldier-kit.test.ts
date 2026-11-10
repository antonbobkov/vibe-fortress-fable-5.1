/**
 * T-541: a fallen soldier's spear is picked up again. A dwarf falls out of its kit (13 § Forbid,
 * dump, melt, claim): its weapon, shield, armor and quiver drop on its tile at death, and its
 * clothing stays on the corpse, to be buried with it. Before, the kit stayed on the corpse until a
 * coffin took it or the body rotted (a dwarf's corpse is never stripped), so on `three-years-p2-6`
 * the recruit who took a fallen soldier's place had no spear for 40 days.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat/reader';
import { REEQUIP_CHECK_DAYS } from '@systems/combat/constants';
import { killCreature } from '@systems/health/tick';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

function context(w: TestWorld): TickContext {
  const world = w.game.world;
  return {
    world,
    registry: world.registry,
    rng: world.rngFor('16'),
    readers: world.readers,
    register: world.registrations,
    tick: world.calendar.tick,
    emit: (event: GameEvent) => world.emit(event),
    terrain: world.services.terrain,
    jobs: world.services.jobs,
    spawn: world.services.spawn,
  };
}

function category(w: TestWorld, itemId: EntityId): string {
  const item = w.game.world.entities.get(itemId, C.Item);
  return item === undefined ? '' : String(w.game.registry.table<{ id: string; category: string }>('items').byIndex(item.type)?.category);
}

describe('T-541 a fallen soldier\'s kit', () => {
  it('drops on the dwarf\'s tile, and the recruit in its place claims the spear', () => {
    const w = new TestWorld({ seed: 't541-kit', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const items = w.readers.of<ItemsReader>('13');
    const entities = w.game.world.entities;
    const at = w.index(30, 30, Z);
    const soldier = w.spawnDwarf({ at });
    const recruit = w.spawnDwarf({ at: w.index(32, 30, Z) });
    // Nobody hauls: the kit is claimed where it fell, with no job to bring it in.
    for (const d of [soldier, recruit]) w.setLabor(d, 'hauling', false);
    const spear = w.spawnItem('spear', 'iron', w.index(20, 20, Z));
    const shield = w.spawnItem('shield', 'iron', w.index(20, 21, Z));

    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' });
    const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [soldier] });
    w.step(2);
    expect(entities.get(soldier, C.Equipment)?.weapon).toBe(spear);
    expect(entities.get(soldier, C.Equipment)?.shield).toBe(shield);
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [soldier, recruit] });
    w.step(2);
    expect(entities.get(recruit, C.Equipment)?.weapon ?? 0).toBe(0);

    const clothes = entities.with(C.Item).filter((id) => items.get(id)?.carriedBy === soldier && category(w, id).startsWith('clothing/'));
    expect(clothes.length).toBeGreaterThan(0);
    const tile = (() => { const p = entities.get(soldier, C.Position)!; return w.index(p.x, p.y, p.z); })();
    killCreature(context(w), soldier, 'killed');
    w.step(1);
    const corpse = entities.with(C.Corpse).find((id) => entities.get(id, C.Corpse)?.dwarfName !== null) as EntityId;
    expect(corpse).toBeDefined();

    // The kit lies on the tile, unowned and claimable; the clothing stays on the corpse.
    for (const kit of [spear, shield]) {
      const item = items.get(kit);
      expect(item?.carriedBy === recruit || (item?.carriedBy === 0 && item.ownerId === 0 && items.tileOf(kit) === tile)).toBe(true);
    }
    expect([...(entities.get(corpse, C.Corpse)?.wornItems ?? [])].sort((a, b) => a - b)).toEqual([...clothes].sort((a, b) => a - b));
    for (const id of clothes) expect(items.get(id)?.carriedBy).toBe(corpse);
    // A dwarf's corpse is still never stripped.
    w.step(200);
    expect(w.events('JobCreated').filter((e) => e['jobType'] === 'strip_corpse')).toHaveLength(0);

    // The squad's next look arms the recruit with the fallen soldier's spear and shield.
    w.until(() => entities.get(recruit, C.Equipment)?.weapon === spear, (REEQUIP_CHECK_DAYS + 1) * TICKS_PER_DAY);
    expect(entities.get(recruit, C.Equipment)?.shield).toBe(shield);
  });

  it('leaves a warrior\'s gear on its corpse for strip_corpse', () => {
    const w = new TestWorld({ seed: 't541-gloam', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const items = w.readers.of<ItemsReader>('13');
    const warrior = w.spawnCreature('gloam_warrior', w.index(30, 30, Z), 'hostile:gloam');
    const spear = w.spawnItem('spear', 'iron', w.index(20, 20, Z));
    w.items.attachToCarrier(spear, warrior);
    w.game.world.entities.add(warrior, C.Equipment, {
      weapon: spear, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 }, clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
    });
    killCreature(context(w), warrior, 'killed');
    w.step(1);
    const corpse = w.game.world.entities.with(C.Corpse)[0] as EntityId;
    expect(items.get(spear)?.carriedBy).toBe(corpse);
    expect(w.game.world.entities.get(corpse, C.Corpse)?.wornItems).toContain(spear);
  });
});
