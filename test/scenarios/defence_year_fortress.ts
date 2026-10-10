/**
 * Defence year scenario script (T-151, Milestone 8):
 * Traps, a gate, a trained squad, a raid repelled.
 */

import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind, TileFlag } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { ItemsReader } from '@systems/items';
import type { TestWorld } from './test-world';
import {
  threeYearsWorld,
  setupThreeYearsFortress,
  checkFortressWorkOrders,
  checkFortressRooms,
  checkFortressCaveFarm,
  Z,
  HALL_Z,
  type FortressState,
} from './three_years_fortress';
import { placeEconomyBuilding } from './three_years_economy';
import { stepThreeYears } from './three_years_measurements';

export interface DefenceYearState {
  readonly fortress: FortressState;
  archeryTargetId: number;
  archeryRangeZoneId: number;
  barracksZoneId: number;
  leverId: number;
  drawbridgeId: number;
  gateDoorId: number;
  gateDoorPlaced: boolean;
  cageTrapId: number;
  weaponTrapId: number;
  stoneFallTrapId: number;
  trapsPlaced: boolean;
  leverLinked: boolean;
  leverPulled: boolean;
  squadId: number;
  squadFormed: boolean;
  wallIds: number[];
  fortificationIds: number[];
  placedWallTiles: Set<number>;
  placedFortTiles: Set<number>;
}

export function setupDefenceYear(w: TestWorld): void {
  const arrival = w.game.arrival;
  if (!arrival) throw new Error('defence_year: no arrival');
  const { x: cx, y: cy } = arrival.wagon;

  // Supply raw materials near the wagon per brief instructions:
  // "spawnItem for raw materials only"
  const supplyTile = w.index(cx + 1, cy + 1, Z);
  w.spawnItem('raw_stone', 'granite', supplyTile, 80);
  w.spawnItem('log', 'oak', supplyTile, 60);
  w.spawnItem('bar', 'iron', supplyTile, 50);
  w.spawnItem('plant_food', 'dimcap', supplyTile, 80);
  w.spawnItem('drink', 'ale', supplyTile, 80);
}

