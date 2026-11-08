import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { TileFlag, TileKind } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';

/** T-528: a dwarf keeps `retreat` only while the alert is `hearth`; it drops it in the tick the alert falls. */
function sheltered() {
  const w = new TestWorld({ seed: 'three-years-p2-1', map: buildFlatTestMap(contentRegistry(), 48, 48), embark: 'none' });
  const dwarf = w.spawnDwarf({ at: w.index(36, 0, 32) });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 36) w.game.world.services.terrain.setKind(w.index(x, 2, 32), TileKind.Wall, granite);
  w.build('door', w.index(36, 2, 32), 'oak');
  w.build('hearth', w.index(36, 6, 32), 'granite');
  for (let y = 3; y < 9; y += 1) for (let x = 34; x < 39; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, 32), TileFlag.Outdoor, false);
  w.step(1);
  const brain = () => w.game.world.entities.get(dwarf, C.Brain);
  return { w, dwarf, brain };
}

describe('T-528 retreat ends with the alert', () => {
  it('a sheltering dwarf has left retreat by the end of the tick the alert falls', () => {
    const { w, brain } = sheltered();
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.until(() => brain()?.behavior === 'retreat', 30);
    expect(brain()?.behavior).toBe('retreat');
    // The alert falls by a command queued for the next tick, as a player's is.
    w.game.world.submit({ type: 'SetAlert', level: 'calm' });
    w.step(1);
    expect(w.game.world.fortress.alert).toBe('calm');
    expect(brain()?.behavior).not.toBe('retreat');
  });

  it('does not keep retreat while the alert is down when it is unconscious', () => {
    const { w, dwarf, brain } = sheltered();
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.until(() => brain()?.behavior === 'retreat', 30);
    const body = w.game.world.entities.get(dwarf, C.Body);
    if (!body) throw new Error('missing body');
    w.game.world.entities.add(dwarf, C.Body, { ...body, conscious: false });
    w.game.world.submit({ type: 'SetAlert', level: 'calm' });
    w.step(1);
    expect(w.game.world.fortress.alert).toBe('calm');
    expect(w.game.world.entities.get(dwarf, C.Body)?.conscious).toBe(false);
    expect(brain()?.behavior).not.toBe('retreat');
    // On waking it chooses afresh.
    const downed = w.game.world.entities.get(dwarf, C.Body);
    if (!downed) throw new Error('missing body');
    w.game.world.entities.add(dwarf, C.Body, { ...downed, conscious: true });
    w.step(3);
    expect(brain()?.behavior).not.toBe('retreat');
  });
});
