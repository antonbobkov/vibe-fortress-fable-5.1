/**
 * T-M4-20 year-one bootstrap scenario (F-04).
 *
 * Runs a 20-day bootstrap script on a 48×48 flat-test map with one water spring,
 * Balanced embark, issuing player commands for stockpile, stairwell, 5×5 room dig,
 * five core workshops/hearth, meeting area, farm plot and work orders.
 *
 * Bounds calibrated per Decision F-04c across five seeds (ceil(max × 1.25), ≤ 20d):
 * seed        carpenter mason   still    kitchen  hearth   room     brew       crop
 * year-one    0.92d     4.00d   11.42d   3.25d    5.42d    4.59d    17.17d (1) 0.67d (10)
 * year-one-b  0.84d     3.25d   12.59d   2.25d    4.59d    5.75d    16.50d (1) 0.67d (10)
 * year-one-c  0.84d     4.42d   11.84d   2.50d    5.75d    4.42d    16.42d (1) 0.59d (10)
 * year-one-d  0.84d     3.17d    1.59d   2.34d    5.17d    4.34d    11.09d (1) 0.67d (10)
 * year-one-e  0.84d     4.42d    2.75d   3.42d    5.92d    4.34d    11.50d (1) 0.67d (10)
 * max         0.92d     4.42d   12.59d   3.42d    5.92d    5.75d    17.17d     0.67d
 * bound       2d        6d      16d      5d       8d       8d       ≤ 20d      ≤ 20d
 */
import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import { C } from '@core/components';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const Z = FLAT_TEST_SURFACE_Z;

export function diagnose(w: TestWorld): string {
  const lines: string[] = ['--- year_one diagnostics ---'];

  const entities = w.game.world.entities;
  const dwarves = entities.with(C.Labors).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress');
  lines.push('Dwarves:');
  for (const id of dwarves) {
    const brain = entities.get(id, C.Brain);
    const worker = entities.get(id, C.Worker);
    lines.push(
      `  dwarf ${id}: behavior=${brain?.behavior ?? 'none'} activity=${brain?.activity ?? 'none'} jobId=${worker?.jobId ?? 0} toolId=${worker?.toolId ?? 0}`,
    );
  }

  const jobsReader = w.readers.of<JobsReader>('11');
  const openPrefixes: Record<string, number> = {};
  for (const j of jobsReader.list('open')) {
    const prefix = j.key.split(':')[0] ?? 'unknown';
    openPrefixes[prefix] = (openPrefixes[prefix] ?? 0) + 1;
  }
  lines.push(`Open jobs by prefix: ${JSON.stringify(openPrefixes)}`);

  const claimedByType: Record<string, number> = {};
  for (const e of w.events('JobClaimed')) {
    const t = String(e['jobType'] ?? 'unknown');
    claimedByType[t] = (claimedByType[t] ?? 0) + 1;
  }
  lines.push(`JobClaimed by type: ${JSON.stringify(claimedByType)}`);

  const blockedByReason: Record<string, number> = {};
  for (const e of w.events('JobBlocked')) {
    const r = `${String(e['jobType'] ?? 'unknown')}:${String(e['reason'] ?? 'unknown')}`;
    blockedByReason[r] = (blockedByReason[r] ?? 0) + 1;
  }
  lines.push(`JobBlocked by type:reason: ${JSON.stringify(blockedByReason)}`);

  const unblockedByType: Record<string, number> = {};
  for (const e of w.events('JobUnblocked')) {
    const t = String(e['jobType'] ?? 'unknown');
    unblockedByType[t] = (unblockedByType[t] ?? 0) + 1;
  }
  lines.push(`JobUnblocked by type: ${JSON.stringify(unblockedByType)}`);

  const completedByType: Record<string, number> = {};
  for (const e of w.events('JobCompleted')) {
    const t = String(e['jobType'] ?? 'unknown');
    completedByType[t] = (completedByType[t] ?? 0) + 1;
  }
  lines.push(`JobCompleted by type: ${JSON.stringify(completedByType)}`);

  const itemsReader = w.readers.of<ItemsReader>('13');
  const itemCounts = {
    raw_stone: itemsReader.count('raw_stone'),
    stone_block: itemsReader.count('stone_block'),
    log: itemsReader.count('log'),
    drink: itemsReader.count('drink'),
    plant_food: itemsReader.count('plant_food'),
  };
  lines.push(`Items count: ${JSON.stringify(itemCounts)}`);
  return lines.join('\n');
}

