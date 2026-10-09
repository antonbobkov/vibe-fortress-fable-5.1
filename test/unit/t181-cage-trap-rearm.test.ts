import { describe, expect, it } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { DefenseReader } from '@systems/defense';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs/reader';
import { TestWorld } from '../scenarios/test-world';

const Z = 32;

/** A cage trap that has caught a trollkin; food and a mechanic are ready. */
function sprungCageTrap(seed: string): { w: TestWorld; trap: number; troll: number; caught: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const trap = w.build('cage_trap', w.index(40, 40, Z), 'iron');
  const troll = w.spawnCreature('trollkin', w.index(39, 40, Z), 'hostile:gloam');
  w.step(1);
  w.game.world.services.movement?.teleport(troll, w.index(40, 40, Z));
  w.step(2);
  const caught = w.events('CreatureCaged')[0]?.['cageItemId'] as number;
  expect(caught).toBeGreaterThan(0);
  expect(w.readers.of<DefenseReader>('19').trapState(trap)).toBe('spent');
  w.spawnItem('easy_meal', 'dimcap', w.index(45, 45, Z), 60);
  w.spawnItem('drink', 'ale', w.index(46, 45, Z), 60);
  w.spawnDwarf({ at: w.index(44, 44, Z), ageYears: 30, skills: { mechanics: 5 } });
  return { w, trap, troll, caught };
}

describe('T-181 a sprung cage trap is re-armed with an unoccupied cage', () => {
  it('a spare cage re-arms the trap and the occupied cage is not touched', () => {
    const { w, trap, troll, caught } = sprungCageTrap('t181-rearm');
    const spare = w.spawnItem('cage', 'iron', w.index(42, 42, Z));
    w.until(() => w.events('TrapRearmed').some((e) => e['trapId'] === trap), 10 * TICKS_PER_DAY);
    expect(w.readers.of<DefenseReader>('19').trapState(trap)).toBe('armed');
    const items = w.readers.of<ItemsReader>('13');
    expect((items.get(spare)?.flags ?? 0) & ItemFlag.Installed).toBe(ItemFlag.Installed);
    expect(w.game.world.entities.get(caught, C.Item)?.occupantId).toBe(troll);
    expect((items.get(caught)?.flags ?? 0) & ItemFlag.Installed).toBe(0);
  }, 120_000);

  it('with only the occupied cage on the map the job waits for an input and the cage stays put', () => {
    const { w, trap, troll, caught } = sprungCageTrap('t181-occupied-only');
    const items = w.readers.of<ItemsReader>('13');
    const cage = w.game.registry.table('items').index('cage');
    expect(items.countAvailable({ type: cage })).toBe(0);
    expect(items.countAvailable({ unoccupied: true, type: cage })).toBe(0);
    w.step(5 * TICKS_PER_DAY);
    expect(w.events('TrapRearmed')).toHaveLength(0);
    expect(w.readers.of<DefenseReader>('19').trapState(trap)).toBe('spent');
    const rearm = w.readers.of<JobsReader>('11').list().find((j) => j.state === 'blocked' && j.blockedReason === 'missing_input');
    expect(rearm).toBeDefined();
    expect(w.game.world.entities.get(caught, C.Item)?.occupantId).toBe(troll);
    expect(items.tileOf(caught)).toBe(w.index(40, 40, Z));
  }, 120_000);

  it('an emptied cage is available stock again', () => {
    const { w, caught } = sprungCageTrap('t181-released');
    const items = w.readers.of<ItemsReader>('13');
    const cage = w.game.registry.table('items').index('cage');
    expect(items.countAvailable({ type: cage })).toBe(0);
    expect(w.game.world.applyCommand({ type: 'ReleaseCaged', cageId: caught })).toEqual({ ok: true });
    expect(w.game.world.entities.get(caught, C.Item)?.occupantId ?? 0).toBe(0);
    expect(items.countAvailable({ type: cage })).toBe(1);
    expect(items.countAvailable({ unoccupied: true, type: cage })).toBe(1);
  }, 120_000);
});
