/**
 * Defence year scenario script (T-151, Milestone 8):
 * Traps, a gate, a trained squad, a raid repelled.
 */

import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { C } from '@core/components';
import { TileKind, TileFlag } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { DefenseReader } from '@systems/defense';
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
  bridgeRaised: boolean;
  bridgeLowered: boolean;
  trapModeSet: boolean;
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
  placeEconomyBuilding(w, state.fortress, 'wood_furnace', -16, 10);

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

  // 7. Place drawbridge at (cx + 6, cy + 11, Z) = (35, 15, Z)
  if (state.drawbridgeId === 0) {
    const tBridge = w.index(cx + 6, cy + 11, Z);
    if (!buildings.at(tBridge) && w.map.kindAt(tBridge) === TileKind.Floor) {
      const r = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'drawbridge',
        origin: tBridge,
        width: 1,
        height: 1,
        orientation: 0,
        materialChoice: 0,
        priority: 1,
      });
      if (r.ok) {
        state.drawbridgeId = bSystem.lastPlacedBuilding;
        console.log(`Drawbridge placed at tick ${w.tick}`);
      }
    }
  }

  // 8. Place lever at (cx + 4, cy + 6, Z) = (33, 10, Z)
  if (state.leverId === 0) {
    const tLever = w.index(cx + 4, cy + 6, Z);
    if (!buildings.at(tLever) && w.map.kindAt(tLever) === TileKind.Floor) {
      const r = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'lever',
        origin: tLever,
        orientation: 0,
        materialChoice: 0,
        priority: 1,
      });
      if (r.ok) {
        state.leverId = bSystem.lastPlacedBuilding;
        console.log(`Lever placed at tick ${w.tick}`);
      }
    }
  }

  // 9. Place Traps along corridor
  if (!state.trapsPlaced) {
    const tStone = w.index(cx + 6, cy + 8, Z);
    const tWeapon = w.index(cx + 6, cy + 9, Z);
    const tCage = w.index(cx + 6, cy + 10, Z);

    if (state.stoneFallTrapId === 0 && !buildings.at(tStone) && w.map.kindAt(tStone) === TileKind.Floor) {
      const r = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'stone_fall_trap',
        origin: tStone,
        orientation: 0,
        materialChoice: 0,
        priority: 1,
      });
      if (r.ok) {
        state.stoneFallTrapId = bSystem.lastPlacedBuilding;
        console.log(`Stone-fall trap placed at tick ${w.tick}`);
      }
    }

    if (state.weaponTrapId === 0 && !buildings.at(tWeapon) && w.map.kindAt(tWeapon) === TileKind.Floor) {
      const r = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'weapon_trap',
        origin: tWeapon,
        orientation: 0,
        materialChoice: 0,
        priority: 1,
      });
      if (r.ok) {
        state.weaponTrapId = bSystem.lastPlacedBuilding;
        console.log(`Weapon trap placed at tick ${w.tick}`);
      }
    }

    if (state.cageTrapId === 0 && !buildings.at(tCage) && w.map.kindAt(tCage) === TileKind.Floor) {
      const r = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'cage_trap',
        origin: tCage,
        orientation: 0,
        materialChoice: 0,
        priority: 1,
      });
      if (r.ok) {
        state.cageTrapId = bSystem.lastPlacedBuilding;
        console.log(`Cage trap placed at tick ${w.tick}`);
      }
    }

    if (state.stoneFallTrapId !== 0 && state.weaponTrapId !== 0 && state.cageTrapId !== 0) {
      state.trapsPlaced = true;
    }
  }

  // 10. Link lever to drawbridge once both are built
  if (state.leverId !== 0 && state.drawbridgeId !== 0 && !state.leverLinked) {
    const leverB = buildings.get(state.leverId);
    const bridgeB = buildings.get(state.drawbridgeId);
    if (leverB?.state === 'built' && bridgeB?.state === 'built') {
      const items = w.readers.of<ItemsReader>('13');
      if (items.count('mechanism') > 0 && !leverB.linkedIds.includes(state.drawbridgeId)) {
        w.game.world.applyCommand({
          type: 'LinkMechanism',
          sourceId: state.leverId,
          targetId: state.drawbridgeId,
        });
      }
      if (leverB.linkedIds.includes(state.drawbridgeId)) {
        state.leverLinked = true;
        console.log(`Lever linked to drawbridge at tick ${w.tick}`);
      }
    }
  }

  // 11. Pull lever once linked
  if (state.leverLinked && !state.leverPulled) {
    const rPull = w.game.world.applyCommand({
      type: 'PullLever',
      leverId: state.leverId,
    });
    if (rPull.ok) {
      state.leverPulled = true;
      console.log(`PullLever (to raise) issued at tick ${w.tick}`);
    }
  }

  // Check bridge raising and lower it back down
  if (state.leverPulled && !state.bridgeRaised && buildings.mechanismState(state.drawbridgeId) === 'raised') {
    state.bridgeRaised = true;
    console.log(`Drawbridge raised at tick ${w.tick}`);
    const rLower = w.game.world.applyCommand({
      type: 'PullLever',
      leverId: state.leverId,
    });
    if (rLower.ok) {
      console.log(`PullLever (to lower) issued at tick ${w.tick}`);
    }
  }

  if (state.bridgeRaised && !state.bridgeLowered && buildings.mechanismState(state.drawbridgeId) === 'lowered') {
    state.bridgeLowered = true;
    console.log(`Drawbridge lowered at tick ${w.tick}`);
  }

  // 12. SetTrapMode on stone_fall_trap once built
  if (!state.trapModeSet && state.stoneFallTrapId !== 0 && buildings.get(state.stoneFallTrapId)?.state === 'built') {
    const rMode = w.game.world.applyCommand({
      type: 'SetTrapMode',
      trapId: state.stoneFallTrapId,
      mode: 'enemies',
    });
    if (rMode.ok) {
      state.trapModeSet = true;
      console.log(`SetTrapMode on stone_fall_trap issued at tick ${w.tick}`);
    }
  }

  // 13. Form squad of 4 with a leader once barracks zone exists and day >= 25
  if (!state.squadFormed && state.barracksZoneId !== 0 && w.tick >= 25 * TICKS_PER_DAY) {
    const combat = w.readers.of<CombatReader>('16');
    const adultDwarves = w.game.world.entities.with(C.Labors).filter((id) => {
      const c = w.game.world.entities.get(id, C.Creature);
      return c?.faction === 'fortress';
    });

    if (adultDwarves.length >= 4) {
      // Ensure Dwarf 1 and 2 have civilian labors enabled
      if (adultDwarves[1]) {
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: adultDwarves[1], labor: 'mechanics', on: true });
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: adultDwarves[1], labor: 'hauling', on: true });
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: adultDwarves[1], labor: 'smithing', on: true });
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: adultDwarves[1], labor: 'masonry', on: true });
      }
      if (adultDwarves[2]) {
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: adultDwarves[2], labor: 'mechanics', on: true });
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: adultDwarves[2], labor: 'hauling', on: true });
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: adultDwarves[2], labor: 'smithing', on: true });
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: adultDwarves[2], labor: 'masonry', on: true });
      }

      const rSquad = w.game.world.applyCommand({ type: 'CreateSquad', name: 'Iron Guard' });
      if (rSquad.ok) {
        state.squadId = combat.squads().find((s) => s.name === 'Iron Guard')?.id ?? 0;
        const members = adultDwarves.slice(3, 7);
        if (members.length < 4) {
          members.push(...adultDwarves.slice(0, 4 - members.length));
        }
        w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: state.squadId, members });
        for (const m of members) {
          w.game.world.applyCommand({ type: 'SetLabor', dwarfId: m, labor: 'woodcutting', on: false });
          w.game.world.applyCommand({ type: 'SetLabor', dwarfId: m, labor: 'mining', on: false });
        }
        w.game.world.applyCommand({ type: 'SetSquadLeader', squadId: state.squadId, leaderId: members[0]! });
        w.game.world.applyCommand({
          type: 'SetSquadEquipment',
          squadId: state.squadId,
          equipment: { weaponClass: 'sword', armor: 'metal' },
        });
        w.game.world.applyCommand({
          type: 'SetZoneSetting',
          zoneId: state.barracksZoneId,
          key: 'squad',
          value: state.squadId,
        });
        if (state.archeryRangeZoneId !== 0) {
          w.game.world.applyCommand({
            type: 'SetZoneSetting',
            zoneId: state.archeryRangeZoneId,
            key: 'squad',
            value: state.squadId,
          });
        }
        w.game.world.applyCommand({ type: 'SetSquadMode', squadId: state.squadId, mode: 'train' });
        state.squadFormed = true;
        console.log(`Squad formed with ${members.length} members at tick ${w.tick}`);
      }
    }
  }

  // Ensure archery range is assigned to squad if created later
  if (state.squadId !== 0 && state.archeryRangeZoneId !== 0) {
    const rangeZone = buildings.zone(state.archeryRangeZoneId);
    if (rangeZone && rangeZone.settings['squad'] !== state.squadId) {
      w.game.world.applyCommand({
        type: 'SetZoneSetting',
        zoneId: state.archeryRangeZoneId,
        key: 'squad',
        value: state.squadId,
      });
    }
  }

  if (state.squadFormed && state.squadId !== 0) {
    const combat = w.readers.of<CombatReader>('16');
    const squad = combat.squad(state.squadId);
    if (squad && squad.mode !== 'train') {
      w.game.world.applyCommand({ type: 'SetSquadMode', squadId: state.squadId, mode: 'train' });
    }
  }
}