export function checkDefenceYearBuildings(w: TestWorld, state: DefenceYearState): void {
  const { cx, cy } = state.fortress;
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  // 1. Place workshops using placeEconomyBuilding
  placeEconomyBuilding(w, state.fortress, 'mechanic', -12, 10);
  placeEconomyBuilding(w, state.fortress, 'forge', 12, 10);

  // 2. Gate Walls and Fortifications flanking corridor leading South from stairwell (cx + 6, cy + 6)
  const wallTiles = [
    w.index(cx + 5, cy + 5, Z), // (34, 9)
    w.index(cx + 7, cy + 5, Z), // (36, 9)
    w.index(cx + 5, cy + 6, Z), // (34, 10)
    w.index(cx + 7, cy + 6, Z), // (36, 10)
    w.index(cx + 5, cy + 7, Z), // (34, 11) - West door support
    w.index(cx + 7, cy + 7, Z), // (36, 11) - East door support
    w.index(cx + 5, cy + 8, Z), // (34, 12)
    w.index(cx + 5, cy + 9, Z), // (34, 13)
    w.index(cx + 5, cy + 10, Z), // (34, 14)
    w.index(cx + 5, cy + 11, Z), // (34, 15)
  ];
  const fortTiles = [
    w.index(cx + 7, cy + 8, Z), // (36, 12)
    w.index(cx + 7, cy + 9, Z), // (36, 13)
    w.index(cx + 7, cy + 10, Z), // (36, 14)
    w.index(cx + 7, cy + 11, Z), // (36, 15)
  ];

  for (const origin of wallTiles) {
      if (!state.placedWallTiles.has(origin)) {
        const bAt = buildings.at(origin);
        const kAt = w.map.kindAt(origin);
        if (!bAt && kAt === TileKind.Floor) {
          const r = w.game.world.applyCommand({
            type: 'PlaceBuilding',
            buildingType: 'wall',
            origin,
            orientation: 0,
            materialChoice: 0,
            priority: 1, // High priority to complete gate walls
          });
          if (r.ok) {
            state.placedWallTiles.add(origin);
            state.wallIds.push(bSystem.lastPlacedBuilding);
          }
        }
      }
    }

    for (const origin of fortTiles) {
      if (!state.placedFortTiles.has(origin)) {
        if (!buildings.at(origin) && w.map.kindAt(origin) === TileKind.Floor) {
          const r = w.game.world.applyCommand({
            type: 'PlaceBuilding',
            buildingType: 'fortification',
            origin,
            orientation: 0,
            materialChoice: 0,
            priority: 1,
          });
          if (r.ok) {
            state.placedFortTiles.add(origin);
            state.fortificationIds.push(bSystem.lastPlacedBuilding);
          }
        }
      }
    }

  // 3. Gate Door: placed at (cx + 6, cy + 7, Z) once supporting West wall (cx + 5, cy + 7) and East wall (cx + 7, cy + 7) are built
  if (!state.gateDoorPlaced) {
    const tWest = w.index(cx + 5, cy + 7, Z);
    const tEast = w.index(cx + 7, cy + 7, Z);
    const tDoor = w.index(cx + 6, cy + 7, Z);
    if (w.map.kindAt(tWest) === TileKind.Wall && w.map.kindAt(tEast) === TileKind.Wall && w.map.kindAt(tDoor) === TileKind.Floor) {
      const rDoor = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'door',
        origin: tDoor,
        orientation: 0,
        materialChoice: 0,
        priority: 1,
      });
      if (rDoor.ok) {
        state.gateDoorPlaced = true;
        state.gateDoorId = bSystem.lastPlacedBuilding;
        console.log(`Gate door placed at tick ${w.tick}`);
      } else {
        console.log(`Gate door place failed:`, rDoor, `ghost:`, buildings.ghost('door', tDoor, 0));
      }
    }
  }

  // Set door mode to lock_on_alert once built
  if (state.gateDoorId && buildings.get(state.gateDoorId)?.state === 'built') {
    const d = buildings.get(state.gateDoorId);
    if (d && d.mode !== 'lock_on_alert') {
      w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: state.gateDoorId, mode: 'lock_on_alert' });
      console.log(`Gate door set to lock_on_alert at tick ${w.tick}`);
    }
  }

  // 4. Archery target: place once crafted
  if (state.archeryTargetId === 0) {
    const items = w.readers.of<ItemsReader>('13');
    if (items.count('archery_target') > 0) {
      for (let dy = 1; dy <= 6; dy++) {
        for (let dx = 2; dx <= 7; dx++) {
          const t = w.index(cx + dx, cy + dy, Z);
          if (buildings.ghost('archery_target', t, 0).reason === null && buildings.zoneAt(t) === 0) {
            const r = w.game.world.applyCommand({
              type: 'PlaceBuilding',
              buildingType: 'archery_target',
              origin: t,
              orientation: 0,
              materialChoice: 0,
              priority: 1,
            });
            if (r.ok) {
              state.archeryTargetId = bSystem.lastPlacedBuilding;
              console.log(`Archery target placed at (${w.map.xOf(t)}, ${w.map.yOf(t)}) at tick ${w.tick}`);
              break;
            }
          }
        }
        if (state.archeryTargetId !== 0) break;
      }
    }
  }

  // 5. Archery range zone around target
  if (state.archeryRangeZoneId === 0 && state.archeryTargetId !== 0) {
    const targetB = buildings.get(state.archeryTargetId);
    if (targetB) {
      const t = targetB.origin;
      const rangeTiles = [t];
      for (const offset of [-1, 1]) {
        const adj = w.index(w.map.xOf(t) + offset, w.map.yOf(t), Z);
        if (buildings.zoneTileQualifies('archery_range', adj) && buildings.zoneAt(adj) === 0) {
          rangeTiles.push(adj);
        }
      }
      const r = w.game.world.applyCommand({
        type: 'CreateZone',
        zoneType: 'archery_range',
        tiles: rangeTiles,
      });
      if (r.ok) {
        state.archeryRangeZoneId = bSystem.lastCreatedZone;
        console.log(`Archery range zone created at tick ${w.tick}`);
      }
    }
  }

  // 6. Barracks zone on clean floor tiles
  if (state.barracksZoneId === 0) {
    const barracksTiles: number[] = [];
    for (let y = cy + 1; y <= cy + 3; y++) {
      for (let x = cx + 3; x <= cx + 5; x++) {
        const t = w.index(x, y, Z);
        if (buildings.zoneTileQualifies('barracks', t) && buildings.zoneAt(t) === 0) {
          barracksTiles.push(t);
        }
      }
    }
    if (barracksTiles.length >= 4) {
      const r = w.game.world.applyCommand({
        type: 'CreateZone',
        zoneType: 'barracks',
        tiles: barracksTiles,
      });
      if (r.ok) {
        state.barracksZoneId = bSystem.lastCreatedZone;
        console.log(`Barracks zone created at tick ${w.tick} with ${barracksTiles.length} tiles`);
      }
    }
  }
}

