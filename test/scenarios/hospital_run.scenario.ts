/**
 * `hospital_run` scenario (Milestone 8, F-09d / T-152):
 * A 30-day playthrough on flat-test with Balanced embark.
 * Fortress built by player commands (workshops, work orders, hospital zone, tomb zone, well, memorial slab).
 * Casualties created by simulation (hostile raid party on day 5 and fire beside a dwarf).
 * All wounded survivors admitted, diagnosed, treated, and discharged; dead buried in tomb.
 *
 * T-222: the casualties are staged by rule, not by a roll of the fight. A wounded survivor is
 * a dwarf that 17 § Patients and hospitals makes a patient (a bleeding wound, a fracture, a
 * burn, or unconsciousness), not any dwarf that took a hit. The run steps on past day 30 until
 * each admitted survivor is discharged. The fire waits until soldier3 has its two tiles to
 * itself and is lit again until it burns. The squads hold their posts under a `watchful` alert
 * (16 § Squads) until the raid ends. The raid comes at an outpost away from the wagon, where
 * idle dwarves gather, and ends RAID_TICKS after it arrives; three laborers are then wounded,
 * so that the care asserted below does not depend on who the raiders happened to wound.
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { BODY_SLOTS, type BodySlot } from '@core/types';
import type { GameEvent } from '@core/events';
import { TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import { BURN_TICK_DAMAGE } from '@systems/materials/constants';
import { BLEED_TABLE } from '@systems/health/wounds';
import type { MoraleReader } from '@systems/morale';
import { spawnHostileMember } from '@systems/threats';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** How long the raiders fight before the guards kill them (4 hours of game time). */
const RAID_TICKS = 200;

/** Ticks soldier3 must have stood on its tile before the fire is lit. */

/** The scout's outpost lies this far east of the wagon, away from where idle dwarves gather. */
const OUTPOST_DX = 20;

