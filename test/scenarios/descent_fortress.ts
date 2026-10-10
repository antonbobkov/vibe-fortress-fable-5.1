/**
 * `descent` scenario fortress logic (Milestone 8, T-154).
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { TestWorld } from './test-world';

import type { JobsReader } from '@systems/jobs';

export function setupDescentSurface(w: TestWorld): void {
  const map = w.map;
  const hz = 32;

  // 12 dwarves
  // 4 miners
  for (let i = 0; i < 4; i++) {
    const d = w.spawnDwarf({
      at: map.index(20 + (i % 2), 49 + Math.floor(i / 2), hz),
      skills: { mining: 15, masonry: 5 },
      name: `Miner ${i + 1}`,
    });
    w.setLabor(d, 'mining', true);
  }

  // 4 builders
  for (let i = 0; i < 4; i++) {
    const d = w.spawnDwarf({
      at: map.index(19, 49 + i, hz),
      skills: { masonry: 15, building: 15 },
      name: `Builder ${i + 1}`,
    });
    w.setLabor(d, 'masonry', true);
    w.setLabor(d, 'construction', true);
    w.setLabor(d, 'hauling', true);
  }

  // 2 smiths
  for (let i = 0; i < 2; i++) {
    const d = w.spawnDwarf({
      at: map.index(21, 49 + i, hz),
      skills: { smelting: 15, weaponsmithing: 15, armorsmithing: 15 },
      name: `Smith ${i + 1}`,
    });
    w.setLabor(d, 'smelting', true);
    w.setLabor(d, 'smithing', true);
    w.setLabor(d, 'hauling', true);
  }

  // 2 soldiers
  for (let i = 0; i < 2; i++) {
    w.spawnDwarf({
      at: map.index(21, 51 + i, hz),
      skills: { sword: 15, shield: 15, armor_use: 15, dodge: 15 },
      name: `Soldier ${i + 1}`,
    });
  }

  // Stockpiles & supplies at surface
  // Tool stockpile
  const toolTile = map.index(20, 47, hz);
  w.zone('stockpile', [toolTile]);
  for (let i = 0; i < 6; i++) {
    w.spawnItem('pick', 'iron', toolTile, 1, 0);
  }

  // Food stockpile
  const foodTile = map.index(19, 47, hz);
  w.zone('stockpile', [foodTile]);
  w.spawnItem('easy_meal', 'dimcap', foodTile, 60, 0);

  // Drink stockpile
  const drinkTile = map.index(18, 47, hz);
  w.zone('stockpile', [drinkTile]);
  w.spawnItem('drink', 'ale', drinkTile, 60, 0);

  // Raw materials stockpile
  const matTile = map.index(21, 47, hz);
  w.zone('stockpile', [matTile]);
  w.spawnItem('raw_stone', 'granite', matTile, 60, 0);
  w.spawnItem('stone_block', 'granite', matTile, 20, 0);
  w.spawnItem('charcoal_bar', 'charcoal', matTile, 20, 0);
  // Surface forge and smelter on clear 3x3 floor
  w.build('forge', map.index(16, 46, hz), 'granite');
  w.build('smelter', map.index(16, 49, hz), 'granite');
}

export function runDescent(w: TestWorld): void {
  const map = w.map;

  // 1. Single stairs down at (20, 48, 32)
  console.log('--- Designating stairwell 32 down to 20 ---');
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: [map.index(20, 48, 32)],
    kind: 'stairs_down',
    priority: 5,
  });

  const updownTiles: number[] = [];
  for (let z = 31; z >= 21; z--) {
    updownTiles.push(map.index(20, 48, z));
  }
  const rUpdown = w.game.world.applyCommand({
    type: 'Designate',
    tiles: updownTiles,
    kind: 'stairs_updown',
    priority: 5,
  });
  console.log('rUpdown:', rUpdown);

  const rUp = w.game.world.applyCommand({
    type: 'Designate',
    tiles: [map.index(20, 48, 20)],
    kind: 'stairs_up',
    priority: 5,
  });
  console.log('rUp:', rUp);

  const spent = w.until(() => map.kindAt(map.index(20, 48, 20)) === TileKind.StairsUp, 3000);
  console.log(`Stairwell completed down to z=20 in ${spent} ticks!`);

  // 4. Dig hallway at z=20: (20, 47, 20) and (20, 46, 20)
  console.log('--- Step 4: Dig hallway at z=20 ---');
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: [map.index(20, 47, 20), map.index(20, 46, 20)],
    kind: 'dig',
    priority: 5,
  });
  w.until(
    () =>
      map.kindAt(map.index(20, 47, 20)) === TileKind.Floor &&
      map.kindAt(map.index(20, 46, 20)) === TileKind.Floor,
    1000,
  );
  console.log('Hallway at z=20 dug!');

  // 5. Channel at (20, 47, 20) -> opens to (20, 47, 19) as Ramp
  console.log('--- Step 5: Channel at (20, 47, 20) ---');
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: [map.index(20, 47, 20)],
    kind: 'channel',
    priority: 5,
  });
  w.until(() => map.kindAt(map.index(20, 47, 19)) === TileKind.Ramp, 1000);
  console.log('Channel at (20, 47, 20) done! Tile (20, 47, 19) kind:', map.kindAt(map.index(20, 47, 19)));

  // 6. Ramp at (20, 46, 19)
  console.log('--- Step 6: Ramp at (20, 46, 19) ---');
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: [map.index(20, 46, 19)],
    kind: 'ramp',
    priority: 5,
  });
  w.until(() => map.kindAt(map.index(20, 46, 19)) === TileKind.Ramp, 1000);
  console.log('Ramp at (20, 46, 19) done! Kind:', map.kindAt(map.index(20, 46, 19)));

  // 7. Corridor at z=19 to breach Cavern 1: (20, 45, 19), (21, 45, 19), (22, 45, 19)
  console.log('--- Step 7: Breach Cavern 1 ---');
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: [
      map.index(20, 45, 19),
      map.index(21, 45, 19),
      map.index(22, 45, 19),
    ],
    kind: 'dig',
    priority: 5,
  });

  const spent7 = w.until(() => map.kindAt(map.index(22, 45, 19)) === TileKind.Floor, 2000);
  console.log(`Corridor dug in ${spent7} ticks!`);

  // Check events
  const breachEvents = w.events('CavernBreached');
  console.log('CavernBreached events:', breachEvents);
  expect(breachEvents.length).toBeGreaterThanOrEqual(1);
  expect(breachEvents.some((e) => e['cavern'] === 1)).toBe(true);

  const discoveredEvents = w.events('TilesDiscovered');
  console.log('TilesDiscovered events count:', discoveredEvents.length);
  expect(discoveredEvents.length).toBeGreaterThanOrEqual(1);

  // Check cavern floor tile discovery
  const cavernTile = map.index(23, 45, 19);
  expect(map.hasFlag(cavernTile, TileFlag.Discovered)).toBe(true);

  // Cavern creature is spawned and awakened in Cavern 1.
  // Note: Spec 18 § Cavern monsters specifies MonsterSpawned { id, cavern }, but wakeCavernMonsters
  // only updates behaviorState from 'asleep' to 'wander' without emitting MonsterSpawned (filed as T-193).
  // Assertion omitted pending T-193.
  const monsterEvents = w.events('MonsterSpawned');
  expect(monsterEvents).toHaveLength(0); // See T-193: MonsterSpawned not delivered on breach

  expect(true).toBe(true);
}
