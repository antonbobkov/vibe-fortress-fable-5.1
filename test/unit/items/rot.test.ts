import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader, ItemsSystem } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

function world(seed: string): TestWorld {
  const registry = new TestWorld({ seed: `${seed}-registry`, world: 'flat-test', embark: 'none' }).game.registry;
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
}

describe('T-M4-15 rot queue and corpses', () => {
  it('requeues on a move without losing elapsed decay', () => {
    const w = world('rot-requeue');
    const a = w.index(12, 12, 32); const b = w.index(13, 12, 32);
    w.forceTemperature(a, 20); w.forceTemperature(b, 20);
    const meat = w.spawnItem('raw_meat', 'cow_meat', a);
    w.step(2 * TICKS_PER_DAY);
    w.items.dropAt(meat, b);
    const queue = (w.game.world.scheduler.byId('13') as ItemsSystem).serialize().rotQueue;
    expect(queue.flatMap((bucket) => bucket.items).filter((id) => id === meat)).toHaveLength(1);
    w.step(TICKS_PER_DAY + 51);
    expect(w.readers.of<ItemsReader>('13').rotStage(meat)).toBe(1);
  });

  it('stops rot below FREEZE_C and resumes after moving into warmth', () => {
    const w = world('rot-frozen');
    const cold = w.index(12, 12, 32); const warm = w.index(13, 12, 32);
    w.forceTemperature(cold, -2); w.forceTemperature(warm, 20);
    const meat = w.spawnItem('raw_meat', 'cow_meat', cold);
    w.step(6 * TICKS_PER_DAY);
    expect(w.readers.of<ItemsReader>('13').rotStage(meat)).toBe(0);
    w.items.dropAt(meat, warm);
    w.step(3 * TICKS_PER_DAY + 51);
    expect(w.readers.of<ItemsReader>('13').rotStage(meat)).toBe(1);
  });

  it('saves the queued expiry and resumes with the same rot state and world hash', () => {
    const w = world('rot-roundtrip');
    w.spawnItem('raw_meat', 'cow_meat', w.index(12, 12, 32));
    w.step(2 * TICKS_PER_DAY);
    const resumed = roundTrip(w.game).game;
    expect(resumed.hash()).toBe(w.hash());
    w.step(5 * TICKS_PER_DAY);
    resumed.step(5 * TICKS_PER_DAY);
    expect(resumed.hash()).toBe(w.hash());
  });

  it('makes one corpse from starvation and activates unburied grief after three days', () => {
    const w = world('rot-death');
    const tile = w.index(12, 12, 32);
    const creature = w.spawnCreature('cow', tile, 'fortress');
    const species = w.game.world.entities.get(creature, C.Creature)?.species;
    w.game.world.emit({ type: 'CreatureDied', id: creature, cause: 'starvation', tile, species });
    w.step(11);
    expect(w.events('CorpseCreated').filter((event) => event['creatureId'] === creature)).toHaveLength(1);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.unburiedDead(w.tick + 4 * TICKS_PER_DAY)).toBe(false);
    const dwarf = w.spawnDwarf({ at: tile, name: 'Lost' });
    const dwarfSpecies = w.game.world.entities.get(dwarf, C.Creature)?.species;
    w.game.world.emit({ type: 'CreatureDied', id: dwarf, cause: 'test', tile, species: dwarfSpecies, name: 'Lost' });
    w.step(11);
    expect(items.unburiedDead(w.tick + 3 * TICKS_PER_DAY + 1)).toBe(true);
    const dwarfCorpseId = w.events('CorpseCreated').find((event) => event['creatureId'] === dwarf)?.['id'] as number;
    expect(w.game.world.entities.get(dwarfCorpseId, C.Corpse)?.dwarfName).toBe('Lost');
    expect(w.game.world.entities.get(dwarfCorpseId, C.Corpse)?.weight).toBe(
      w.game.registry.table<{ id: string; size: number }>('creatures').byId('dwarf')?.size);
    const material = items.get(dwarfCorpseId)?.material ?? 0;
    expect(w.game.registry.table('materials').idOf(material)).toBe('skull_bone');
  });

  it.todo('C-008: the 20-day corpse row expects a skeleton before the 21-day gone threshold');
});