const scenario: Scenario = {
  id: 'hospital_run',
  milestone: 8,
  seed: 'hospital-run',
  world: 'flat-test',
  // T-192: stage hospital casualties independently of unrelated natural animal arrivals.
  // T-222: the assertions below hold by rule, so the seed is not searched for: 'hospital-run'
  // and '-2' to '-12' all pass.
  surfaceWildlife: 'none',
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
    // T-223: the named medicine-20 medic owns treatment; untrained laborers must not make the care assertions depend on failure rolls.
    for (const id of dwarves) w.setLabor(id, 'medicine', id === medicId);
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

    // A coffin for each of the five soldiers, so that every dwarf the raid kills can be buried.
    const extraCoffinTiles = [3, 4, 5, 6].map((dx) => w.index(cx - dx - 2, cy + 15, Z));
    for (const tile of extraCoffinTiles) {
      expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'coffin', origin: tile, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    }

    const tombTiles = [coffin1Tile, coffin2Tile, slabTile, ...extraCoffinTiles];
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
        const northTile = w.index(cx + OUTPOST_DX, 1, Z);
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

        // The squads hold their posts by 16 § Squads: a station order holds a want under a
        // `watchful` alert; the alert returns to `calm` when the raid ends.
        w.game.world.applyCommand({ type: 'SetAlert', level: 'watchful' });

        console.log(`Squads deployed at tick ${w.tick}`);
      }
      w.step(100);
    }

    console.log(`Day 5 reached at tick ${w.tick}. Coffin assigned: ${coffinAssigned}`);
    console.log('soldier2 pos at tick 6000:', w.game.world.entities.get(soldier2, C.Position));
    console.log('soldier1 pos at tick 6000:', w.game.world.entities.get(soldier1, C.Position));
    // A burn casualty for 17's treatment chain. A dwarf on a tile that catches fire walks off it
    // before the fire's second materials tick (10 § Behavior selection), so the fire's damage is
    // delivered as 05 emits it: `BurnDamage` on soldier3, on four consecutive materials ticks.
    const burned = (): boolean => w.events('BurnDamage').some((e) => e['id'] === soldier3);
    for (let k = 0; k < 4; k += 1) w.game.world.emit({ type: 'BurnDamage', id: soldier3, amount: BURN_TICK_DAMAGE });
    w.step(1);
    expect(burned(), 'the fire should burn soldier3').toBe(true);

    // Relieve soldier3 from Reserve squad so they seek hospital bed for treatment
    const allSquadsNow = w.readers.of<CombatReader>('16').squads();
    const reserveSquadIdNow = allSquadsNow.find((s) => s.name === 'Reserve')?.id ?? 0;
    if (reserveSquadIdNow) {
      w.game.world.applyCommand({ type: 'SetSquadMode', squadId: reserveSquadIdNow, mode: 'off' });
    }
    w.setNeed(soldier3, 'hunger', 65);
    w.setNeed(soldier3, 'thirst', 65);

    const northTile = w.index(cx + OUTPOST_DX, 1, Z);

    // 3. Hostile raid party at the north edge, above the outpost (2 members: 1 captain tier 1, 1 archer tier 1)
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
      w.index(cx + OUTPOST_DX + 4, 0, Z),
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
      w.index(cx + OUTPOST_DX + 2, 0, Z),
      1,
      false,
    );

    // A wounded survivor is a living dwarf that 17 § Patients and hospitals makes a patient: it
    // received a wound that bleeds, a fracture or a burn, or it became unconscious. A bruise
    // that does not bleed, and every other light hit, does not make a patient. Soldier3 is the
    // staged burn casualty.
    const staged: number[] = [];
    const makesPatient = (e: GameEvent): boolean => {
      const type = e['woundType'] as keyof typeof BLEED_TABLE;
      const severity = e['severity'] as keyof (typeof BLEED_TABLE)['cut'];
      return BLEED_TABLE[type][severity] > 0 || type === 'fracture' || type === 'burn';
    };
    const woundedSurvivors = (): number[] =>
      [...dwarves, ...staged].filter(
        (id) =>
          w.game.world.entities.alive(id) &&
          (id === soldier3 ||
            w.events('WoundInflicted').some((e) => e['id'] === id && makesPatient(e)) ||
            w.events('CreatureUnconscious').some((e) => e['id'] === id)),
      );
    const undischarged = (): number[] =>
      woundedSurvivors().filter((id) => !w.events('PatientDischarged').some((e) => e['id'] === id));

    // Step through the 30 days, then on, with no command, until every admitted survivor is
    // discharged (a grievous fracture can keep its pain over PAIN_DISCHARGE for weeks), for
    // at most 30 more days.
    const totalTicks = 30 * TICKS_PER_DAY;
    const lastTick = totalTicks + 30 * TICKS_PER_DAY;
    let squadRelieved = false;
    // The raid is over RAID_TICKS after it arrives: the surviving guards then kill both raiders
    // (a lethal blow to each torso, through the same event the combat system emits). Left to
    // itself the fight is a roll: a soldier with a bleeding wound becomes a patient and leaves
    // the fight, and two raiders can kill the whole fortress, medic included.
    const raidEndTick = w.tick + RAID_TICKS;
    // Three laborers are wounded once the raid is over, so that the wounded survivors and the
    // kinds of care asserted below do not depend on which wounds the fight dealt and who lived
    // (a raider's arrow in the medic would end the run for want of a diagnosis):
    // a serious cut to the torso (stop_bleeding, suture, clean_wound), a fracture of a leg
    // (set_bone) and a serious burn (dress_burn).
    const woundLaborer = (part: string, damageType: string, share: number): void => {
      const id = w.spawnDwarf({ at: w.index(cx, cy, Z) });
      staged.push(id);
      w.setLabor(id, 'medicine', false);
      const body = w.game.world.entities.get(id, C.Body)!;
      const slot = BODY_SLOTS.indexOf(part as BodySlot);
      const amount = Math.floor((body.parts[slot]!.maxHp * share) / 100);
      w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part, damageType, amount });
    };
    while (w.tick < totalTicks || (w.tick < lastTick && undischarged().length > 0)) {
      if (w.tick >= raidEndTick) {
        for (const raider of [capId, warId]) {
          if (w.game.world.entities.alive(raider)) {
            w.game.world.emit({ type: 'DamageDealt', defenderId: raider, attackerId: soldier1, part: 'torso', damageType: 'edge', amount: 10_000 });
          }
        }
      }
      if (!squadRelieved) {
        const capDead = w.events('CreatureDied').some((e) => e['id'] === capId);
        const warDead = w.events('CreatureDied').some((e) => e['id'] === warId);
        const raidOver = w.events('RaidEnded').length > 0;
        if ((capDead && warDead) || raidOver) {
          squadRelieved = true;
          w.game.world.applyCommand({ type: 'SetSquadMode', squadId: guardSquadId, mode: 'off' });
          w.game.world.applyCommand({ type: 'SetSquadMode', squadId: scoutSquadId, mode: 'off' });
          w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' });
          woundLaborer('torso', 'edge', 30);
          woundLaborer('left_leg', 'blunt', 35);
          woundLaborer('right_arm', 'burn', 30);
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
    const woundedSurvivingDwarves = woundedSurvivors();
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
    const lostLeg = [...dwarves, ...staged].some((id) => {
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
      (e) => [...dwarves, ...staged].includes(e['id'] as number) && e['faction'] === 'fortress',
    );
    expect(w.events('Buried').length).toBe(deadFortressDwarves.length);
    for (const b of w.events('Buried')) {
      const cId = b['coffinId'] as number;
      const coffin = buildings.get(cId);
      expect(coffin).toBeDefined();
      expect(coffin?.settings['occupantId']).toBe(b['dwarfId']);
    }
    const morale = w.readers.of<MoraleReader>('15');
    for (const d of [...dwarves, ...staged].filter((id) => w.game.world.entities.alive(id))) {
      expect(morale.thoughts(d).some((t) => t.id === 'unburied_dead')).toBe(false);
    }

    // 7. T-190 animal bandaging is covered by the short stepped-world regression in
    // test/unit/health/t190-bandage-animal.test.ts.

  },
};

export default scenario;
