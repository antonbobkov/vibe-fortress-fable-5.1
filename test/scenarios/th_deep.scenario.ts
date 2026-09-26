/**
 * `th_deep` of `04-implementation/acceptance-tests.md` § 18 Threats:
 * "mine 5 deepsilver tiles | DeepStirred { 1 }; 3 hollow_crawler emerge adjacent to the last mined tile"
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { LOCAL_MAP_H, LOCAL_MAP_W } from '@core/constants';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';
import { onlyMiner } from './m1-helpers';

const Z = FLAT_TEST_SURFACE_Z;
const Y = 30;
const START_X = 30;
const TILE_COUNT = 5;

const deepsilverTiles: TileIndex[] = [];

const scenario: Scenario = {
  id: 'th_deep',
  milestone: 6,
  seed: 'th-deep',
  world: 'flat-test',
  embark: 'default',
  setup: (w: TestWorld) => {
    onlyMiner(w);
    const ore = w.game.registry.table('materials').index('deepsilver_ore');
    const granite = w.game.registry.table('materials').index('granite');
    deepsilverTiles.length = 0;

    // Lay 5 deepsilver wall tiles in a line
    for (let i = 0; i < TILE_COUNT; i++) {
      const tile = w.index(START_X + i, Y, Z);
      w.game.world.services.terrain.setKind(tile, TileKind.Wall, ore);
      w.game.world.services.terrain.setFlag(tile, TileFlag.Discovered, true);
      deepsilverTiles.push(tile);
    }

    // Lay walls around the last deepsilver tile (START_X + 4) so rock surrounds it
    const lastX = START_X + TILE_COUNT - 1;
    const surrounding = [
      w.index(lastX + 1, Y, Z),
      w.index(lastX, Y + 1, Z),
      w.index(lastX, Y - 1, Z),
      w.index(lastX + 1, Y + 1, Z),
      w.index(lastX + 1, Y - 1, Z),
    ];
    for (const t of surrounding) {
      w.game.world.services.terrain.setKind(t, TileKind.Wall, granite);
      w.game.world.services.terrain.setFlag(t, TileFlag.Discovered, true);
    }

    // Ensure tile before first deepsilver tile is floor so miner can stand there
    const entry = w.index(START_X - 1, Y, Z);
    w.game.world.services.terrain.setKind(entry, TileKind.Floor, granite);
  },
  commands: [
    { tick: 0, command: { type: 'ConfirmDeepsilver' } },
    {
      tick: 1,
      command: {
        type: 'Designate',
        tiles: [
          (Z * LOCAL_MAP_H + Y) * LOCAL_MAP_W + START_X,
          (Z * LOCAL_MAP_H + Y) * LOCAL_MAP_W + (START_X + 1),
          (Z * LOCAL_MAP_H + Y) * LOCAL_MAP_W + (START_X + 2),
          (Z * LOCAL_MAP_H + Y) * LOCAL_MAP_W + (START_X + 3),
          (Z * LOCAL_MAP_H + Y) * LOCAL_MAP_W + (START_X + 4),
        ],
        kind: 'dig',
        priority: 4,
      },
    },
  ],
  run: (w: TestWorld) => {
    // Step until 5 deepsilver tiles have been mined
    w.until((world) => world.events('DeepsilverMined').length >= 5, 5_000);
    // Step 1 more tick so events emitted in handle during the last tick are drained and delivered
    w.step(1);

    // Assert 5 DeepsilverMined events
    const minedEvents = w.events('DeepsilverMined');
    expect(minedEvents.length).toBeGreaterThanOrEqual(5);

    // Assert DeepStirred { level: 1 } emitted
    const stirredEvents = w.events('DeepStirred');
    expect(stirredEvents).toHaveLength(1);
    expect(stirredEvents[0]!['level']).toBe(1);

    // Assert MonsterEmerged emitted with 3 creatures adjacent to the last mined tile
    const emergedEvents = w.events('MonsterEmerged');
    expect(emergedEvents).toHaveLength(1);
    const emergedIds = emergedEvents[0]!['ids'] as EntityId[];
    expect(emergedIds).toHaveLength(3);

    const lastMinedTile = deepsilverTiles[TILE_COUNT - 1]!;
    const lastX = w.map.xOf(lastMinedTile);
    const lastY = w.map.yOf(lastMinedTile);
    const lastZ = w.map.zOf(lastMinedTile);

    // Each emerged creature is a hollow_crawler with faction 'deep'
    const speciesTable = w.game.registry.table<{ id: string }>('creatures');
    const crawlerIdx = speciesTable.index('hollow_crawler');

    for (const id of emergedIds) {
      const creature = w.game.world.entities.get(id, C.Creature);
      expect(creature).toBeDefined();
      expect(creature!.species).toBe(crawlerIdx);
      expect(creature!.faction).toBe('deep');

      // Emerged adjacent to the last mined tile (Chebyshev distance <= 2 in 3D)
      const pos = w.game.world.entities.get(id, C.Position);
      expect(pos).toBeDefined();
      const dist = Math.max(Math.abs(pos!.x - lastX), Math.abs(pos!.y - lastY)) + Math.abs(pos!.z - lastZ);
      expect(dist).toBeLessThanOrEqual(2);
    }
  },
};

export default scenario;
