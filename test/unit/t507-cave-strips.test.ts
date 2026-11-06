import { describe, expect, it } from 'vitest';
import { caveStripTiles } from '../scenarios/three_years_economy';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';

/**
 * T-507: on `three-years-p0-3` the cave farm lies west of the stair (T-455's slope rule), and the
 * cave strips for bought cave seed were laid east of it, in solid rock: every dig stayed blocked
 * `unreachable` for three years and 186 dimcap seed waited in stock while 67 dwarves starved.
 */
describe('T-507 the three-year script digs its cave strips beside the cave farm', () => {
  for (const seed of ['three-years-p0-3', 'three-years-p0-1']) {
    it(`${seed}: each strip is joined to the farm or an earlier strip`, () => {
      const w = threeYearsWorld(seed, 0);
      const state = setupThreeYearsFortress(w);
      const map = w.map;
      const side = map.xOf(state.caveTiles1[0]!) < state.cx + 6 ? 'west' : 'east';
      if (seed === 'three-years-p0-3') expect(side).toBe('west');
      const reached = new Set([...state.caveTiles1, ...state.caveTiles2]);
      const sizes: number[] = [];
      for (let n = 0; n < 4; n += 1) {
        const tiles = caveStripTiles(w, state, n);
        sizes.push(tiles.length);
        // Joined: a flood from the farm through the strip reaches every tile of it.
        const left = new Set(tiles);
        let grew = true;
        while (grew) {
          grew = false;
          for (const t of left) if (map.neighbors8(t).some((b) => reached.has(b))) { reached.add(t); left.delete(t); grew = true; }
        }
        expect([...left], `${seed} strip ${n} (${side}) tiles not joined to the farm`).toEqual([]);
        state.economy.cavePlans.push({ tiles, zoneId: -1 });
      }
      // The first strip, the one bought seed is sown in, is a whole 8 x 4 block of rock beside the farm.
      expect(sizes[0], `${seed} (${side}) strip sizes ${sizes.join(', ')}`).toBeGreaterThanOrEqual(16);
    }, 120_000);
  }
});
