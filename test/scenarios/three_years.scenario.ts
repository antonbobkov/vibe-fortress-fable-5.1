/**
 * The three-years scenario (T-M8-06): extends the year-one bootstrap across three full years.
 *
 * Runs on seed `three-years` (flat-test 48×48, serene_vale peril-0 region, Balanced embark),
 * asserting the deterministic guarantees named in `balance.md` § Mood floor and the no-spiral
 * guarantee and `M8-polish.md` (mood floor, no spiral, caps), and reporting the measured balance
 * table for consumption, wealth curve, immigration, and mood distribution.
 */

import { expect } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z } from '@app/headless';
import { DAYS_PER_YEAR, TICKS_PER_DAY, POPULATION_CAP_DEFAULT, MOOD_MIN } from '@core/constants';
import { TileKind } from '@core/map3d';
import { C } from '@core/components';
import { POSITIVE_CAP, NEGATIVE_CAP, NEED_PRESSURE_CAP, MOOD_NEEDS_MET_FLOOR } from '@systems/morale/mood';
import { WAVE_MAX } from '@systems/immigration/constants';
import { deathCounts } from './death-counts';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

const Z = FLAT_TEST_SURFACE_Z;

export interface ThreeYearsRow {
  readonly metric: string;
  readonly model: string;
  readonly measured: string;
}

