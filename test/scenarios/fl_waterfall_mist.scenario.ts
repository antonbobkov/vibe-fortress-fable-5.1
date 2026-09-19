/**
 * `fl_waterfall_mist` of `04-implementation/acceptance-tests.md` § 04 Fluids: "a channel dropping 3
 * levels onto a floor, source-fed | `MistProduced`; `isMisty` true on the 3×3 landing area; mud set
 * on the landing floor".
 *
 * A ten-tile tunnel one level under the `flat-test` surface (z 31) runs from a water source to a
 * shaft that drops three levels onto the granite floor of a 3 × 3 room at z 28.
 */

import { expect } from 'vitest';
import { TileFlag } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { FluidsReader } from '@systems/fluids';
import type { Scenario } from './runner';
import { digWaterfall, type Waterfall } from './waterfall';

let fall: Waterfall | null = null;

const scenario: Scenario = {
  id: 'fl_waterfall_mist',
  milestone: 3,
  seed: 'fl-waterfall-mist',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    fall = digWaterfall(w, 30, 40, 31, 10, 3);
  },
  run: (w) => {
    const f = fall as Waterfall;
    const took = w.until((ww) => ww.events('MistProduced').length > 0, 600);
    expect(took).toBeLessThan(600);
    const reader = w.readers.of<FluidsReader>('04');
    const x = w.map.xOf(f.landing);
    const y = w.map.yOf(f.landing);
    const z = w.map.zOf(f.landing);
    const area: TileIndex[] = [];
    for (let dz = 0; dz <= 1; dz += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) area.push(w.index(x + dx, y + dy, z + dz));
    for (const t of area) expect(reader.isMisty(t)).toBe(true);
    const produced = w.events('MistProduced')[0]?.['tiles'] as TileIndex[];
    expect([...produced].sort((a, b) => a - b)).toEqual([...area].sort((a, b) => a - b));
    expect(w.map.hasFlag(f.landing, TileFlag.Mud)).toBe(true);
    // A tile away from the landing is not misty.
    expect(reader.isMisty(w.index(x + 5, y, z))).toBe(false);
  },
};

export default scenario;
