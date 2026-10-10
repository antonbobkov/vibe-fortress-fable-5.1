/**
 * Shared homestead year fortress setup and script (T-153).
 *
 * Implements the homestead playthrough: livestock, leather, cloth,
 * hunting, fishing, gathering, crafting, and farming.
 */

import { expect } from 'vitest';
import { HeadlessGame, regionSpec } from '@app/headless';
import { C } from '@core/components';
import { LOCAL_MAP_Z, TICKS_PER_DAY } from '@core/constants';
import { TileKind, Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import { contentRegistry } from '@content/loader';
import { EmbarkSession } from '@systems/embark';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { TestWorld } from './test-world';

export function createHomesteadEmbarkSession(registry: Registry, seed: string): EmbarkSession {
  const session = new EmbarkSession(registry, seed, 0);
  const rPreset = session.apply({ type: 'ApplyPreset', preset: 'balanced' });
  if (!rPreset.ok) throw new Error(`ApplyPreset balanced failed: ${rPreset.reason}`);

  // 1. SetSkill: Fisher (dwarf 5: cooking 5, fishing 5)
  session.apply({ type: 'SetSkill', dwarf: 5, skill: 'herbalism', level: 0 });
  session.apply({ type: 'SetSkill', dwarf: 5, skill: 'fishing', level: 5 });

  // SetSkill: Hunter (dwarf 6: crossbow 5, hunting 5)
  session.apply({ type: 'SetSkill', dwarf: 6, skill: 'medicine', level: 0 });
  session.apply({ type: 'SetSkill', dwarf: 6, skill: 'crossbow', level: 5 });
  session.apply({ type: 'SetSkill', dwarf: 6, skill: 'hunting', level: 5 });

  // 2. SetSupply: Drop unneeded goods to fund livestock, while keeping table, empty barrels, bags, meals
  session.apply({ type: 'SetSupply', entry: 'e_chair', count: 0 });     // -16
  session.apply({ type: 'SetSupply', entry: 'e_bed', count: 0 });       // -36
  session.apply({ type: 'SetSupply', entry: 'e_meat', count: 0 });      // -60
  session.apply({ type: 'SetSupply', entry: 'e_dimcaps', count: 0 });   // -24
  session.apply({ type: 'SetSupply', entry: 'e_ale', count: 0 });       // -55
  session.apply({ type: 'SetSupply', entry: 'e_dimcap_ale', count: 1 }); // -55
  session.apply({ type: 'SetSupply', entry: 'e_leather', count: 0 });   // -36
  session.apply({ type: 'SetSupply', entry: 'e_cloth', count: 0 });     // -48
  session.apply({ type: 'SetSupply', entry: 'e_thread', count: 0 });    // -18

  // 3. SetSupply: Add livestock, poultry, hops seeds, and extra empty barrels
  session.apply({ type: 'SetSupply', entry: 'e_cow', count: 2 });       // +144 (1 milking cow [sex 0], 1 bull [sex 1])
  session.apply({ type: 'SetSupply', entry: 'e_sheep', count: 3 });     // +108 (2 ewes [sex 0], 1 ram [sex 1])
  session.apply({ type: 'SetSupply', entry: 'e_chickens', count: 1 });  // +29 (3 hens [sex 0], 1 rooster [sex 1])
  session.apply({ type: 'SetSupply', entry: 'e_seed_hops', count: 1 }); // +27 (hops seeds for brew_hopped)
  session.apply({ type: 'SetSupply', entry: 'e_empty_barrel', count: 6 }); // +40 (preserve empty barrels for still)

  const check = session.canEmbark();
  if (!check.ok) throw new Error(`createHomesteadEmbarkSession cannot embark: ${check.reason}`);
  const rConfirm = session.apply({ type: 'ConfirmEmbark' });
  if (!rConfirm.ok) throw new Error(`ConfirmEmbark failed: ${rConfirm.reason}`);

  return session;
}

export function homesteadYearWorld(seed: string = 'homestead-year'): TestWorld {
  const registry = contentRegistry();
  const spec = regionSpec(
    seed,
    {
      wealth: 1,
      peril: 0,
      temper: 0,
      biome: 'temperate_grassland',
      river: { class: 'brook', inflow: ['w'], outflow: 'e' },
    },
    registry,
  );
  const map = new Map3D(48, 48, LOCAL_MAP_Z);
  const local = generateLocal(spec, map, registry);
  const systems = HeadlessGame.standardSystems(spec, local.layerStack, local);
  const session = createHomesteadEmbarkSession(registry, seed);
  return new TestWorld({
    seed,
    registry,
    map,
    spec,
    systems,
    embark: { session },
  });
}

import { generateLocal } from '@systems/terrain/generate';

export function runHomesteadYear(w: TestWorld): void {
  const arrival = w.game.arrival;
  if (!arrival) throw new Error('homestead_year: no arrival');
  const wz = arrival.wagon.z;
  const wx = arrival.wagon.x;
  const wy = arrival.wagon.y;

  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  const dwarfSpecies = w.game.registry.table('creatures').index('dwarf');
  const allLiving = w.readers.of<{ list(): readonly number[] }>('10').list();
  const dwarves = allLiving.filter((id) => w.game.world.entities.get(id, C.Creature)?.species === dwarfSpecies);

  // Set dwarf skills for reliable homesteading
  for (const d of dwarves) {
    w.setSkill(d, 'animal_care', 10);
    w.setSkill(d, 'farming', 10);
  }
  const trainer = dwarves[0]!;
  w.setSkill(trainer, 'animal_training', 15);
  const hunter = dwarves[6]!;
  w.setSkill(hunter, 'hunting', 10);
  const crafter = dwarves[2]!;
  w.setSkill(crafter, 'carpentry', 10);
  w.setSkill(crafter, 'crafting', 10);
  w.setSkill(crafter, 'clothesmaking', 10);
  w.setSkill(crafter, 'weaving', 10);
  w.setSkill(crafter, 'leatherworking', 10);
  w.setSkill(crafter, 'tanning', 10);
  w.setSkill(crafter, 'butchery', 10);
  w.setSkill(crafter, 'brewing', 10);
  w.setSkill(crafter, 'cooking', 10);

  // 1. Raw materials spawn near wagon (raw materials only: log, raw_stone, rope)
  const supplyTile = w.index(wx + 1, wy + 1, wz);
  w.spawnItem('log', 'oak', supplyTile, 60);
  w.spawnItem('raw_stone', 'granite', supplyTile, 60);
  w.spawnItem('rope', 'flax_cloth', supplyTile, 10);

  // 2. Pasture zone on grass (x: 1..20, y: 1..8, z: 32)
  const pastureTiles: number[] = [];
  for (let y = 1; y <= 8; y++) {
    for (let x = 1; x <= 18; x++) {
      const i = w.index(x, y, wz);
      if (bSystem.zones.qualifies(w.game.registry.table('zoneTypes').index('pasture'), i)) {
        pastureTiles.push(i);
      }
    }
  }
  expect(w.game.world.applyCommand({
    type: 'CreateZone',
    zoneType: 'pasture',
    tiles: pastureTiles,
  }).ok).toBe(true);
  const pastureId = bSystem.lastCreatedZone;

  // Retrieve initial tame animals
  const tameReader = w.readers.of<{ tameList(): readonly number[] }>('08');
  const initialTame = tameReader ? tameReader.tameList() : [];
  const cowIds = initialTame.filter((id) => {
    const c = w.game.world.entities.get(id, C.Creature);
    return w.game.registry.table('creatures').idOf(c?.species ?? 0) === 'cow';
  });
  const sheepIds = initialTame.filter((id) => {
    const c = w.game.world.entities.get(id, C.Creature);
    return w.game.registry.table('creatures').idOf(c?.species ?? 0) === 'sheep';
  });
  const dogIds = initialTame.filter((id) => {
    const c = w.game.world.entities.get(id, C.Creature);
    return w.game.registry.table('creatures').idOf(c?.species ?? 0) === 'dog';
  });

  // sex === 0 is female, sex === 1 is male
  const femaleCow = cowIds.find((id) => w.game.world.entities.get(id, C.Creature)?.sex === 0)!;
  const maleCow = cowIds.find((id) => w.game.world.entities.get(id, C.Creature)?.sex === 1)!;
  const maleSheep = sheepIds.find((id) => w.game.world.entities.get(id, C.Creature)?.sex === 1)!;

  // Assign grazers to pasture
  for (const aId of [...cowIds, ...sheepIds]) {
    expect(w.game.world.applyCommand({
      type: 'AssignPasture',
      animalId: aId,
      zoneId: pastureId,
    }).ok).toBe(true);
  }

  // 3. Stockpile zone for supplies
  const spTiles: number[] = [];
  for (let y = 1; y <= 3; y++) {
    for (let x = 20; x <= 24; x++) {
      const i = w.index(x, y, wz);
      if (bSystem.zones.qualifies(w.game.registry.table('zoneTypes').index('stockpile'), i)) {
        spTiles.push(i);
      }
    }
  }
  expect(w.game.world.applyCommand({
    type: 'CreateZone',
    zoneType: 'stockpile',
    tiles: spTiles,
  }).ok).toBe(true);
  const spId = bSystem.lastCreatedZone;
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });
  w.game.world.applyCommand({ type: 'SetStockpileContainers', zoneId: spId, wants: { barrel: 1, bag: 4, bin: 4 } });

  // 4. Dump zone
  const dumpTile = w.index(26, 0, wz);
  expect(w.game.world.applyCommand({
    type: 'CreateZone',
    zoneType: 'dump',
    tiles: [dumpTile],
  }).ok).toBe(true);

  // Set of tiles occupied by zones/wagon/supplies
  const occupied = new Set<number>([...pastureTiles, ...spTiles, dumpTile, supplyTile]);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      occupied.add(w.index(wx + dx, wy + dy, wz));
    }
  }

  // 5. Gather zone on wild shrubs (y <= 10, z = wz)
  const gatherType = w.game.registry.table('zoneTypes').index('gather');
  const shrubTiles: number[] = [];
  for (let y = 0; y <= 10; y++) {
    for (let x = 0; x < w.map.w; x++) {
      const i = w.index(x, y, wz);
      if (
        w.map.kindAt(i) === TileKind.Shrub &&
        bSystem.zones.qualifies(gatherType, i) &&
        buildings.zoneAt(i) === 0 &&
        !occupied.has(i)
      ) {
        shrubTiles.push(i);
      }
    }
  }
  if (shrubTiles.length > 0) {
    const rGather = w.game.world.applyCommand({
      type: 'CreateZone',
      zoneType: 'gather',
      tiles: shrubTiles,
    });
    expect(rGather.ok).toBe(true);
    for (const t of shrubTiles) occupied.add(t);
  }

  // 6. Farm plots on surface soil (north of river, avoiding pasture, wagon, stockpile)
  function find2x2Plot(): number[] | null {
    for (let y = 1; y <= 8; y++) {
      for (let x = 21; x <= 45; x++) {
        let valid = true;
        const candidate: number[] = [];
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const t = w.index(x + dx, y + dy, wz);
            candidate.push(t);
            if (
              w.map.kindAt(t) !== TileKind.Floor ||
              occupied.has(t) ||
              buildings.zoneAt(t) !== 0 ||
              w.map.buildingAtTile(t) !== 0
            ) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }
        if (valid) {
          for (const t of candidate) occupied.add(t);
          return candidate;
        }
      }
    }
    return null;
  }

  const flaxTiles = find2x2Plot()!;
  expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: flaxTiles }).ok).toBe(true);
  const flaxPlotId = bSystem.lastCreatedZone;
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: flaxPlotId, season: 0, speciesId: 'flax' });
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: flaxPlotId, season: 1, speciesId: 'flax' });

  const hopsTiles = find2x2Plot()!;
  expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: hopsTiles }).ok).toBe(true);
  const hopsPlotId = bSystem.lastCreatedZone;
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: hopsPlotId, season: 0, speciesId: 'hops' });
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: hopsPlotId, season: 1, speciesId: 'hops' });

  const barleyTiles = find2x2Plot()!;
  expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: barleyTiles }).ok).toBe(true);
  const barleyPlotId = bSystem.lastCreatedZone;
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: barleyPlotId, season: 0, speciesId: 'barley' });
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: barleyPlotId, season: 1, speciesId: 'barley' });

  const turnipTiles = find2x2Plot()!;
  expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: turnipTiles }).ok).toBe(true);
  const turnipPlotId = bSystem.lastCreatedZone;
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: turnipPlotId, season: 0, speciesId: 'turnip' });
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: turnipPlotId, season: 1, speciesId: 'turnip' });

  // Standing order: autoHarvest
  w.game.world.applyCommand({ type: 'SetStandingOrder', name: 'autoHarvest', on: true });

  // 7. Find 3x3 pure floor locations for workshops
  function find3x3(): number | null {
    for (let y = 1; y <= 25; y++) {
      for (let x = 20; x <= 44; x++) {
        let valid = true;
        const candidate: number[] = [];
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            const t = w.index(x + dx, y + dy, wz);
            candidate.push(t);
            if (
              w.map.kindAt(t) !== TileKind.Floor ||
              occupied.has(t) ||
              buildings.zoneAt(t) !== 0 ||
              w.map.buildingAtTile(t) !== 0
            ) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }
        if (valid) {
          for (const t of candidate) occupied.add(t);
          return w.index(x, y, wz);
        }
      }
    }
    return null;
  }

  const workshopTypes = [
    'carpenter', 'mason', 'craftdwarf', 'still', 'kitchen', 'butcher',
    'tannery', 'farmers_workshop', 'loom', 'clothier', 'bowyer', 'leatherworks', 'kennel',
  ];
  const workshopIds: Record<string, number> = {};
  for (const type of workshopTypes) {
    const origin = find3x3();
    if (origin === null) throw new Error(`Could not place workshop ${type}`);
    expect(w.game.world.applyCommand({
      type: 'PlaceBuilding',
      buildingType: type,
      origin,
      orientation: 0,
      materialChoice: 0,
    }).ok).toBe(true);
    workshopIds[type] = bSystem.lastPlacedBuilding;
  }

  // Nest box on free tile
  let nestBoxOrigin = -1;
  for (let x = 20; x <= 30; x++) {
    const t = w.index(x, 0, wz);
    if (w.map.kindAt(t) === TileKind.Floor && w.map.buildingAtTile(t) === 0 && buildings.zoneAt(t) === 0 && !occupied.has(t)) {
      nestBoxOrigin = t;
      occupied.add(t);
      break;
    }
  }
  expect(w.game.world.applyCommand({
    type: 'PlaceBuilding',
    buildingType: 'nest_box',
    origin: nestBoxOrigin,
    orientation: 0,
    materialChoice: 0,
  }).ok).toBe(true);

  // 8. Scripted Commands:
  // NameAnimal
  expect(w.game.world.applyCommand({
    type: 'NameAnimal',
    animalId: femaleCow,
    name: 'Bessie',
  }).ok).toBe(true);

  // SetBreedingCap
  expect(w.game.world.applyCommand({
    type: 'SetBreedingCap',
    species: 'sheep',
    cap: 8,
  }).ok).toBe(true);

  // SetHuntable (species deer)
  expect(w.game.world.applyCommand({
    type: 'SetHuntable',
    species: 'deer',
    on: true,
  }).ok).toBe(true);

  // MarkSlaughter & UnmarkSlaughter
  expect(w.game.world.applyCommand({
    type: 'MarkSlaughter',
    animalId: maleCow,
  }).ok).toBe(true);
  expect(w.game.world.applyCommand({
    type: 'UnmarkSlaughter',
    animalId: maleCow,
  }).ok).toBe(true);

  // 9. Simulation loop
  // Forty days include a dog conceived in the first sixteen days, its twenty-day
  // gestation and a few days of margin; the birth assertion must not need an early roll.
  const totalTicks = 40 * TICKS_PER_DAY;
  const orderedWorkshops = new Set<string>();
  let dogTrainInitiated = false;
  let dogAssigned = false;
  let slaughterInitiated = false;
  let standingOrderSet = false;
  let dumpItemIssued = false;
  let hopsSpawned = false;

  while (w.tick < totalTicks) {
    // Add work orders as workshops finish construction
    if (!orderedWorkshops.has('carpenter') && buildings.get(workshopIds['carpenter']!)?.state === 'built') {
      orderedWorkshops.add('carpenter');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['carpenter']!,
        order: { recipeId: 'make_barrel_wood', mode: 'once', remaining: 4 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['carpenter']!,
        order: { recipeId: 'make_table_wood', mode: 'once', remaining: 4 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['carpenter']!,
        order: { recipeId: 'make_chest_wood', mode: 'once', remaining: 2 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['carpenter']!,
        order: { recipeId: 'make_nest_box', mode: 'once', remaining: 2 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['carpenter']!,
        order: { recipeId: 'make_bucket', mode: 'once', remaining: 2 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['carpenter']!,
        order: { recipeId: 'make_chair_wood', mode: 'once', remaining: 2 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['carpenter']!,
        order: { recipeId: 'make_bed', mode: 'once', remaining: 4 },
      });
    }

    if (!orderedWorkshops.has('mason') && buildings.get(workshopIds['mason']!)?.state === 'built') {
      orderedWorkshops.add('mason');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['mason']!,
        order: { recipeId: 'make_stone_block', mode: 'once', remaining: 6 },
      });
    }

    if (!orderedWorkshops.has('still') && buildings.get(workshopIds['still']!)?.state === 'built') {
      orderedWorkshops.add('still');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['still']!,
        order: { recipeId: 'brew_hopped', mode: 'once', remaining: 1 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['still']!,
        order: { recipeId: 'brew', mode: 'once', remaining: 1 },
      });
    }

    if (!orderedWorkshops.has('kitchen') && buildings.get(workshopIds['kitchen']!)?.state === 'built') {
      orderedWorkshops.add('kitchen');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['kitchen']!,
        order: { recipeId: 'cook_easy_meal', mode: 'once', remaining: 4 },
      });
    }

    if (!orderedWorkshops.has('farmers_workshop') && buildings.get(workshopIds['farmers_workshop']!)?.state === 'built') {
      orderedWorkshops.add('farmers_workshop');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['farmers_workshop']!,
        order: { recipeId: 'make_cheese', mode: 'once', remaining: 2 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['farmers_workshop']!,
        order: { recipeId: 'process_flax', mode: 'once', remaining: 4 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['farmers_workshop']!,
        order: { recipeId: 'mill_flour', mode: 'once', remaining: 2 },
      });
    }

    if (!orderedWorkshops.has('loom') && buildings.get(workshopIds['loom']!)?.state === 'built') {
      orderedWorkshops.add('loom');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['loom']!,
        order: { recipeId: 'spin_thread', mode: 'once', remaining: 4 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['loom']!,
        order: { recipeId: 'weave_cloth', mode: 'once', remaining: 2 },
      });
    }

    if (!orderedWorkshops.has('clothier') && buildings.get(workshopIds['clothier']!)?.state === 'built') {
      orderedWorkshops.add('clothier');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['clothier']!,
        order: { recipeId: 'make_tunic', mode: 'once', remaining: 1 },
      });
    }

    if (!orderedWorkshops.has('tannery') && buildings.get(workshopIds['tannery']!)?.state === 'built') {
      orderedWorkshops.add('tannery');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['tannery']!,
        order: { recipeId: 'tan_hide', mode: 'once', remaining: 4 },
      });
    }

    if (!orderedWorkshops.has('leatherworks') && buildings.get(workshopIds['leatherworks']!)?.state === 'built') {
      orderedWorkshops.add('leatherworks');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['leatherworks']!,
        order: { recipeId: 'make_leather_boots', mode: 'once', remaining: 1 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['leatherworks']!,
        order: { recipeId: 'make_quiver', mode: 'once', remaining: 1 },
      });
    }

    if (!orderedWorkshops.has('bowyer') && buildings.get(workshopIds['bowyer']!)?.state === 'built') {
      orderedWorkshops.add('bowyer');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['bowyer']!,
        order: { recipeId: 'make_bow', mode: 'once', remaining: 1 },
      });
    }

    if (!orderedWorkshops.has('craftdwarf') && buildings.get(workshopIds['craftdwarf']!)?.state === 'built') {
      orderedWorkshops.add('craftdwarf');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: workshopIds['craftdwarf']!,
        order: { recipeId: 'make_bolts_bone', mode: 'once', remaining: 2 },
      });
    }

    // Train dog when kennel is built
    if (!dogTrainInitiated && buildings.get(workshopIds['kennel']!)?.state === 'built' && dogIds[0] !== undefined) {
      dogTrainInitiated = true;
      expect(w.game.world.applyCommand({
        type: 'TrainAnimal',
        animalId: dogIds[0],
        kind: 'hunting',
      }).ok).toBe(true);
    }

    // Assign trained dog to hunter dwarf
    if (!dogAssigned && w.events('AnimalTrained').length > 0 && dogIds[0] !== undefined) {
      dogAssigned = true;
      expect(w.game.world.applyCommand({
        type: 'AssignAnimal',
        animalId: dogIds[0],
        dwarfId: hunter,
      }).ok).toBe(true);
    }

    // Slaughter male cow and male sheep once butcher and tannery are built
    if (!slaughterInitiated && buildings.get(workshopIds['butcher']!)?.state === 'built' && buildings.get(workshopIds['tannery']!)?.state === 'built') {
      slaughterInitiated = true;
      w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: maleCow });
      w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: maleSheep });
    }

    // Issue DumpItem on an item to trigger haul_to_dump
    if (!dumpItemIssued && w.tick >= 2000) {
      const allItems = w.game.world.entities.with(C.Item);
      if (allItems.length > 0) {
        const itemToDump = allItems[0]!;
        const rDump = w.game.world.applyCommand({ type: 'DumpItem', itemId: itemToDump, on: true });
        if (rDump.ok) dumpItemIssued = true;
      }
    }

    // Set autoCollectProducts standing order after day 16 (let first egg hatch at day 15)
    if (!standingOrderSet && w.tick >= 16 * TICKS_PER_DAY) {
      standingOrderSet = true;
      expect(w.game.world.applyCommand({
        type: 'SetStandingOrder',
        name: 'autoCollectProducts',
        on: true,
      }).ok).toBe(true);
    }

    // Spawn raw hops at day 28 for brew_hopped when barley is harvested
    if (!hopsSpawned && w.tick >= 28 * TICKS_PER_DAY) {
      hopsSpawned = true;
      w.spawnItem('plant_food', 'hops', spTiles[0]!, 10);
    }

    // Maintain basic dwarf needs to ensure no dwarf dies
    for (const d of dwarves) {
      const needs = w.game.world.entities.get(d, C.Needs);
      if (needs && needs.hunger > 40) w.setNeed(d, 'hunger', 10);
      if (needs && needs.thirst > 40) w.setNeed(d, 'thirst', 10);
    }

    w.step(Math.min(600, totalTicks - w.tick));
  }

  // Assertions per T-153 decisions:

  const wildSpawns: Record<string, number> = {};
  for (const ev of w.events('AnimalSpawned')) {
    const species = String(ev['species']);
    wildSpawns[species] = (wildSpawns[species] ?? 0) + 1;
  }
  console.log(`T-192 homestead_year wildlife: ${JSON.stringify({ spawns: wildSpawns, liveAtEnd: w.animals.reader().wildList().length, huntsCompleted: w.events('JobCompleted').filter((ev) => ev['jobType'] === 'hunt').length, huntKills: w.events('HuntKill').length })}`);

  // 1. Job types completed
  const completedJobs = new Set(w.events('JobCompleted').map((e) => e['jobType']));
  expect(completedJobs.has('slaughter'), 'job: slaughter').toBe(true);
  expect(completedJobs.has('butcher'), 'job: butcher').toBe(true);
  expect(completedJobs.has('milk_animal'), 'job: milk_animal').toBe(true);
  expect(completedJobs.has('shear_animal'), 'job: shear_animal').toBe(true);
  expect(completedJobs.has('collect_egg'), 'job: collect_egg').toBe(true);
  expect(completedJobs.has('train_animal'), 'job: train_animal').toBe(true);
  expect(completedJobs.has('gather'), 'job: gather').toBe(true);
  expect(completedJobs.has('haul_to_dump'), 'job: haul_to_dump').toBe(true);
  expect(completedJobs.has('hunt'), 'job: hunt').toBe(true);
  // Fishing is covered by the short T-191 bank/catch regressions; this fixture has no fishing zone.

  // 2. Ordered recipes crafted
  const craftedRecipes = new Set(w.events('ItemCrafted').map((e) => e['recipeId']));
  expect(craftedRecipes.has('make_cheese'), 'recipe: make_cheese').toBe(true);
  expect(craftedRecipes.has('spin_thread'), 'recipe: spin_thread').toBe(true);
  expect(craftedRecipes.has('weave_cloth'), 'recipe: weave_cloth').toBe(true);
  expect(craftedRecipes.has('make_tunic'), 'recipe: make_tunic').toBe(true);
  expect(craftedRecipes.has('make_leather_boots'), 'recipe: make_leather_boots').toBe(true);
  expect(craftedRecipes.has('make_quiver'), 'recipe: make_quiver').toBe(true);
  expect(craftedRecipes.has('make_bow'), 'recipe: make_bow').toBe(true);
  expect(craftedRecipes.has('make_bolts_bone'), 'recipe: make_bolts_bone').toBe(true);
  expect(craftedRecipes.has('brew_hopped'), 'recipe: brew_hopped').toBe(true);
  expect(craftedRecipes.has('mill_flour'), 'recipe: mill_flour').toBe(true);
  expect(craftedRecipes.has('process_flax'), 'recipe: process_flax').toBe(true);

  // 3. Events emitted
  expect(w.events('AnimalBorn').length, 'event: AnimalBorn').toBeGreaterThanOrEqual(1);
  expect(w.events('AnimalTrained').length, 'event: AnimalTrained').toBeGreaterThanOrEqual(1);
  expect(w.events('ButcheryDone').length, 'event: ButcheryDone').toBeGreaterThanOrEqual(1);
  expect(w.events('HuntKill').length, 'event: HuntKill').toBeGreaterThanOrEqual(1);
  // FishCaught is covered by the short T-191 regression, without adding a zone to this fixture.

  // 4. Invariants
  expect(w.events('Starvation').length, 'no tame animal starved').toBe(0);
  const dwarfDeaths = w.events('CreatureDied').filter((d) => dwarves.includes(d['id'] as number));
  expect(dwarfDeaths.length, 'no dwarf died').toBe(0);
}