const scenario: Scenario = {
  id: 'year_one',
  milestone: 4,
  seed: 'year-one',
  world: 'flat-test',
  embark: 'default',
  run: (outer) => {
    const registry = outer.game.registry;
    const map = buildFlatTestMap(registry, 48, 48);
    const w = new TestWorld({ seed: 'year-one', registry, map, embark: 'default' });

    const arrival = w.game.arrival;
    if (!arrival) throw new Error('year_one: no arrival');
    const { x: cx, y: cy } = arrival.wagon;

    // 1. The spring
    const granite = registry.table('materials').index('granite');
    const terrain = w.game.world.services.terrain;
    terrain.setKind(w.index(cx + 9, cy + 3, Z), TileKind.Wall, granite);
    terrain.setKind(w.index(cx + 7, cy + 3, Z), TileKind.Wall, granite);
    terrain.setKind(w.index(cx + 8, cy + 4, Z), TileKind.Wall, granite);
    terrain.setKind(w.index(cx + 8, cy + 2, Z), TileKind.Wall, granite);
    w.setFluid(w.index(cx + 8, cy + 3, Z), 7, 'water', true);

    const buildings = w.readers.of<BuildingsReader>('14');
    const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

    // 2. Stockpile over 6x4 rectangle at (cx-3, cy+4), then SetStockpileFilter { filter: 'everything' }
    const spTiles: number[] = [];
    for (let y = cy + 4; y <= cy + 7; y++) {
      for (let x = cx - 3; x <= cx + 2; x++) {
        const t = w.index(x, y, Z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) {
          spTiles.push(t);
        }
      }
    }
    const rSp = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: spTiles });
    if (!rSp.ok) throw new Error(`Stockpile CreateZone failed: ${rSp.reason}`);
    const spId = bSystem.lastCreatedZone;
    const rFilter = w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });
    if (!rFilter.ok) throw new Error(`SetStockpileFilter failed: ${rFilter.reason}`);

    // 3. DesignateStairwell { x: cx+6, y: cy+6, zTop: 32, zBottom: 29 }
    const rStairs = w.game.world.applyCommand({ type: 'DesignateStairwell', x: cx + 6, y: cy + 6, zTop: 32, zBottom: 29 });
    if (!rStairs.ok) throw new Error(`DesignateStairwell failed: ${rStairs.reason}`);

    // 4. Designate { kind: 'dig', priority: 4 } over 5x5 rectangle at (cx+7, cy+4, 29)
    const roomTiles: number[] = [];
    for (let y = cy + 4; y <= cy + 8; y++) {
      for (let x = cx + 7; x <= cx + 11; x++) {
        roomTiles.push(w.index(x, y, 29));
      }
    }
    const rDig = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: roomTiles });
    if (!rDig.ok) throw new Error(`Designate dig failed: ${rDig.reason}`);

    // 5. PlaceBuilding (orientation 0, materialChoice 0)
    const toPlace = [
      { type: 'carpenter', origin: w.index(cx - 8, cy + 10, Z) },
      { type: 'mason', origin: w.index(cx - 4, cy + 10, Z) },
      { type: 'still', origin: w.index(cx, cy + 10, Z) },
      { type: 'kitchen', origin: w.index(cx + 4, cy + 10, Z) },
      { type: 'hearth', origin: w.index(cx - 1, cy + 15, Z) },
    ];
    const placedIds: Record<string, number> = {};
    for (const p of toPlace) {
      const ghost = buildings.ghost(p.type, p.origin, 0);
      if (ghost.reason !== null) throw new Error(`ghost refused ${p.type}: ${ghost.reason}`);
      const r = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: p.type,
        origin: p.origin,
        orientation: 0,
        materialChoice: 0,
      });
      if (!r.ok) throw new Error(`PlaceBuilding ${p.type} failed: ${r.reason}`);
      placedIds[p.type] = bSystem.lastPlacedBuilding;
    }

    // 6. CreateZone meeting_area over 5x3 rectangle at (cx-3, cy+16)
    const meetTiles: number[] = [];
    for (let y = cy + 16; y <= cy + 18; y++) {
      for (let x = cx - 3; x <= cx + 1; x++) {
        const t = w.index(x, y, Z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('meeting_area', t)) {
          meetTiles.push(t);
        }
      }
    }
    const rMeet = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: meetTiles });
    if (!rMeet.ok) throw new Error(`meeting_area CreateZone failed: ${rMeet.reason}`);

    // 7. w.step(5). Then CreateZone farm_plot over 4x4 at (cx-8, cy+16), and SetPlotCrop barley for seasons 0 and 1
    w.step(5);
    const farmTiles: number[] = [];
    for (let y = cy + 16; y <= cy + 19; y++) {
      for (let x = cx - 8; x <= cx - 5; x++) {
        const t = w.index(x, y, Z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t)) {
          farmTiles.push(t);
        }
      }
    }
    const rFarm = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: farmTiles });
    if (!rFarm.ok) throw new Error(`farm_plot CreateZone failed: ${rFarm.reason}`);
    const farmId = bSystem.lastCreatedZone;
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 0, speciesId: 'barley' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 1, speciesId: 'barley' }).ok).toBe(true);

    // Tracking
    const builtTicks: Record<string, number | null> = {
      carpenter: null,
      mason: null,
      still: null,
      kitchen: null,
      hearth: null,
    };
    let roomDugTick: number | null = null;
    let firstBrewTick: number | null = null;
    let firstCropTick: number | null = null;
    const ordered = new Set<string>();

    const totalTicks = 20 * TICKS_PER_DAY;
    while (w.tick < totalTicks) {
      const stepSize = Math.min(100, totalTicks - w.tick);
      w.step(stepSize);

      // Track built buildings
      for (const type of ['carpenter', 'mason', 'still', 'kitchen', 'hearth']) {
        const id = placedIds[type]!;
        if (builtTicks[type] === null && buildings.get(id)?.state === 'built') {
          builtTicks[type] = w.tick;
        }
      }

      // Orders as soon as each workshop is built
      if (!ordered.has('mason') && builtTicks['mason'] !== null) {
        ordered.add('mason');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: placedIds['mason'],
          order: { recipeId: 'make_stone_block', mode: 'once', remaining: 2 },
        });
      }
      if (!ordered.has('still') && builtTicks['still'] !== null) {
        ordered.add('still');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: placedIds['still'],
          order: { recipeId: 'brew', mode: 'maintain', threshold: 20 },
        });
      }
      if (!ordered.has('kitchen') && builtTicks['kitchen'] !== null) {
        ordered.add('kitchen');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: placedIds['kitchen'],
          order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 10 },
        });
      }

      // 5x5 room dug
      if (roomDugTick === null && roomTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
        roomDugTick = w.tick;
      }

      // First brew and crop
      if (firstBrewTick === null && w.events('ItemCrafted').some((e) => e['recipeId'] === 'brew')) {
        firstBrewTick = w.tick;
      }
      if (firstCropTick === null && w.events('CropPlanted').length > 0) {
        firstCropTick = w.tick;
      }
    }

    try {
      // Checkpoint bounds per Decision F-04c
      expect(builtTicks['carpenter'], 'carpenter built within day 2').not.toBeNull();
      expect(builtTicks['carpenter']!).toBeLessThanOrEqual(2 * TICKS_PER_DAY);

      expect(builtTicks['mason'], 'mason built within day 6').not.toBeNull();
      expect(builtTicks['mason']!).toBeLessThanOrEqual(6 * TICKS_PER_DAY);

      expect(builtTicks['kitchen'], 'kitchen built within day 5').not.toBeNull();
      expect(builtTicks['kitchen']!).toBeLessThanOrEqual(5 * TICKS_PER_DAY);

      expect(builtTicks['still'], 'still built within day 16').not.toBeNull();
      expect(builtTicks['still']!).toBeLessThanOrEqual(16 * TICKS_PER_DAY);

      expect(builtTicks['hearth'], 'hearth built within day 8').not.toBeNull();
      expect(builtTicks['hearth']!).toBeLessThanOrEqual(8 * TICKS_PER_DAY);
      expect(w.events('HearthLit').length, 'HearthLit emitted').toBeGreaterThanOrEqual(1);

      expect(roomDugTick, '5x5 room dug within day 8').not.toBeNull();
      expect(roomDugTick!).toBeLessThanOrEqual(8 * TICKS_PER_DAY);

      expect(firstBrewTick, '≥ 1 brew by day 20').not.toBeNull();
      expect(firstBrewTick!).toBeLessThanOrEqual(20 * TICKS_PER_DAY);

      expect(firstCropTick, '≥ 1 crop planted by day 20').not.toBeNull();
      expect(firstCropTick!).toBeLessThanOrEqual(20 * TICKS_PER_DAY);

      expect(w.events('CreatureDied').length, 'nobody died').toBe(0);

      const missingInput = w.events('JobBlocked').filter((e) => e['reason'] === 'missing_input').length;
      expect(missingInput, 'missing_input blocks ≤ 200').toBeLessThanOrEqual(200);

      const talked = w.events('Talked').length;
      expect(talked, 'talked events ≥ 10').toBeGreaterThanOrEqual(10);
    } catch (err) {
      console.error(diagnose(w));
      throw err;
    }
  },
};

export default scenario;
