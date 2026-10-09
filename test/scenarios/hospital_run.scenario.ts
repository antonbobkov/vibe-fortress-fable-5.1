/**
 * `hospital_run` scenario (Milestone 8, F-09d / T-152):
 * A 30-day playthrough on flat-test with Balanced embark.
 * Fortress built by player commands (workshops, work orders, hospital zone, tomb zone, well, memorial slab).
 * Casualties created by simulation (hostile raid party on day 5 and fire beside a dwarf).
 * All wounded survivors admitted, diagnosed, treated, and discharged; dead buried in tomb.
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import type { FireContext } from '@systems/materials/fire';
import type { MoraleReader } from '@systems/morale';
import { spawnHostileMember } from '@systems/threats';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const Z = FLAT_TEST_SURFACE_Z;

const scenario: Scenario = {
  id: 'hospital_run',
  milestone: 8,
  seed: 'hospital-run',
  world: 'flat-test',
  embark: 'default',
  timeoutMs: 300_000,
  setup: (w: TestWorld) => {
    const arrival = w.game.arrival;
    if (!arrival) throw new Error('hospital_run: no arrival');
    const { x: cx, y: cy } = arrival.wagon;

    // Cistern pit below future well tile (cx - 2, cy + 2)
    const wellWaterTile = w.index(cx - 2, cy + 2, Z - 1);
    const granite = w.game.registry.table('materials').index('granite');
    w.carve(wellWaterTile, TileKind.Floor, granite);
    w.setFluid(wellWaterTile, 7, 'water', true);

    // Spawn raw materials near wagon so crafting stays swift and never stalls
    const supplyTile = w.index(cx + 1, cy + 1, Z);
    w.spawnItem('log', 'oak', supplyTile, 25);
    w.spawnItem('raw_stone', 'granite', supplyTile, 30);
    w.spawnItem('rope', 'flax_cloth', supplyTile, 2);
    // Raw plant materials for kitchen and still
    w.spawnItem('plant_food', 'dimcap', supplyTile, 50);
    w.spawnItem('plant_food', 'turnip', supplyTile, 50);
    // Hospital supplies placed right in hospital room
    const hospSupplyTile = w.index(cx - 9, cy + 6, Z);
    w.spawnItem('cloth', 'flax_cloth', hospSupplyTile, 20);
    w.spawnItem('thread', 'flax_thread', hospSupplyTile, 20);
    w.spawnItem('splint', 'oak', hospSupplyTile, 8);
    w.spawnItem('crutch', 'oak', hospSupplyTile, 4);
    w.spawnItem('bucket', 'oak', hospSupplyTile, 2);
    w.spawnItem('brightleaf', 'brightleaf', hospSupplyTile, 6);
  },
  run: (w: TestWorld) => {
    const arrival = w.game.arrival;
    if (!arrival) throw new Error('hospital_run: no arrival');
    const { x: cx, y: cy } = arrival.wagon;

    const buildings = w.readers.of<BuildingsReader>('14');
    const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

    const dwarfSpecies = w.game.registry.table('creatures').index('dwarf');
    const allLiving = w.readers.of<{ list(): readonly number[] }>('10').list();
    const dwarves = allLiving.filter((id) => w.game.world.entities.get(id, C.Creature)?.species === dwarfSpecies);
    const medicId = dwarves[6] ?? dwarves[0]!;
    w.setSkill(medicId, 'medicine', 20);
    const nonMedLabors = ['hauling', 'mining', 'woodcutting', 'carpentry', 'masonry', 'farming', 'brewing', 'cooking', 'building', 'cleaning', 'crafting', 'hunting'];
    for (const l of nonMedLabors) {
      w.setLabor(medicId, l, false);
    }
    w.setLabor(medicId, 'medicine', true);
    w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: medicId, title: 'chief_medic' });

    const cookId = dwarves[5]!;
    w.setSkill(cookId, 'cooking', 15);
    w.setLabor(cookId, 'cooking', true);
    w.setLabor(cookId, 'hauling', true);

    // 1. Stockpile for embark & spawned goods
    const spTiles: number[] = [];
    for (let y = cy + 4; y <= cy + 8; y++) {
      for (let x = cx - 4; x <= cx + 4; x++) {
        const t = w.index(x, y, Z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) {
          spTiles.push(t);
        }
      }
    }
    const rSp = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: spTiles });
    expect(rSp.ok).toBe(true);
    const spId = bSystem.lastCreatedZone;
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });

    // 2. Core workshops: Carpenter, Mason, Kitchen, Still
    const carpenterOrigin = w.index(cx - 8, cy + 10, Z);
    const masonOrigin = w.index(cx - 4, cy + 10, Z);
    const stillOrigin = w.index(cx, cy + 10, Z);
    const kitchenOrigin = w.index(cx + 4, cy + 10, Z);

    expect(w.game.world.applyCommand({
      type: 'PlaceBuilding',
      buildingType: 'carpenter',
      origin: carpenterOrigin,
      orientation: 0,
      materialChoice: 0,
    }).ok).toBe(true);
    const carpenterId = bSystem.lastPlacedBuilding;

    expect(w.game.world.applyCommand({
      type: 'PlaceBuilding',
      buildingType: 'mason',
      origin: masonOrigin,
      orientation: 0,
      materialChoice: 0,
    }).ok).toBe(true);
    const masonId = bSystem.lastPlacedBuilding;

    expect(w.game.world.applyCommand({
      type: 'PlaceBuilding',
      buildingType: 'still',
      origin: stillOrigin,
      orientation: 0,
      materialChoice: 0,
    }).ok).toBe(true);
    const stillId = bSystem.lastPlacedBuilding;

    expect(w.game.world.applyCommand({
      type: 'PlaceBuilding',
      buildingType: 'kitchen',
      origin: kitchenOrigin,
      orientation: 0,
      materialChoice: 0,
    }).ok).toBe(true);
    const kitchenId = bSystem.lastPlacedBuilding;

    // 3. Designate channel for the well
    const wellTile = w.index(cx - 2, cy + 2, Z);
    expect(w.game.world.applyCommand({
      type: 'Designate',
      kind: 'channel',
      priority: 2,
      tiles: [wellTile],
    }).ok).toBe(true);

    // Furniture in hospital and tomb zones
    const bed1Tile = w.index(cx - 10, cy + 5, Z);
    const bed2Tile = w.index(cx - 9, cy + 5, Z);
    const bed3Tile = w.index(cx - 8, cy + 5, Z);
    const bed4Tile = w.index(cx - 7, cy + 5, Z);
    const tableTile = w.index(cx - 6, cy + 5, Z);
    const chairTile = w.index(cx - 6, cy + 6, Z);
    const chestTile = w.index(cx - 10, cy + 6, Z);
    const hospSupplyTile = w.index(cx - 9, cy + 6, Z);

    w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed1Tile, orientation: 0, materialChoice: 0 });
    w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed2Tile, orientation: 0, materialChoice: 0 });
    w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed3Tile, orientation: 0, materialChoice: 0 });
    w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed4Tile, orientation: 0, materialChoice: 0 });
    w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'table', origin: tableTile, orientation: 0, materialChoice: 0 });
    w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: chairTile, orientation: 0, materialChoice: 0 });
    w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chest', origin: chestTile, orientation: 0, materialChoice: 0 });

    // Hospital zone over the hospital room
    const hospTiles: number[] = [
      bed1Tile, bed2Tile, bed3Tile, bed4Tile, tableTile,
      chestTile, hospSupplyTile, chairTile,
    ];
    const rHosp = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'hospital', tiles: hospTiles });
    expect(rHosp.ok).toBe(true);
    const hospId = bSystem.lastCreatedZone;
    expect(w.game.world.applyCommand({
      type: 'SetHospitalSupplies',
      zoneId: hospId,
      wants: { cloth: 10, thread: 5, splints: 4, crutches: 2, brightleaf: 6, buckets: 2 },
    }).ok).toBe(true);

    // Tomb zone with coffins
    const coffin1Tile = w.index(cx - 2, cy + 15, Z);
    const coffin2Tile = w.index(cx - 1, cy + 15, Z);
    const slabTile = w.index(cx, cy + 15, Z);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'coffin', origin: coffin1Tile, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'coffin', origin: coffin2Tile, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'memorial_slab', origin: slabTile, orientation: 0, materialChoice: 0 }).ok).toBe(true);

    const tombTiles = [coffin1Tile, coffin2Tile, slabTile];
    const rTomb = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'tomb', tiles: tombTiles });
    expect(rTomb.ok).toBe(true);

    const ordered = new Set<string>();
    let coffinAssigned = false;
    const soldier1 = dwarves[0]!;
    const soldier2 = dwarves[1]!;
    const soldier3 = dwarves[3]!;
    const soldier4 = dwarves[2]!;
    const soldier5 = dwarves[4]!;
    for (const id of dwarves) {
      if (id !== soldier1 && id !== soldier2 && id !== soldier4 && id !== soldier5) {
        w.setLabor(id, 'mining', false);
        w.setLabor(id, 'woodcutting', false);
        w.setLabor(id, 'hunting', false);
      }
    }

    let scoutCreated = false;
    let scoutSquadId = 0;
    let guardSquadId = 0;

    // Step until Day 5 (tick 6000)
    while (w.tick < 5 * TICKS_PER_DAY) {
      if (!ordered.has('carpenter') && buildings.get(carpenterId)?.state === 'built') {
        ordered.add('carpenter');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_coffin_wood', mode: 'once', remaining: 2 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_table_wood', mode: 'once', remaining: 2 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_chair_wood', mode: 'once', remaining: 1 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_chest_wood', mode: 'once', remaining: 2 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_splint', mode: 'once', remaining: 4 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_crutch', mode: 'once', remaining: 2 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: carpenterId,
          order: { recipeId: 'make_bed', mode: 'once', remaining: 4 },
        });
      }
      if (!ordered.has('mason') && buildings.get(masonId)?.state === 'built') {
        ordered.add('mason');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: masonId,
          order: { recipeId: 'make_coffin_stone', mode: 'once', remaining: 2 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: masonId,
          order: { recipeId: 'make_memorial_slab', mode: 'once', remaining: 1 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: masonId,
          order: { recipeId: 'make_stone_block', mode: 'once', remaining: 4 },
        });
      }
      if (!ordered.has('still') && buildings.get(stillId)?.state === 'built') {
        ordered.add('still');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: stillId,
          order: { recipeId: 'brew', mode: 'maintain', threshold: 15 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: stillId,
          order: { recipeId: 'brew', mode: 'once', remaining: 10 },
        });
      }
      if (!ordered.has('kitchen') && buildings.get(kitchenId)?.state === 'built') {
        ordered.add('kitchen');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: kitchenId,
          order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 15 },
        });
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: kitchenId,
          order: { recipeId: 'cook_easy_meal', mode: 'once', remaining: 10 },
        });
      }
      if (w.map.kindAt(wellTile) === TileKind.Open && buildings.byType('well').length === 0) {
        w.game.world.applyCommand({
          type: 'PlaceBuilding',
          buildingType: 'well',
          origin: wellTile,
          orientation: 0,
          materialChoice: 0,
        });
      }
      if (!coffinAssigned) {
        const built = buildings.byType('coffin').find((id) => buildings.get(id)?.state === 'built');
        if (built) {
          const res = w.game.world.applyCommand({ type: 'AssignCoffin', coffinId: built, dwarfId: soldier2 });
          if (res.ok) {
            coffinAssigned = true;
            console.log(`Coffin ${built} assigned to soldier2 (${soldier2}) at tick ${w.tick}`);
          }
        }
      }
      if (w.tick >= 5400 && !scoutCreated) {
        scoutCreated = true;
        const northTile = w.index(cx, 1, Z);
        const stationTile = w.index(cx - 2, cy + 6, Z);

        w.game.world.applyCommand({ type: 'CreateSquad', name: 'Scout' });
        w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
        w.game.world.applyCommand({ type: 'CreateSquad', name: 'Reserve' });
        const allSquads = w.readers.of<CombatReader>('16').squads();
        scoutSquadId = allSquads.find((s) => s.name === 'Scout')!.id;
        const guardSquad = allSquads.find((s) => s.name === 'Guard')!;
        guardSquadId = guardSquad.id;
        const reserveSquadId = allSquads.find((s) => s.name === 'Reserve')!.id;

        w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: scoutSquadId, members: [soldier2] });
        w.game.world.applyCommand({ type: 'SetSquadStation', squadId: scoutSquadId, tile: northTile });
        w.game.world.applyCommand({ type: 'SetSquadMode', squadId: scoutSquadId, mode: 'active' });
        w.setSkill(soldier2, 'dodge', 0);

        const guardStationTile = w.index(cx, 6, Z);
        w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: guardSquadId, members: [soldier1, soldier4, soldier5] });
        w.game.world.applyCommand({ type: 'SetSquadStation', squadId: guardSquadId, tile: guardStationTile });
        w.game.world.applyCommand({ type: 'SetSquadMode', squadId: guardSquadId, mode: 'active' });
        w.setSkill(soldier1, 'axe', 15);
        w.setSkill(soldier1, 'dodge', 13);
        w.setSkill(soldier4, 'axe', 18);
        w.setSkill(soldier4, 'dodge', 14);
        w.setSkill(soldier5, 'unarmed', 18);
        w.setSkill(soldier5, 'dodge', 14);

        w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: reserveSquadId, members: [soldier3] });
        w.game.world.applyCommand({ type: 'SetSquadStation', squadId: reserveSquadId, tile: stationTile });
        w.game.world.applyCommand({ type: 'SetSquadMode', squadId: reserveSquadId, mode: 'active' });

        console.log(`Squads deployed at tick ${w.tick}`);
      }
      w.step(100);
    }

    console.log(`Day 5 reached at tick ${w.tick}. Coffin assigned: ${coffinAssigned}`);
    console.log('soldier2 pos at tick 6000:', w.game.world.entities.get(soldier2, C.Position));
    console.log('soldier1 pos at tick 6000:', w.game.world.entities.get(soldier1, C.Position));
    const pos3 = w.game.world.entities.get(soldier3, C.Position)!;
    console.log(`Soldier3 pos before fire:`, pos3);
    const d3Tile = w.index(pos3.x, pos3.y, pos3.z);
    const d3Beside = w.index(pos3.x + 1, pos3.y, pos3.z);
    // Start fire beside soldier 3
    w.map.setFlag(d3Tile, TileFlag.Grass, true);
    w.map.setFlag(d3Beside, TileFlag.Grass, true);
    w.materials.fire.pendingIgnite.add(d3Beside);
    w.materials.fire.pendingIgnite.add(d3Tile);
    console.log(`Ignited fire beside dwarf at ${d3Beside} and ${d3Tile}`);

    // Let fire deal exactly 1 tick of burn damage to soldier3 (tick 6013)
    w.step(15);

    // Extinguish fire after burn casualty is created so it doesn't spread or kill others
    const fireCtx: FireContext = {
      terrain: {
        setFlag: (i: number, f: TileFlag, v: boolean) => w.map.setFlag(i, f, v),
        setKind: (i: number, k: TileKind, m: number) => { w.map.kind[i] = k; w.map.material[i] = m; },
        setDesignation: () => {},
      },
      items: null,
      emit: (e: GameEvent) => w.game.world.emit(e),
    };
    w.materials.fire.extinguish(d3Tile, true, fireCtx);
    w.materials.fire.extinguish(d3Beside, true, fireCtx);

    // Relieve soldier3 from Reserve squad so they seek hospital bed for treatment
    const allSquadsNow = w.readers.of<CombatReader>('16').squads();
    const reserveSquadIdNow = allSquadsNow.find((s) => s.name === 'Reserve')?.id ?? 0;
    if (reserveSquadIdNow) {
      w.game.world.applyCommand({ type: 'SetSquadMode', squadId: reserveSquadIdNow, mode: 'off' });
    }
    w.setNeed(soldier3, 'hunger', 65);
    w.setNeed(soldier3, 'thirst', 65);

    const northTile = w.index(cx, 1, Z);

    // 3. Hostile raid party at north edge (2 members: 1 captain tier 1, 1 archer tier 1)
    const partyId = w.game.world.entities.create('party');
    w.game.world.entities.add(partyId, C.Party, {
      civ: 'gloam',
      purpose: 'raid',
      members: [],
      leaderId: 0,
      state: 'approach',
      goalTile: northTile,
      goalEntity: soldier2,
      arrivedTick: w.tick,
      stateSince: w.tick,
      loot: [],
      edge: 'n',
      size: 2,
    });

    const capId = spawnHostileMember(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      partyId,
      'gloam_captain',
      'captain',
      w.index(cx, 0, Z),
      1,
      true,
    );
    const warId = spawnHostileMember(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      partyId,
      'gloam_archer',
      'archers',
      w.index(cx - 2, 0, Z),
      1,
      false,
    );

    // Step through the rest of the 30 days
    const totalTicks = 30 * TICKS_PER_DAY;
    let squadRelieved = false;
    while (w.tick < totalTicks) {
      if (!squadRelieved) {
        const capDead = w.events('CreatureDied').some((e) => e['id'] === capId);
        const warDead = w.events('CreatureDied').some((e) => e['id'] === warId);
        const raidOver = w.events('RaidEnded').length > 0;
        if ((capDead && warDead) || raidOver) {
          squadRelieved = true;
          w.game.world.applyCommand({ type: 'SetSquadMode', squadId: guardSquadId, mode: 'off' });
          w.game.world.applyCommand({ type: 'SetSquadMode', squadId: scoutSquadId, mode: 'off' });
          console.log(`Squad relieved from duty at tick ${w.tick}`);
        }
      }
      for (const pId of w.game.world.entities.with(C.Patient)) {
        const needs = w.game.world.entities.get(pId, C.Needs);
        if (needs && needs.hunger < 65) {
          w.setNeed(pId, 'hunger', 65);
        }
        if (needs && needs.thirst < 65) {
          w.setNeed(pId, 'thirst', 65);
        }
      }
      const stepSize = !squadRelieved ? 10 : 100;
      w.step(stepSize);
    }

    // --- Assertions per T-152 ---

    // 1. Hospital zone and tomb zone exist and have built furniture
    expect(buildings.zonesOfType('hospital').length).toBeGreaterThanOrEqual(1);
    expect(buildings.zonesOfType('tomb').length).toBeGreaterThanOrEqual(1);
    expect(buildings.byType('bed').filter((id) => buildings.get(id)?.state === 'built').length).toBeGreaterThanOrEqual(4);
    expect(buildings.byType('coffin').filter((id) => buildings.get(id)?.state === 'built').length).toBeGreaterThanOrEqual(2);

    // 2. Every wounded dwarf who survives is admitted, diagnosed, treated, and discharged
    const woundedSurvivingDwarves = dwarves.filter(
      (id) =>
        (w.events('DamageDealt').some((e) => e['defenderId'] === id) || id === soldier3) &&
        w.game.world.entities.alive(id),
    );
    expect(woundedSurvivingDwarves.length).toBeGreaterThanOrEqual(3);

    for (const dId of woundedSurvivingDwarves) {
      expect(
        w.events('PatientAdmitted').some((e) => e['id'] === dId),
        `Dwarf ${dId} should be admitted`,
      ).toBe(true);
      expect(
        w.events('TreatmentDone').some((e) => e['patientId'] === dId),
        `Dwarf ${dId} should receive treatment`,
      ).toBe(true);
      expect(
        w.events('PatientDischarged').some((e) => e['id'] === dId),
        `Dwarf ${dId} should be discharged`,
      ).toBe(true);
    }
    expect(w.events('PatientHealed').length).toBeGreaterThanOrEqual(1);

    // 3. TreatmentDone occurs with at least stop_bleeding, clean_wound, suture, set_bone, and dress_burn
    const doneKinds = new Set(w.events('TreatmentDone').map((e) => e['kind']));
    expect(doneKinds.has('stop_bleeding')).toBe(true);
    expect(doneKinds.has('clean_wound')).toBe(true);
    expect(doneKinds.has('suture')).toBe(true);
    expect(doneKinds.has('set_bone')).toBe(true);
    expect(doneKinds.has('dress_burn')).toBe(true);
    expect(doneKinds.has('diagnose')).toBe(true);

    // 4. Crutch assertion if a dwarf lost the use of a leg
    const lostLeg = dwarves.some((id) => {
      const b = w.game.world.entities.get(id, C.Body);
      return (
        b?.permanent.includes('lost_left_leg') ||
        b?.permanent.includes('lost_right_leg')
      );
    });
    if (lostLeg) {
      expect(doneKinds.has('give_crutch')).toBe(true);
    } else {
      console.log('No dwarf lost the use of a leg; give_crutch not required.');
    }

    // 5. feed_patient and water_patient complete, with water from the well
    const completedJobTypes = new Set(w.events('JobCompleted').map((e) => e['jobType']));
    expect(completedJobTypes.has('feed_patient')).toBe(true);
    expect(completedJobTypes.has('water_patient')).toBe(true);
    const wellBuildings = buildings.byType('well');
    expect(wellBuildings.length).toBeGreaterThanOrEqual(1);
    expect(buildings.get(wellBuildings[0]!)?.state).toBe('built');

    // 6. Every dwarf who dies is buried in an assigned or free coffin, and unburied_dead thought is absent
    const deadFortressDwarves = w.events('CreatureDied').filter(
      (e) => dwarves.includes(e['id'] as number) && e['faction'] === 'fortress',
    );
    expect(w.events('Buried').length).toBe(deadFortressDwarves.length);
    for (const b of w.events('Buried')) {
      const cId = b['coffinId'] as number;
      const coffin = buildings.get(cId);
      expect(coffin).toBeDefined();
      expect(coffin?.settings['occupantId']).toBe(b['dwarfId']);
    }
    const morale = w.readers.of<MoraleReader>('15');
    for (const d of dwarves.filter((id) => w.game.world.entities.alive(id))) {
      expect(morale.thoughts(d).some((t) => t.id === 'unburied_dead')).toBe(false);
    }

    // 7. bandage_animal: Omitted per T-190.
    // In src/systems/health/producer.ts:320-349, animal wound care produces type: 'stop_bleeding' with labor: 'animal_care',
    // rather than a 'bandage_animal' job type. See docs/work/T-190-bandage-animal-job.md.

  },
};

export default scenario;
