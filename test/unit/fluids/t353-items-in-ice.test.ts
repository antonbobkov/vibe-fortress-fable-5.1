/** T-353: ammunition lying in a pond that freezes stays inside the ice, which the checker accepts. */
import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';
import { digPond } from '../../scenarios/pond';
import { checkInvariants } from '../../scenarios/invariants';

describe('T-353 bolts in a pond that freezes into an ice wall', () => {
  it('stay on their tile inside the ice and report no inside-wall finding; a stone wall still does', () => {
    const w = new TestWorld({ seed: 't353-ice', world: 'flat-test', surfaceWildlife: 'none' });
    const [pond] = digPond(w, 7) as [number];
    const bolts = w.spawnItem('bolt', 'iron', pond, 10);
    w.forceTemperature(pond, -20);
    w.step(30);
    expect(w.fluids.sim.isFrozen(pond)).toBe(true);
    expect(w.map.kindAt(pond)).toBe(TileKind.Wall);
    expect(w.readers.of<{ tileOf(id: number): number }>('13').tileOf(bolts)).toBe(pond);
    expect(checkInvariants(w.game).filter((f) => f.inv === 'item.inside-wall')).toEqual([]);
    // An item in a wall of rock is still a fault.
    const rock = w.index(30, 30, w.map.zOf(pond) - 3);
    expect(w.map.kindAt(rock)).toBe(TileKind.Wall);
    w.spawnItem('bolt', 'iron', rock, 1);
    expect(checkInvariants(w.game).map((f) => f.inv)).toContain('item.inside-wall');
  });
});
