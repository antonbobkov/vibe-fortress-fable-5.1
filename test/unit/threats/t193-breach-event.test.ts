import { describe, expect, it } from 'vitest';
import { regionSpec } from '@app/headless';
import { C } from '@core/components';
import { CAVERN_BANDS } from '@systems/terrain/api';
import { TestWorld } from '../../scenarios/test-world';

describe('T-193 cavern breach announces the newly awakened monsters', () => {
  it('delivers one MonsterSpawned per living sleeper of that cavern, without repeat events', () => {
    const w = new TestWorld({ seed: 'descent', world: 'local', embark: 'none',
      spec: regionSpec('descent', { wealth: 3, peril: 1, geology: 'igneous' }) });
    const entities = w.game.world.entities;
    const sleepers = (tier: number) => entities.with(C.Hostile, C.Position).filter((id) => {
      const hostile = entities.get(id, C.Hostile)!;
      const z = entities.get(id, C.Position)!.z;
      const band = CAVERN_BANDS[tier]!;
      return hostile.role === 'cavern_monster' && hostile.behaviorState === 'asleep'
        && z >= band[0] && z <= band[1];
    });
    const first = sleepers(1);
    const second = sleepers(2);
    expect(first.length).toBeGreaterThan(2);
    expect(second.length).toBeGreaterThan(0);
    // Dead and previously awakened monsters are not new arrivals at this breach.
    entities.destroy(first[0]!);
    entities.get(first[1]!, C.Hostile)!.behaviorState = 'wander';
    const awakened = first.slice(2);
    w.game.world.emit({ type: 'CavernBreached', cavern: 1, tile: w.index(23, 45, 19) });
    w.step(1);
    expect(w.events('MonsterSpawned')).toHaveLength(0);
    for (const id of awakened) expect(entities.get(id, C.Hostile)?.behaviorState).not.toBe('asleep');
    w.step(1);
    const events = w.events('MonsterSpawned');
    expect(events.map((event) => event['id']).sort((a, b) => Number(a) - Number(b)))
      .toEqual([...awakened].sort((a, b) => a - b));
    expect(events.every((event) => event['cavern'] === 1)).toBe(true);
    for (const id of awakened) expect(entities.get(id, C.Hostile)?.behaviorState).not.toBe('asleep');
    for (const id of second) expect(entities.get(id, C.Hostile)?.behaviorState).toBe('asleep');

    w.game.world.emit({ type: 'CavernBreached', cavern: 1, tile: w.index(23, 45, 19) });
    w.step(2);
    expect(w.events('MonsterSpawned')).toHaveLength(awakened.length);

    w.game.world.emit({ type: 'CavernBreached', cavern: 2, tile: w.index(23, 45, 10) });
    w.step(2);
    expect(w.events('MonsterSpawned').filter((event) => event['cavern'] === 2)
      .map((event) => event['id']).sort((a, b) => Number(a) - Number(b)))
      .toEqual([...second].sort((a, b) => a - b));
    expect(w.events('MonsterSpawned')).toHaveLength(awakened.length + second.length);
  });
});
