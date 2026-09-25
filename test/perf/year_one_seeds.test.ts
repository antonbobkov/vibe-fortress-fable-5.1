/**
 * Calibration tool for F-04 Decision F-04c and gate-report input from M6 on.
 * Runs the bootstrap script across five seeds: year-one, year-one-b, year-one-c, year-one-d, year-one-e.
 * Prints one line per seed with every checkpoint day, and asserts no CreatureDied on any seed.
 */
import { describe, it, expect } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { TileKind } from '@core/map3d';
import { TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

const SEEDS = ['year-one', 'year-one-b', 'year-one-c', 'year-one-d', 'year-one-e'] as const;

export interface SeedRunResult {
  readonly seed: string;
  readonly carpenterDay: number | null;
  readonly masonDay: number | null;
  readonly stillDay: number | null;
  readonly kitchenDay: number | null;
  readonly hearthDay: number | null;
  readonly roomDay: number | null;
  readonly firstBrewDay: number | null;
  readonly firstCropDay: number | null;
  readonly brewCount: number;
  readonly cropCount: number;
  readonly drinkAt0: number;
  readonly deaths: number;
  readonly missingInputBlocks: number;
  readonly talkedCount: number;
}

export function runYearOneScript(seed: string): { w: TestWorld; result: SeedRunResult } {
  const registry = contentRegistry();
  const map = buildFlatTestMap(registry, 48, 48);
  const w = new TestWorld({ seed, registry, map, embark: 'default' });

  const arrival = w.game.arrival;
  if (!arrival) throw new Error('no arrival');
  const { x: cx, y: cy } = arrival.wagon;
  const Z = FLAT_TEST_SURFACE_Z;

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
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 0, speciesId: 'barley' });
  w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 1, speciesId: 'barley' });

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

  const itemsReader = w.readers.of<ItemsReader>('13');
  const drinkAt0 = itemsReader.count('drink');

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

    // Track first brew and crop
    if (firstBrewTick === null && w.events('ItemCrafted').some((e) => e['recipeId'] === 'brew')) {
      firstBrewTick = w.tick;
    }
    if (firstCropTick === null && w.events('CropPlanted').length > 0) {
      firstCropTick = w.tick;
    }
  }

  const brewEvents = w.events('ItemCrafted').filter((e) => e['recipeId'] === 'brew');
  const cropEvents = w.events('CropPlanted');
  const diedEvents = w.events('CreatureDied');
  const missingInputEvents = w.events('JobBlocked').filter((e) => e['reason'] === 'missing_input');
  const talkedEvents = w.events('Talked');

  const toDay = (tick: number | null | undefined): number | null => (tick == null ? null : Number((tick / TICKS_PER_DAY).toFixed(2)));

  const result: SeedRunResult = {
    seed,
    carpenterDay: toDay(builtTicks['carpenter']),
    masonDay: toDay(builtTicks['mason']),
    stillDay: toDay(builtTicks['still']),
    kitchenDay: toDay(builtTicks['kitchen']),
    hearthDay: toDay(builtTicks['hearth']),
    roomDay: toDay(roomDugTick),
    firstBrewDay: toDay(firstBrewTick),
    firstCropDay: toDay(firstCropTick),
    brewCount: brewEvents.length,
    cropCount: cropEvents.length,
    drinkAt0,
    deaths: diedEvents.length,
    missingInputBlocks: missingInputEvents.length,
    talkedCount: talkedEvents.length,
  };

  return { w, result };
}

describe('F-04 perf: year_one_seeds', () => {
  it.each(SEEDS)('runs %s and asserts nobody died', (seed) => {
    const { result } = runYearOneScript(seed);
    const line = `${result.seed}: carpenter=${result.carpenterDay ?? 'never'}d, mason=${result.masonDay ?? 'never'}d, still=${result.stillDay ?? 'never'}d, kitchen=${result.kitchenDay ?? 'never'}d, hearth=${result.hearthDay ?? 'never'}d, room=${result.roomDay ?? 'never'}d, brew=${result.firstBrewDay ?? 'never'}d (${result.brewCount}), crop=${result.firstCropDay ?? 'never'}d (${result.cropCount}), missingInputBlocks=${result.missingInputBlocks}, talked=${result.talkedCount}, deaths=${result.deaths}`;
    console.log(line);
    expect(result.deaths).toBe(0);
  });
});