export function runDefenceYear(): void {
  const w = threeYearsWorld('defence-year', 2);
  setupDefenceYear(w);

  const fortressState = setupThreeYearsFortress(w);
  const { cx, cy } = fortressState;
  const buildings = w.readers.of<BuildingsReader>('14');

  const state: DefenceYearState = {
    fortress: fortressState,
    archeryTargetId: 0,
    archeryRangeZoneId: 0,
    barracksZoneId: 0,
    leverId: 0,
    drawbridgeId: 0,
    gateDoorId: 0,
    gateDoorPlaced: false,
    cageTrapId: 0,
    weaponTrapId: 0,
    stoneFallTrapId: 0,
    trapsPlaced: false,
    leverLinked: false,
    leverPulled: false,
    squadId: 0,
    squadFormed: false,
    wallIds: [],
    fortificationIds: [],
    placedWallTiles: new Set<number>(),
    placedFortTiles: new Set<number>(),
  };

  // Enable mechanics, smithing, carpentry, masonry, and cleaning labor priorities
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'mechanics', priority: 1 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'carpentry', priority: 1 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'masonry', priority: 1 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'construction', priority: 2 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'smithing', priority: 2 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'cleaning', priority: 2 });

  // Chop trees in the defense area (x = cx + 4..cx + 8, y = cy + 4..cy + 16)
  const treesToChop: number[] = [];
  for (let y = cy + 4; y <= cy + 16; y++) {
    for (let x = cx + 4; x <= cx + 8; x++) {
      const t = w.index(x, y, Z);
      if (w.map.kindAt(t) === TileKind.Tree) treesToChop.push(t);
    }
  }
  if (treesToChop.length > 0) {
    w.game.world.applyCommand({ type: 'Designate', kind: 'chop', priority: 1, tiles: treesToChop });
  }

  // Initial placement of defense buildings and workshops before economy workshops can claim tiles
  checkDefenceYearBuildings(w, state);

  // Step for 25 days and manage workshop orders
  const bootstrapTicks = 25 * TICKS_PER_DAY;
  while (w.tick < bootstrapTicks) {
    stepThreeYears(w, Math.min(100, bootstrapTicks - w.tick));
    checkDefenceYearBuildings(w, state);
    checkFortressWorkOrders(w, fortressState);
    checkFortressRooms(w, fortressState);
    checkFortressCaveFarm(w, fortressState);

    // Workshop work orders
    const carpenterId = fortressState.placedIds['carpenter'];
    if (carpenterId && buildings.get(carpenterId)?.state === 'built') {
      if (!fortressState.orderedWorkshops.has('carpenter_defence')) {
        fortressState.orderedWorkshops.add('carpenter_defence');
        console.log(`Carpenter defence work orders added at tick ${w.tick}`);
        // Priority 1 for target, door and cage
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_archery_target', mode: 'once', remaining: 1, priority: 1 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_door_wood', mode: 'maintain', threshold: 4, priority: 1 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_cage_wood', mode: 'maintain', threshold: 3, priority: 1 },
        });
      }
    }

    const masonId = fortressState.placedIds['mason'];
    if (masonId && buildings.get(masonId)?.state === 'built') {
      if (!fortressState.orderedWorkshops.has('mason_defence')) {
        fortressState.orderedWorkshops.add('mason_defence');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: masonId,
          order: { recipeId: 'make_stone_block', mode: 'maintain', threshold: 30, priority: 1 },
        });
      }
    }

    const mechId = fortressState.placedIds['mechanic'];
    if (mechId && buildings.get(mechId)?.state === 'built') {
      if (!fortressState.orderedWorkshops.has('mechanic')) {
        fortressState.orderedWorkshops.add('mechanic');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: mechId,
          order: { recipeId: 'make_mechanism', mode: 'maintain', threshold: 10, priority: 1 },
        });
        console.log(`Mechanic work order added at tick ${w.tick}`);
      }
    }
  }

  console.log(`Tick ${w.tick} reached (Day ${Math.floor(w.tick / TICKS_PER_DAY)}).`);
  console.log(`Carpenter: ${fortressState.placedIds['carpenter']}, state: ${buildings.get(fortressState.placedIds['carpenter'] ?? 0)?.state}`);
  console.log(`Archery target item count: ${w.readers.of<ItemsReader>('13').count('archery_target')}`);
  console.log(`Mechanic workshop: ${fortressState.placedIds['mechanic']}, state: ${buildings.get(fortressState.placedIds['mechanic'] ?? 0)?.state}`);
  console.log(`Forge workshop: ${fortressState.placedIds['forge']}, state: ${buildings.get(fortressState.placedIds['forge'] ?? 0)?.state}`);
  console.log(`Gate door: ${state.gateDoorId}, state: ${buildings.get(state.gateDoorId)?.state}, mode: ${buildings.get(state.gateDoorId)?.mode}`);
  console.log(`Walls built: ${state.wallIds.filter((id) => buildings.get(id)?.state === 'built').length} / ${state.wallIds.length}`);
  console.log(`Fortifications built: ${state.fortificationIds.filter((id) => buildings.get(id)?.state === 'built').length} / ${state.fortificationIds.length}`);
  console.log(`Archery target: ${state.archeryTargetId}, state: ${buildings.get(state.archeryTargetId)?.state}`);
  console.log(`Archery range zone: ${state.archeryRangeZoneId}, Barracks zone: ${state.barracksZoneId}`);

  // Stage 1 Assertions
  expect(fortressState.placedIds['mechanic']).toBeDefined();
  expect(buildings.get(fortressState.placedIds['mechanic']!)?.state).toBe('built');
  expect(state.wallIds.length).toBeGreaterThan(0);
  expect(state.wallIds.filter((id) => buildings.get(id)?.state === 'built').length).toBeGreaterThanOrEqual(6);
  expect(state.fortificationIds.length).toBeGreaterThan(0);
  expect(state.fortificationIds.filter((id) => buildings.get(id)?.state === 'built').length).toBeGreaterThanOrEqual(1);
  expect(state.archeryTargetId).toBeGreaterThan(0);
  expect(buildings.get(state.archeryTargetId)?.state).toBe('built');
  expect(state.archeryRangeZoneId).toBeGreaterThan(0);
  expect(state.barracksZoneId).toBeGreaterThan(0);
}