export function runDefenceYear(): void {
  const w = threeYearsWorld('defence-year', 2);
  setupDefenceYear(w);

  const fortressState = setupThreeYearsFortress(w);
  const { cx, cy } = fortressState;
  const buildings = w.readers.of<BuildingsReader>('14');

  w.game.world.onEvents((events) => {
    for (const e of events) {
      if (e.type === 'CreatureDied') {
        console.log(`[DEATH] tick ${w.tick} (day ${Math.floor(w.tick / TICKS_PER_DAY)}) id ${e['id']} name ${e['name']} cause ${e['cause']} killer ${e['killerId']} tile ${e['tile']}`);
      }
    }
  });

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
    bridgeRaised: false,
    bridgeLowered: false,
    trapModeSet: false,
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

  // Remove distant tree designations created by setupThreeYearsFortress so dwarves don't wander into wolf territory
  const distantTrees: number[] = [];
  for (let y = 0; y < w.map.h; y++) {
    for (let x = 0; x < w.map.w; x++) {
      if (x < cx - 2 || x > cx + 10 || y < cy - 2 || y > cy + 18) {
        const t = w.index(x, y, Z);
        if (w.map.kindAt(t) === TileKind.Tree) {
          distantTrees.push(t);
        }
      }
    }
  }
  if (distantTrees.length > 0) {
    const rUndo = w.game.world.applyCommand({ type: 'UndoDesignation', tiles: distantTrees });
    console.log(`UndoDesignation for ${distantTrees.length} distant trees:`, rUndo);
  }

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

  // Step up to Day 35 and manage workshop orders and training
  const stage3Ticks = 35 * TICKS_PER_DAY;
  while (w.tick < stage3Ticks) {
    stepThreeYears(w, Math.min(100, stage3Ticks - w.tick));
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
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_training_sword', mode: 'maintain', threshold: 2, priority: 1 },
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

    const wfId = fortressState.placedIds['wood_furnace'];
    if (wfId && buildings.get(wfId)?.state === 'built') {
      if (!fortressState.orderedWorkshops.has('wood_furnace')) {
        fortressState.orderedWorkshops.add('wood_furnace');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: wfId,
          order: { recipeId: 'make_charcoal', mode: 'maintain', threshold: 10, priority: 1 },
        });
        console.log(`Wood furnace work order added at tick ${w.tick}`);
      }
    }

    const forgeId = fortressState.placedIds['forge'];
    if (forgeId && buildings.get(forgeId)?.state === 'built') {
      if (!fortressState.orderedWorkshops.has('forge_defence')) {
        fortressState.orderedWorkshops.add('forge_defence');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: forgeId,
          order: { recipeId: 'forge_short_sword', mode: 'maintain', threshold: 4, priority: 1 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: forgeId,
          order: { recipeId: 'forge_mail_shirt', mode: 'maintain', threshold: 4, priority: 1 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: forgeId,
          order: { recipeId: 'forge_helm', mode: 'maintain', threshold: 4, priority: 1 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: forgeId,
          order: { recipeId: 'forge_greaves', mode: 'maintain', threshold: 4, priority: 1 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: forgeId,
          order: { recipeId: 'forge_shield', mode: 'maintain', threshold: 4, priority: 1 },
        });
        console.log(`Forge defence work orders added at tick ${w.tick}`);
      }
    }
  }

  console.log(`Tick ${w.tick} reached (Day ${Math.floor(w.tick / TICKS_PER_DAY)}).`);
  console.log(`Drawbridge: ${state.drawbridgeId}, state: ${buildings.get(state.drawbridgeId)?.state}, mechState: ${buildings.mechanismState(state.drawbridgeId)}`);
  console.log(`Lever: ${state.leverId}, state: ${buildings.get(state.leverId)?.state}, linked: ${state.leverLinked}, pulled: ${state.leverPulled}`);
  console.log(`Stone-fall trap: ${state.stoneFallTrapId}, state: ${buildings.get(state.stoneFallTrapId)?.state}`);
  console.log(`Cage trap: ${state.cageTrapId}, state: ${buildings.get(state.cageTrapId)?.state}`);
  console.log(`Weapon trap: ${state.weaponTrapId}, state: ${buildings.get(state.weaponTrapId)?.state}`);

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

  // Stage 2 Assertions
  expect(state.drawbridgeId).toBeGreaterThan(0);
  expect(buildings.get(state.drawbridgeId)?.state).toBe('built');
  expect(state.leverId).toBeGreaterThan(0);
  expect(buildings.get(state.leverId)?.state).toBe('built');
  expect(state.stoneFallTrapId).toBeGreaterThan(0);
  expect(buildings.get(state.stoneFallTrapId)?.state).toBe('built');
  expect(state.cageTrapId).toBeGreaterThan(0);
  expect(buildings.get(state.cageTrapId)?.state).toBe('built');
  expect(state.weaponTrapId).toBeGreaterThan(0);
  expect(buildings.get(state.weaponTrapId)?.state).toBe('built');
  expect(state.leverLinked).toBe(true);
  expect(w.events('MechanismTriggered').some((e) => e['sourceId'] === state.leverId)).toBe(true);
  expect(state.bridgeRaised).toBe(true);
  expect(w.readers.of<DefenseReader>('19').trapMode(state.stoneFallTrapId)).toBe('enemies');

  // Stage 3 Assertions
  expect(state.squadId).toBeGreaterThan(0);
  expect(state.squadFormed).toBe(true);
  const combat = w.readers.of<CombatReader>('16');
  const squad = combat.squads().find((s) => s.id === state.squadId);
  expect(squad).toBeDefined();
  expect(squad?.members.length).toBe(4);
  expect(squad?.leaderId).toBeGreaterThan(0);
  expect(squad?.mode).toBe('train');

  // Verify training sessions occurred
  const trainingEvents = w.events('TrainingSession');
  console.log(`TrainingSession events count: ${trainingEvents.length}`);
  expect(trainingEvents.length).toBeGreaterThan(0);

  // Verify at least one squad member's weapon skill rose
  const members = squad?.members ?? [];
  const swordSkillIdx = w.game.registry.table('skills').index('sword');
  const skillsWithGains = members.map((m) => {
    const skills = w.game.world.entities.get(m, C.Skills);
    const equip = w.game.world.entities.get(m, C.Equipment);
    return {
      id: m,
      swordXp: skills?.xp[swordSkillIdx] ?? 0,
      swordLevel: skills?.level[swordSkillIdx] ?? 0,
      weapon: equip?.weapon ?? 0,
    };
  });
  console.log('Squad members combat stats:', JSON.stringify(skillsWithGains));

  const gainedWeaponSkill = skillsWithGains.some((s) => s.swordXp > 0 || s.swordLevel > 0);
  expect(gainedWeaponSkill).toBe(true);
}
