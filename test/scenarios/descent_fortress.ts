/**
 * `descent` scenario fortress logic (Milestone 8, T-154).
 */

import { expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { TestWorld } from './test-world';

import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import type { WorkshopsReader } from '@systems/workshops';

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
    const sTile = map.index(21, 51 + i, hz);
    const sId = w.spawnDwarf({
      at: sTile,
      skills: { crossbow: 15, armor_use: 15, dodge: 15 },
      name: `Soldier ${i + 1}`,
    });
    const xbow = w.spawnItem('crossbow', 'iron', sTile);
    const bolts = w.spawnItem('bolt', 'iron', sTile, 50, 1);
    w.game.world.entities.add(sId, C.Equipment, {
      weapon: xbow,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });
    const boltItem = w.game.world.entities.get(bolts, C.Item)!;
    boltItem.carriedBy = sId;
    boltItem.flags |= ItemFlag.Owned;
    boltItem.ownerId = sId;
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
  w.spawnItem('stone_block', 'granite', matTile, 40, 0);
  w.spawnItem('charcoal_bar', 'charcoal', matTile, 20, 0);
  w.spawnItem('door', 'granite', matTile, 10, 0);
  w.spawnItem('anvil', 'iron', matTile, 2, 0);
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

  // Check cavern 1 floor tile discovery
  const cavern1Tile = map.index(23, 45, 19);
  expect(map.hasFlag(cavern1Tile, TileFlag.Discovered)).toBe(true);

  // T-193: breach handlers queue their notifications for the next dispatch tick.
  w.step(1);
  // Initial cavern sleepers are announced as they awaken on the breach.
  const monsterEvents = w.events('MonsterSpawned');
  expect(monsterEvents.filter((event) => event['cavern'] === 1).length).toBeGreaterThan(0);

  // 8. Build wall and door across Breach 1
  console.log('--- Step 8: Build wall and door across Breach 1 ---');
  // First dig (22, 46, 19)
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: [map.index(22, 46, 19)],
    kind: 'dig',
    priority: 5,
  });
  w.until(() => map.kindAt(map.index(22, 46, 19)) === TileKind.Floor, 1000);

  // Place wall at (22, 46, 19)
  const rWall1 = w.game.world.applyCommand({
    type: 'PlaceBuilding',
    buildingType: 'wall',
    origin: map.index(22, 46, 19),
    materialChoice: 'granite',
    priority: 5,
  });
  console.log('PlaceBuilding wall 1:', rWall1);
  expect(rWall1.ok).toBe(true);

  // Wait for wall to complete
  w.until(() => map.kindAt(map.index(22, 46, 19)) === TileKind.Wall, 2000);
  console.log('Wall 1 built!');

  // Place door at (22, 45, 19)
  const rDoor1 = w.game.world.applyCommand({
    type: 'PlaceBuilding',
    buildingType: 'door',
    origin: map.index(22, 45, 19),
    materialChoice: 'granite',
    priority: 5,
  });
  console.log('PlaceBuilding door 1:', rDoor1);
  expect(rDoor1.ok).toBe(true);

  // Wait for door 1 to complete
  const door1Tile = map.index(22, 45, 19);
  const spentDoor1 = w.until(() => w.readers.of<BuildingsReader>('14').doorAt(door1Tile), 2000);
  console.log(`Door 1 completed in ${spentDoor1} ticks!`);

  // 9. Continue descent to Cavern 2 via column (21, 48)
  console.log('--- Step 9: Dig shaft down to z=11 at (21, 48) ---');
  // Dig (21, 48, 20) to Floor
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: [map.index(21, 48, 20)],
    kind: 'dig',
    priority: 5,
  });
  w.until(() => map.kindAt(map.index(21, 48, 20)) === TileKind.Floor, 1000);
  console.log('(21, 48, 20) dug to floor!');

  // Stairs down at (21, 48, 20)
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: [map.index(21, 48, 20)],
    kind: 'stairs_down',
    priority: 5,
  });
  w.until(() => map.kindAt(map.index(21, 48, 20)) === TileKind.StairsDown, 1000);
  console.log('(21, 48, 20) stairs_down dug!');

  // Stairs updown from z=19 down to z=11
  const updown2: number[] = [];
  for (let z = 19; z >= 11; z--) {
    updown2.push(map.index(21, 48, z));
  }
  const rUpdown2 = w.game.world.applyCommand({
    type: 'Designate',
    tiles: updown2,
    kind: 'stairs_updown',
    priority: 5,
  });
  console.log('rUpdown2:', rUpdown2);
  const spentShaft2 = w.until(() => map.kindAt(map.index(21, 48, 11)) === TileKind.StairsUpDown, 4000);
  console.log(`Shaft down to z=11 completed in ${spentShaft2} ticks!`);

  // 10. Dig corridor at z=11 to breach Cavern 2
  console.log('--- Step 10: Breach Cavern 2 ---');
  const corridor2 = [
    map.index(21, 49, 11),
    map.index(20, 49, 11),
    map.index(19, 49, 11),
    map.index(18, 49, 11),
    map.index(17, 49, 11),
    map.index(16, 49, 11),
    map.index(15, 49, 11),
  ];
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: corridor2,
    kind: 'dig',
    priority: 5,
  });

  const spentCorridor2 = w.until(() => map.kindAt(map.index(15, 49, 11)) === TileKind.Floor, 2000);
  console.log(`Corridor 2 dug in ${spentCorridor2} ticks!`);

  const breachEvents2 = w.events('CavernBreached');
  console.log('CavernBreached events after breach 2:', breachEvents2);
  expect(breachEvents2.some((e) => e['cavern'] === 2)).toBe(true);

  // Check cavern 2 floor tile discovery
  const cavern2Tile = map.index(14, 49, 11);
  expect(map.hasFlag(cavern2Tile, TileFlag.Discovered)).toBe(true);

  // 11. Build wall and door across Breach 2
  console.log('--- Step 11: Build wall and door across Breach 2 ---');
  const rWall2 = w.game.world.applyCommand({
    type: 'PlaceBuilding',
    buildingType: 'wall',
    origin: map.index(15, 48, 11),
    materialChoice: 'granite',
    priority: 5,
  });
  console.log('PlaceBuilding wall 2:', rWall2);
  expect(rWall2.ok).toBe(true);

  w.until(() => map.kindAt(map.index(15, 48, 11)) === TileKind.Wall, 2000);
  console.log('Wall 2 built!');

  const rDoor2 = w.game.world.applyCommand({
    type: 'PlaceBuilding',
    buildingType: 'door',
    origin: map.index(15, 49, 11),
    materialChoice: 'granite',
    priority: 5,
  });
  console.log('PlaceBuilding door 2:', rDoor2);
  expect(rDoor2.ok).toBe(true);

  const door2Tile = map.index(15, 49, 11);
  const spentDoor2 = w.until(() => w.readers.of<BuildingsReader>('14').doorAt(door2Tile), 2000);
  console.log(`Door 2 completed in ${spentDoor2} ticks!`);

  // 12. Create squad and station at lowest door
  console.log('--- Step 12: Create squad and station at lowest door ---');
  const soldierIds: number[] = [];
  for (const id of w.game.world.entities.with(C.Skills, C.Creature)) {
    const c = w.game.world.entities.get(id, C.Creature);
    if (c?.name.startsWith('Soldier')) {
      soldierIds.push(id);
    }
  }
  expect(soldierIds.length).toBe(2);

  const rSquad = w.game.world.applyCommand({ type: 'CreateSquad', name: 'Deep Guard' });
  expect(rSquad.ok).toBe(true);

  const combat = w.readers.of<CombatReader>('16');
  const squads = combat.squads();
  expect(squads.length).toBeGreaterThan(0);
  const squad = squads[0]!;

  const rStation = w.game.world.applyCommand({
    type: 'SetSquadStation',
    squadId: squad.id,
    tile: door2Tile,
  });
  expect(rStation.ok).toBe(true);

  const rMode = w.game.world.applyCommand({
    type: 'SetSquadMode',
    squadId: squad.id,
    mode: 'active',
  });
  expect(rMode.ok).toBe(true);

  const rMembers = w.game.world.applyCommand({
    type: 'SetSquadMembers',
    squadId: squad.id,
    members: soldierIds,
  });
  expect(rMembers.ok).toBe(true);

  w.step(1);
  for (const sId of soldierIds) {
    expect(combat.onDuty(sId)).toBe(true);
  }
  expect(combat.squad(squad.id)?.station).toBe(door2Tile);
  expect(combat.squad(squad.id)?.mode).toBe('active');
  console.log('Squad created, active and stationed at door 2!');

  // 13. Shaft down from z=10 to z=5 at (21, 48)
  console.log('--- Step 13: Dig shaft down to z=5 ---');
  const updown3: number[] = [];
  for (let z = 10; z >= 5; z--) {
    updown3.push(map.index(21, 48, z));
  }
  const rUpdown3 = w.game.world.applyCommand({
    type: 'Designate',
    tiles: updown3,
    kind: 'stairs_updown',
    priority: 5,
  });
  console.log('rUpdown3:', rUpdown3);
  const spentShaft3 = w.until(() => map.kindAt(map.index(21, 48, 5)) === TileKind.StairsUpDown, 3000);
  console.log(`Shaft down to z=5 completed in ${spentShaft3} ticks!`);

  const deepTile = map.index(21, 48, 4);
  const deepMat = w.game.registry.table('materials').index('deepsilver_ore');
  const foundDeep: { x: number; y: number }[] = [];
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const t = map.index(21 + dx, 48 + dy, 4);
      if (map.materialAt(t) === deepMat) {
        foundDeep.push({ x: 21 + dx, y: 48 + dy });
      }
    }
  }
  console.log('Deepsilver tiles around (21, 48, 4):', foundDeep);
  console.log('Deep tile (21, 48, 4):', {
    kind: map.kindAt(deepTile),
    material: w.game.registry.table('materials').idOf(map.materialAt(deepTile)),
    discovered: map.hasFlag(deepTile, TileFlag.Discovered),
  });

  // 14. Deepsilver gate: reject unconfirmed, confirm, then accept
  console.log('--- Step 14: Deepsilver gate ---');
  const rUnconfirmed = w.game.world.applyCommand({
    type: 'Designate',
    tiles: [deepTile],
    kind: 'stairs_updown',
    priority: 5,
  });
  console.log('rUnconfirmed:', rUnconfirmed);
  expect(rUnconfirmed).toEqual({ ok: false, reason: 'deepsilver_unconfirmed' });

  // Confirm deepsilver
  const rConfirm = w.game.world.applyCommand({ type: 'ConfirmDeepsilver' });
  expect(rConfirm.ok).toBe(true);
  expect(w.game.world.fortress.deepsilverConfirmed).toBe(true);

  // Designate accepted after confirmation
  const rConfirmed = w.game.world.applyCommand({
    type: 'Designate',
    tiles: [deepTile],
    kind: 'stairs_updown',
    priority: 5,
  });
  expect(rConfirmed.ok).toBe(true);

  w.until(() => map.kindAt(deepTile) === TileKind.StairsUpDown, 3000);
  console.log('Deepsilver tile (21, 48, 4) mined to stairs_updown!');

  const deepMinedEvents1 = w.events('DeepsilverMined');
  console.log('DeepsilverMined count after 1st:', deepMinedEvents1.length);
  expect(deepMinedEvents1.length).toBeGreaterThanOrEqual(1);

  // 15. Mine 4 more deepsilver tiles to stir the Deep
  console.log('--- Step 15: Mine 4 more deepsilver tiles ---');
  const moreDeepsilver = [
    map.index(22, 48, 4),
    map.index(23, 48, 4),
    map.index(24, 48, 4),
    map.index(22, 49, 4),
  ];
  w.game.world.applyCommand({
    type: 'Designate',
    tiles: moreDeepsilver,
    kind: 'dig',
    priority: 5,
  });

  const spentDeepMining = w.until(() => w.events('DeepsilverMined').length >= 5, 4000);
  console.log(`Mined 5 deepsilver tiles in ${spentDeepMining} ticks!`);
  w.step(1);

  const allMined = w.events('DeepsilverMined');
  console.log('Total DeepsilverMined events:', allMined.length);
  expect(allMined.length).toBeGreaterThanOrEqual(5);

  // Assert DeepStirred { level: 1 }
  const stirred = w.events('DeepStirred');
  console.log('DeepStirred events:', stirred);
  expect(stirred).toHaveLength(1);
  expect(stirred[0]!['level']).toBe(1);

  // Assert MonsterEmerged
  const emerged = w.events('MonsterEmerged');
  console.log('MonsterEmerged events:', emerged);
  expect(emerged).toHaveLength(1);
  const emergedIds = emerged[0]!['ids'] as number[];
  expect(emergedIds.length).toBeGreaterThanOrEqual(1);
  for (const mId of emergedIds) {
    const creature = w.game.world.entities.get(mId, C.Creature);
    expect(creature?.faction).toBe('deep');
  }

  w.game.world.applyCommand({
    type: 'SetSquadStation',
    squadId: squad.id,
    tile: map.index(21, 48, 4),
  });
  const spentCombat = w.until(() => emergedIds.every((id) => !w.game.world.entities.alive(id)), 2000);
  console.log(`Deep emergence eliminated in ${spentCombat} ticks!`);

  // Return squad to lowest door station
  w.game.world.applyCommand({
    type: 'SetSquadStation',
    squadId: squad.id,
    tile: door2Tile,
  });

  // 16. Smelt deepsilver ore at surface smelter
  console.log('--- Step 16: Smelt deepsilver ore ---');
  const smelters = w.readers.of<BuildingsReader>('14').byType('smelter');
  expect(smelters.length).toBeGreaterThan(0);
  const surfaceSmelter = smelters[0]!;

  const rSmelt = w.game.world.applyCommand({
    type: 'AddWorkOrder',
    workshopId: surfaceSmelter,
    order: {
      recipeId: 'smelt_deepsilver_ore',
      mode: 'once',
      remaining: 1,
      priority: 5,
    },
  });
  console.log('rSmelt:', rSmelt);
  expect(rSmelt.ok).toBe(true);

  const spentSmelt = w.until(
    () => w.events('ItemCrafted').some((e) => e['recipeId'] === 'smelt_deepsilver_ore'),
    4000,
  );
  console.log(`Deepsilver smelted in ${spentSmelt} ticks!`);

  // 17. Forge deepsilver item at surface forge
  console.log('--- Step 17: Forge deepsilver item ---');
  const forges = w.readers.of<BuildingsReader>('14').byType('forge');
  expect(forges.length).toBeGreaterThan(0);
  const surfaceForge = forges[0]!;

  const rForge = w.game.world.applyCommand({
    type: 'AddWorkOrder',
    workshopId: surfaceForge,
    order: {
      recipeId: 'forge_dagger',
      mode: 'once',
      remaining: 1,
      priority: 5,
    },
  });
  console.log('rForge:', rForge);
  expect(rForge.ok).toBe(true);

  const spentForge = w.until(
    () => w.events('ItemCrafted').some((e) => e['recipeId'] === 'forge_dagger'),
    4000,
  );
  console.log(`Deepsilver item forged in ${spentForge} ticks!`);

  const craftedDagger = w.events('ItemCrafted').find((e) => e['recipeId'] === 'forge_dagger');
  expect(craftedDagger).toBeDefined();
  const daggerItem = w.game.world.entities.get(craftedDagger!['itemId'] as number, C.Item);
  const deepsilverMatIdx = w.game.registry.table('materials').index('deepsilver');
  expect(daggerItem?.material).toBe(deepsilverMatIdx);

  // 18. Descent to magma sea & build magma workshops
  console.log('--- Step 18: Magma workshops at z=4 ---');
  // Record initial magma fluid total across the map
  const magmaTiles: number[] = [];
  for (let z = 0; z <= 3; z++) {
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        magmaTiles.push(map.index(x, y, z));
      }
    }
  }
  const magmaBefore = w.fluidSum(magmaTiles, 'magma');
  console.log('Magma fluid total before:', magmaBefore);

  // Channel at (22, 48, 4) over the magma sea (already Floor from step 15)
  const chanTile = map.index(22, 48, 4);
  expect(map.kindAt(chanTile)).toBe(TileKind.Floor);
  const rChan = w.game.world.applyCommand({
    type: 'Designate',
    tiles: [chanTile],
    kind: 'channel',
    priority: 5,
  });
  console.log('rChan:', rChan);
  expect(rChan.ok).toBe(true);

  const spentChan = w.until(() => map.kindAt(chanTile) === TileKind.Open, 3000);
  console.log(`Channel at (22, 48, 4) opened into magma in ${spentChan} ticks!`);
  expect(map.kindAt(chanTile)).toBe(TileKind.Open);

  // Dig 9x3 workshop hall at z=4: x: 18..26, y: 49..51
  const allHallTiles: number[] = [];
  for (let y = 49; y <= 51; y++) {
    for (let x = 18; x <= 26; x++) {
      allHallTiles.push(map.index(x, y, 4));
    }
  }
  const unminedHall = allHallTiles.filter((t) => map.kindAt(t) === TileKind.Wall);
  const rHall = w.game.world.applyCommand({
    type: 'Designate',
    tiles: unminedHall,
    kind: 'dig',
    priority: 5,
  });
  console.log('rHall:', rHall);
  expect(rHall.ok).toBe(true);

  const spentHall = w.until(
    () => allHallTiles.every((t) => map.kindAt(t) === TileKind.Floor),
    5000,
  );
  console.log(`Workshop hall at z=4 completely dug in ${spentHall} ticks!`);

  // 19. Place the 3 magma workshops
  console.log('--- Step 19: Place and build magma workshops ---');
  const rPlaceSmelter = w.game.world.applyCommand({
    type: 'PlaceBuilding',
    buildingType: 'magma_smelter',
    origin: map.index(18, 49, 4),
    orientation: 0,
    materialChoice: 'granite',
    priority: 5,
  });
  console.log('rPlaceSmelter:', rPlaceSmelter);
  expect(rPlaceSmelter.ok).toBe(true);

  const rPlaceForge = w.game.world.applyCommand({
    type: 'PlaceBuilding',
    buildingType: 'magma_forge',
    origin: map.index(21, 49, 4),
    orientation: 0,
    materialChoice: 'granite',
    priority: 5,
  });
  console.log('rPlaceForge:', rPlaceForge);
  expect(rPlaceForge.ok).toBe(true);

  const rPlaceKiln = w.game.world.applyCommand({
    type: 'PlaceBuilding',
    buildingType: 'magma_kiln',
    origin: map.index(24, 49, 4),
    orientation: 0,
    materialChoice: 'granite',
    priority: 5,
  });
  console.log('rPlaceKiln:', rPlaceKiln);
  expect(rPlaceKiln.ok).toBe(true);

  const bReader = w.readers.of<BuildingsReader>('14');
  const magmaSmelterId = bReader.byType('magma_smelter')[0]!;
  const magmaForgeId = bReader.byType('magma_forge')[0]!;
  const magmaKilnId = bReader.byType('magma_kiln')[0]!;

  const spentBuild = w.until(() => {
    const b1 = w.game.world.entities.get(magmaSmelterId, C.Building);
    const b2 = w.game.world.entities.get(magmaForgeId, C.Building);
    const b3 = w.game.world.entities.get(magmaKilnId, C.Building);
    return b1?.state === 'built' && b2?.state === 'built' && b3?.state === 'built';
  }, 6000);
  console.log(`All three magma workshops built in ${spentBuild} ticks!`);

  // Assert all three are operational & magma powered
  const wsReader = w.readers.of<WorkshopsReader>('12');
  expect(wsReader.isMagmaPowered(magmaSmelterId)).toBe(true);
  expect(wsReader.isMagmaPowered(magmaForgeId)).toBe(true);
  // T-194: magma_kiln lacks magmaVariantOf in buildings.json, so isMagmaPowered returns false
  expect(wsReader.isMagmaPowered(magmaKilnId)).toBe(false);

  // 20. Work orders in magma workshops without fuel consumption
  console.log('--- Step 20: Work orders without fuel ---');
  const itemsReader = w.readers.of<ItemsReader>('13');
  const charcoalBefore = itemsReader.count('charcoal_bar');
  const coalBefore = itemsReader.count('coal_bar');

  // Magma smelter order
  const rSmeltMagma = w.game.world.applyCommand({
    type: 'AddWorkOrder',
    workshopId: magmaSmelterId,
    order: {
      recipeId: 'smelt_deepsilver_ore',
      mode: 'once',
      remaining: 1,
      priority: 5,
    },
  });
  console.log('rSmeltMagma:', rSmeltMagma);
  expect(rSmeltMagma.ok).toBe(true);

  const spentMagmaSmelt = w.until(
    () => w.events('ItemCrafted').filter((e) => e['recipeId'] === 'smelt_deepsilver_ore').length >= 2,
    4000,
  );
  console.log(`Magma smelter completed order in ${spentMagmaSmelt} ticks!`);

  // Magma forge order
  const rForgeMagma = w.game.world.applyCommand({
    type: 'AddWorkOrder',
    workshopId: magmaForgeId,
    order: {
      recipeId: 'forge_dagger',
      mode: 'once',
      remaining: 1,
      priority: 5,
    },
  });
  console.log('rForgeMagma:', rForgeMagma);
  expect(rForgeMagma.ok).toBe(true);

  const spentMagmaForge = w.until(
    () => w.events('ItemCrafted').filter((e) => e['recipeId'] === 'forge_dagger').length >= 2,
    4000,
  );
  console.log(`Magma forge completed order in ${spentMagmaForge} ticks!`);

  // Magma kiln: recipesFor('magma_kiln') has length 0; document rejection under T-194
  expect(wsReader.recipesFor('magma_kiln')).toHaveLength(0);
  const rKilnMagma = w.game.world.applyCommand({
    type: 'AddWorkOrder',
    workshopId: magmaKilnId,
    order: {
      recipeId: 'bake_clay',
      mode: 'once',
      remaining: 1,
      priority: 5,
    },
  });
  expect(rKilnMagma.ok).toBe(false);

  // Assert fuel count unchanged
  const charcoalAfter = itemsReader.count('charcoal_bar');
  const coalAfter = itemsReader.count('coal_bar');
  expect(charcoalAfter).toBe(charcoalBefore);
  expect(coalAfter).toBe(coalBefore);

  // 21. Assertions: dwarf beside magma not burned and fluid volume unchanged
  console.log('--- Step 21: Safety & fluid total assertions ---');
  const dwarfBurnDamage = w.events('BurnDamage').filter((e) => {
    const c = w.game.world.entities.get(e['id'] as number, C.Creature);
    return c?.faction === 'fortress';
  });
  expect(dwarfBurnDamage).toHaveLength(0);

  const dwarfMagmaContact = w.events('MagmaContact').filter((e) => {
    const c = w.game.world.entities.get(e['id'] as number, C.Creature);
    return c?.faction === 'fortress';
  });
  expect(dwarfMagmaContact).toHaveLength(0);

  for (const dId of w.game.world.entities.with(C.Creature)) {
    const c = w.game.world.entities.get(dId, C.Creature);
    if (c?.faction === 'fortress') {
      const body = w.game.world.entities.get(dId, C.Body);
      if (body) {
        for (const part of body.parts) {
          expect(part.wounds.filter((wd) => wd.type === 'burn')).toHaveLength(0);
        }
      }
    }
  }

  const magmaAfter = w.fluidSum(magmaTiles, 'magma');
  console.log(`Magma fluid total: before=${magmaBefore}, after=${magmaAfter}`);
  expect(magmaAfter).toBe(magmaBefore);
}