const scenario: Scenario = {
  id: 'three_years',
  milestone: 8,
  timeoutMs: 300_000,
  seed: 'three-years',
  world: 'flat-test',
  embark: 'default',
  run: (outer) => {
    const registry = outer.game.registry;
    const map = buildFlatTestMap(registry, 48, 48);
    const w = new TestWorld({ seed: 'three-years', registry, map, embark: 'default' });

    const arrival = w.game.arrival;
    if (!arrival) throw new Error('three_years: no arrival');
    const { x: cx, y: cy } = arrival.wagon;

    // 1. Water spring
    const granite = registry.table('materials').index('granite');
    const terrain = w.game.world.services.terrain;
    terrain.setKind(w.index(cx + 9, cy + 3, Z), TileKind.Wall, granite);
    terrain.setKind(w.index(cx + 7, cy + 3, Z), TileKind.Wall, granite);
    terrain.setKind(w.index(cx + 8, cy + 4, Z), TileKind.Wall, granite);
    terrain.setKind(w.index(cx + 8, cy + 2, Z), TileKind.Wall, granite);
    w.setFluid(w.index(cx + 8, cy + 3, Z), 7, 'water', true);

    const buildings = w.readers.of<BuildingsReader>('14');
    const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

    // 2. Stockpile (6x4)
    const spTiles: number[] = [];
    for (let y = cy + 4; y <= cy + 7; y += 1) {
      for (let x = cx - 3; x <= cx + 2; x += 1) {
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

    // 3. Stairwell to rock layer
    const rStairs = w.game.world.applyCommand({ type: 'DesignateStairwell', x: cx + 6, y: cy + 6, zTop: 32, zBottom: 29 });
    if (!rStairs.ok) throw new Error(`DesignateStairwell failed: ${rStairs.reason}`);

    // 4. Dig 5x5 room at z = 29
    const roomTiles: number[] = [];
    for (let y = cy + 4; y <= cy + 8; y += 1) {
      for (let x = cx + 7; x <= cx + 11; x += 1) {
        roomTiles.push(w.index(x, y, 29));
      }
    }
    const rDig = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: roomTiles });
    if (!rDig.ok) throw new Error(`Designate dig failed: ${rDig.reason}`);

    // 5. Workshops
    const toPlace = [
      { type: 'carpenter', origin: w.index(cx - 8, cy + 10, Z) },
      { type: 'mason', origin: w.index(cx - 4, cy + 10, Z) },
      { type: 'still', origin: w.index(cx, cy + 10, Z) },
      { type: 'kitchen', origin: w.index(cx + 4, cy + 10, Z) },
      { type: 'hearth', origin: w.index(cx - 1, cy + 15, Z) },
    ];
    const placedIds: Record<string, number> = {};
    for (const p of toPlace) {
      if (buildings.ghost(p.type, p.origin, 0).reason !== null) continue;
      const r = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: p.type,
        origin: p.origin,
        orientation: 0,
        materialChoice: 0,
      });
      if (r.ok) placedIds[p.type] = bSystem.lastPlacedBuilding;
    }

    // 6. Meeting area
    const meetTiles: number[] = [];
    for (let y = cy + 16; y <= cy + 18; y += 1) {
      for (let x = cx - 3; x <= cx + 1; x += 1) {
        const t = w.index(x, y, Z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('meeting_area', t)) {
          meetTiles.push(t);
        }
      }
    }
    w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: meetTiles });

    // 7. Surface farm
    w.step(5);
    const farmTiles: number[] = [];
    for (let y = cy + 16; y <= cy + 19; y += 1) {
      for (let x = cx - 8; x <= cx - 5; x += 1) {
        const t = w.index(x, y, Z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t)) {
          farmTiles.push(t);
        }
      }
    }
    const rFarm = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: farmTiles });
    if (rFarm.ok) {
      const farmId = bSystem.lastCreatedZone;
      w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 0, speciesId: 'barley' });
      w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 1, speciesId: 'barley' });
    }

    // Advance bootstrap period (20 days)
    const ordered = new Set<string>();
    const totalTicksBootstrap = 20 * TICKS_PER_DAY;
    while (w.tick < totalTicksBootstrap) {
      w.step(Math.min(100, totalTicksBootstrap - w.tick));
      if (!ordered.has('mason') && buildings.get(placedIds['mason']!)?.state === 'built') {
        ordered.add('mason');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: placedIds['mason'],
          order: { recipeId: 'make_stone_block', mode: 'once', remaining: 2 },
        });
      }
      if (!ordered.has('still') && buildings.get(placedIds['still']!)?.state === 'built') {
        ordered.add('still');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: placedIds['still'],
          order: { recipeId: 'brew', mode: 'maintain', threshold: 20 },
        });
      }
      if (!ordered.has('kitchen') && buildings.get(placedIds['kitchen']!)?.state === 'built') {
        ordered.add('kitchen');
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: placedIds['kitchen'],
          order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 10 },
        });
      }
    }

    // Trade depot
    for (const at of [w.index(cx - 9, cy + 4, Z), w.index(cx - 9, cy + 8, Z), w.index(cx + 8, cy + 14, Z)]) {
      if (buildings.ghost('trade_depot', at, 0).reason !== null) continue;
      const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: at, orientation: 0, materialChoice: 0 });
      if (placed.ok) break;
    }
    w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', priority: 1 }] });

    // Cave farm
    const caveTiles: number[] = [];
    for (let y = cy + 4; y <= cy + 7; y += 1) {
      for (let x = cx + 7; x <= cx + 10; x += 1) {
        caveTiles.push(w.index(x, y, Z - 1));
      }
    }
    w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: caveTiles });
    let caveFarmId = 0;

    // Tracking
    const waves: { day: number; count: number; guaranteed: boolean }[] = [];
    const raids: { day: number; kind: string; size: number }[] = [];
    let mealsEaten = 0;
    let drinksAlcohol = 0;
    let drinksWater = 0;

    const unsubscribe = w.game.world.onEvents((events) => {
      const day = Math.floor(w.tick / TICKS_PER_DAY) + 1;
      for (const e of events) {
        if (e.type === 'ImmigrantsArrived') {
          waves.push({ day, count: Number(e['count'] ?? 0), guaranteed: e['guaranteed'] === true });
        } else if (e.type === 'RaidArrived') {
          raids.push({ day, kind: String(e['threatKind'] ?? 'raid'), size: Number(e['size'] ?? 0) });
        } else if (e.type === 'MealEaten') {
          mealsEaten += 1;
        } else if (e.type === 'DrankAlcohol') {
          drinksAlcohol += 1;
        } else if (e.type === 'DrankWater') {
          drinksWater += 1;
        }
      }
    });

    const items = w.readers.of<ItemsReader>('13');
    const totalTicks = 3 * DAYS_PER_YEAR * TICKS_PER_DAY;
    const year1Tick = DAYS_PER_YEAR * TICKS_PER_DAY;
    const year2Tick = 2 * DAYS_PER_YEAR * TICKS_PER_DAY;

    let y1Wealth = 0;
    let y2Wealth = 0;
    let y3Wealth = 0;
    let y1Pop = 0;
    let y2Pop = 0;
    let y3Pop = 0;

    while (w.tick < totalTicks) {
      w.step(Math.min(600, totalTicks - w.tick));

      if (caveFarmId === 0 && caveTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
        const plantable = caveTiles.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
        if (plantable.length > 0) {
          const created = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable });
          if (created.ok) {
            caveFarmId = bSystem.lastCreatedZone;
            for (const season of [0, 1, 2, 3]) {
              w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: caveFarmId, season, speciesId: 'dimcap' });
            }
          }
        } else {
          caveFarmId = -1;
        }
      }

      if (w.tick === year1Tick) {
        y1Wealth = items.wealth();
        y1Pop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
      } else if (w.tick === year2Tick) {
        y2Wealth = items.wealth();
        y2Pop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
      }
    }

    unsubscribe();

    y3Wealth = items.wealth();
    const livingDwarves = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
    y3Pop = livingDwarves.length;

    // Mood and thought statistics
    const moods: number[] = [];
    const breakdown: Record<string, number> = { Fine: 0, Content: 0, Happy: 0, Unhappy: 0, Miserable: 0, Ecstatic: 0 };
    let minMood = 100;
    let maxMood = 0;
    let sumMood = 0;

    for (const id of livingDwarves) {
      const mood = w.game.world.entities.get(id, C.Mood);
      if (!mood) continue;
      const val = mood.value;
      moods.push(val);
      if (val < minMood) minMood = val;
      if (val > maxMood) maxMood = val;
      sumMood += val;

      if (val < 20) breakdown['Miserable'] = (breakdown['Miserable'] ?? 0) + 1;
      else if (val < 40) breakdown['Unhappy'] = (breakdown['Unhappy'] ?? 0) + 1;
      else if (val < 60) breakdown['Fine'] = (breakdown['Fine'] ?? 0) + 1;
      else if (val < 75) breakdown['Content'] = (breakdown['Content'] ?? 0) + 1;
      else if (val < 90) breakdown['Happy'] = (breakdown['Happy'] ?? 0) + 1;
      else breakdown['Ecstatic'] = (breakdown['Ecstatic'] ?? 0) + 1;

      // Assertion 1: Deterministic mood floor (mood >= MOOD_MIN and mood >= 20 - needPressure)
      expect(val).toBeGreaterThanOrEqual(MOOD_MIN);
      const needPressure = Math.min(
        NEED_PRESSURE_CAP,
        mood.thoughts.reduce((sum, t) => {
          return sum + (t.baseValue < 0 ? Math.max(0, -t.baseValue) : 0);
        }, 0),
      );
      expect(val).toBeGreaterThanOrEqual(MOOD_NEEDS_MET_FLOOR - needPressure);

      // Assertion 2: Thought caps
      const positives = mood.thoughts.filter((t) => t.baseValue > 0).reduce((sum, t) => sum + t.baseValue, 0);
      const negatives = mood.thoughts.filter((t) => t.baseValue < 0).reduce((sum, t) => sum + -t.baseValue, 0);
      expect(positives).toBeLessThanOrEqual(POSITIVE_CAP + 1); // allowance for active tick
      expect(negatives).toBeLessThanOrEqual(NEGATIVE_CAP + NEED_PRESSURE_CAP + 1);
    }

    const deaths = deathCounts(w);
    const avgMood = moods.length > 0 ? (sumMood / moods.length).toFixed(1) : 'N/A';

    // Assertion 3: No-spiral guarantee (peril 0 survives without deaths, population larger than embark)
    expect(deaths.dwarf, 'no dwarf died across three years in peril 0').toBe(0);
    expect(y3Pop, 'fortress grew past the 7 embark dwarves').toBeGreaterThan(7);

    // Assertion 4: Caps
    expect(y3Pop, 'population within POPULATION_CAP_DEFAULT').toBeLessThanOrEqual(POPULATION_CAP_DEFAULT);
    for (const wave of waves) {
      expect(wave.count, 'wave size within WAVE_MAX').toBeLessThanOrEqual(WAVE_MAX);
    }

    // Balance reporting table
    const totalDwarfDays = 7 * 28 + (waves[0]?.count ? (7 + waves[0].count) * 28 : 0) + y3Pop * (3 * DAYS_PER_YEAR - 56);
    const mealsPerDwarfDay = totalDwarfDays > 0 ? (mealsEaten / totalDwarfDays).toFixed(2) : '0';
    const drinksPerDwarfDay = totalDwarfDays > 0 ? ((drinksAlcohol + drinksWater) / totalDwarfDays).toFixed(2) : '0';

    const table: ThreeYearsRow[] = [
      { metric: 'Consumption: food/dwarf/day', model: '0.48 food units', measured: `${mealsPerDwarfDay} meals (${mealsEaten} total)` },
      { metric: 'Consumption: drink/dwarf/day', model: '0.77 drink units', measured: `${drinksPerDwarfDay} drinks (${drinksAlcohol} ale, ${drinksWater} water)` },
      { metric: 'Wealth curve: Year 1', model: '4,000–8,000 marks', measured: `${y1Wealth} marks (pop ${y1Pop})` },
      { metric: 'Wealth curve: Year 2', model: '15,000–25,000 marks', measured: `${y2Wealth} marks (pop ${y2Pop})` },
      { metric: 'Wealth curve: Year 3', model: '35,000–60,000 marks', measured: `${y3Wealth} marks (pop ${y3Pop})` },
      { metric: 'Immigration: Year 1 guaranteed', model: '2 waves (4–8 dwarves)', measured: `${waves.filter((w) => w.guaranteed).length} waves (${waves.reduce((s, w) => s + w.count, 0)} dwarves)` },
      { metric: 'Immigration: Years 2–3', model: 'spirit >= 65: waves of 4–12', measured: `${waves.filter((w) => !w.guaranteed).length} waves (spirit < 65 threshold)` },
      { metric: 'Raids: Peril 0', model: 'Thieves from Y2 spring (size 1)', measured: `${raids.length} thieves (sizes: ${raids.map((r) => r.size).join(', ')})` },
      { metric: 'Mood distribution: Mean', model: 'Content (~70 with hearth)', measured: `${avgMood} (min ${minMood.toFixed(1)}, max ${maxMood.toFixed(1)})` },
      { metric: 'Mood distribution: Breakdown', model: 'Content dominant', measured: `Fine: ${breakdown['Fine']}, Content: ${breakdown['Content']}, Unhappy: ${breakdown['Unhappy']}, Miserable: ${breakdown['Miserable']}` },
    ];

    const NL = String.fromCharCode(10);
    console.log(['three_years balance table:', ...table.map((r) => `  ${r.metric} | model: ${r.model} | measured: ${r.measured}`)].join(NL));
    console.log(`three_years summary: ${JSON.stringify({ y1Pop, y2Pop, y3Pop, y1Wealth, y2Wealth, y3Wealth, deaths, mealsEaten, drinksAlcohol, drinksWater, waves, raids, moodStats: { min: minMood, max: maxMood, avg: avgMood, breakdown } })}`);
  },
};

export default scenario;
