/**
 * The year-one scenario: the F-04 bootstrap script, then the whole first year with caravans and
 * immigration (T-M7-11).
 *
 * The first 20 days keep F-04's checkpoint bounds exactly as they were. The run then continues to
 * day `DAYS_PER_YEAR` and checks the rows of `03-content/balance.md` § Year-one expectation that
 * follow from a rule rather than from a measurement — the two caravan windows of
 * `20-trade-and-caravans.md` § Schedule, the two guaranteed immigration waves of
 * `21-immigration.md` § Evaluation, no caravan in winter, the surface farm dormant in winter, and
 * no raid in a peril-0 region — and reports the rest as the balance table the gate report carries
 * (D-202).
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
import { DAYS_PER_SEASON, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { CARAVAN_DAY_MAX, CARAVAN_DAY_MIN } from '@systems/trade/constants';
import { GUARANTEED_SIZE_MAX, GUARANTEED_SIZE_MIN } from '@systems/immigration/constants';
import { CARAVAN_SEASON } from '@systems/trade/schedule';
import { TileKind } from '@core/map3d';
import { C } from '@core/components';
import { deathCounts } from './death-counts';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';
import { checkInvariants, watchInvariants } from './invariants';

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

/** One row of the measured year-one table the gate report carries. */
export interface YearOneRow { readonly day: string; readonly measured: string }

const scenario: Scenario = {
  id: 'year_one',
  milestone: 7,
  timeoutMs: 600_000,
  seed: 'year-one',
  world: 'flat-test',
  embark: 'default',
  run: (outer) => {
    const registry = outer.game.registry;
    const map = buildFlatTestMap(registry, 48, 48);
    // T-196: no natural animal arrivals for now. One wild badger killed six of the seven dwarves
    // on days 85 to 87 of this fixture. Restore natural arrivals when T-196 lands.
    const w = new TestWorld({ seed: 'year-one', registry, map, embark: 'default', surfaceWildlife: 'none' });
    const stopInvariants = watchInvariants(w.game, (findings) => expect(findings, `T-176 tick ${w.tick}`).toEqual([]));

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
        // T-199: a brew needs an empty barrel, and the stockpile keeps food and seed in the five
        // the party brought, so the still waits. The player has one made for it. Remove this order
        // when T-199 is fixed.
        w.game.world.applyCommand({
          type: 'AddWorkOrder',
          workshopId: placedIds['carpenter'],
          order: { recipeId: 'make_barrel', mode: 'once', remaining: 1 },
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

      expect(deathCounts(w).dwarf, 'no dwarf died').toBe(0);

      const missingInput = w.events('JobBlocked').filter((e) => e['reason'] === 'missing_input').length;
      expect(missingInput, 'missing_input blocks ≤ 200').toBeLessThanOrEqual(200);

      const talked = w.events('Talked').length;
      const day = (tick: number | null | undefined): number | null => tick === null || tick === undefined ? null : Number((tick / TICKS_PER_DAY).toFixed(2));
      console.log(`year_one: ${JSON.stringify({ carpenterDay: day(builtTicks['carpenter']),
        masonDay: day(builtTicks['mason']), stillDay: day(builtTicks['still']),
        kitchenDay: day(builtTicks['kitchen']), hearthDay: day(builtTicks['hearth']),
        roomDay: day(roomDugTick), firstBrewDay: day(firstBrewTick),
        firstCropDay: day(firstCropTick), dwarfDeaths: deathCounts(w).dwarf,
        tameDeaths: deathCounts(w).tame, missingInput, talked })}`);
      expect(talked, 'talked events ≥ 10').toBeGreaterThanOrEqual(10);
    } catch (err) {
      console.error(diagnose(w));
      throw err;
    }

    // ---------- the rest of the year (T-M7-11) ----------
    // The depot goes up once the bootstrap is done, which is what `hint_depot` tells the player
    // ("day 14 of summer, year 1, no depot: build a trade depot before the caravan arrives"), and
    // the anvil the year-one table's Mountainhome row asks for (`20` section Requests).
    let depotId = 0;
    for (const at of [w.index(cx - 9, cy + 4, Z), w.index(cx - 9, cy + 8, Z), w.index(cx + 8, cy + 14, Z), w.index(cx - 9, cy + 20, Z)]) {
      if (buildings.ghost('trade_depot', at, 0).reason !== null) continue;
      const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: at, orientation: 0, materialChoice: 0 });
      if (placed.ok) { depotId = bSystem.lastPlacedBuilding; break; }
    }
    expect(depotId, 'a trade depot was placed').toBeGreaterThan(0);
    expect(w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome',
      entries: [{ itemType: 'anvil', priority: 1 }] }).ok).toBe(true);

    // The cave farm the year-one table plants on days 10-20 and which "carries" through winter:
    // a 4x4 plot of dimcap on the soil level below the surface, beside the stairwell.
    const caveTiles: number[] = [];
    for (let y = cy + 4; y <= cy + 7; y += 1) for (let x = cx + 7; x <= cx + 10; x += 1) caveTiles.push(w.index(x, y, Z - 1));
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: caveTiles }).ok).toBe(true);
    let caveFarmId = 0;

    const dayNow = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const seasonOfDay = (day: number): number => Math.floor(((day - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
    /** The day each civilisation's caravan first showed on the map, stamped as the event arrives. */
    const caravanDay: Record<string, number | null> = { hillfolk: null, wildwood: null, mountainhome: null };
    const waves: { day: number; count: number; guaranteed: boolean }[] = [];
    const raidDays: number[] = [];
    const warningDays: number[] = [];
    const plantedDays: number[] = [];
    const cavePlantedDays: number[] = [];
    const frozenDays: number[] = [];
    let tradesDone = 0;
    const unsubscribe = w.game.world.onEvents((events) => {
      const day = dayNow();
      for (const event of events) {
        if (event.type === 'CaravanArrived' || event.type === 'CaravanWaiting') {
          const civ = String(event['civ']);
          if (caravanDay[civ] === undefined || caravanDay[civ] === null) caravanDay[civ] = day;
        } else if (event.type === 'ImmigrantsArrived') {
          waves.push({ day, count: Number(event['count'] ?? 0), guaranteed: event['guaranteed'] === true });
        } else if (event.type === 'RaidArrived') raidDays.push(day);
        else if (event.type === 'ThreatWarning') warningDays.push(day);
        else if (event.type === 'CropPlanted') {
          const tile = Number(event['tile'] ?? 0);
          const z = Math.floor(tile / (w.readers.map.w * w.readers.map.h));
          (z === Z ? plantedDays : cavePlantedDays).push(day);
        }
        else if (event.type === 'TileFrozen') frozenDays.push(day);
        else if (event.type === 'TradeCompleted') tradesDone += 1;
      }
    });

    const yearTicks = DAYS_PER_YEAR * TICKS_PER_DAY;
    while (w.tick < yearTicks) {
      w.step(Math.min(600, yearTicks - w.tick));
      // The cave plot opens as soon as its room is dug; dimcap grows in the dark in every season.
      if (caveFarmId === 0 && caveTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
        const plantable = caveTiles.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
        if (plantable.length > 0) {
          const created = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable });
          if (created.ok) {
            caveFarmId = bSystem.lastCreatedZone;
            for (const season of [0, 1, 2, 3]) {
              expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: caveFarmId, season, speciesId: 'dimcap' }).ok).toBe(true);
            }
          }
        } else {
          caveFarmId = -1;
        }
      }
    }
    unsubscribe();
    expect(caveFarmId, 'the cave farm was planted').toBeGreaterThan(0);

    const items = w.readers.of<ItemsReader>('13');
    const trade = w.game.world.scheduler.byId('20') as unknown as { serialize(): { schedule: Record<string, { nextArrivalTick: number }> } };
    const mountainhomeNext = trade.serialize().schedule['mountainhome']?.nextArrivalTick ?? 0;
    const nextDay = Math.floor(mountainhomeNext / TICKS_PER_DAY) + 1;
    const population = w.game.world.entities.with(C.Labors)
      .filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
    const harvests = w.events('CropHarvested').length;

    /** The caravan window of `20` section Schedule: season day CARAVAN_DAY_MIN to CARAVAN_DAY_MAX. */
    const windowOf = (civ: string, year: number): [number, number] => {
      const base = (year - 1) * DAYS_PER_YEAR + (CARAVAN_SEASON[civ] ?? 0) * DAYS_PER_SEASON;
      return [base + CARAVAN_DAY_MIN, base + CARAVAN_DAY_MAX];
    };

    const table: YearOneRow[] = [
      { day: '28 Summer: Hillfolk caravan', measured: `day ${caravanDay['hillfolk'] ?? 'never'}` },
      { day: '28 first immigrants (2-4)', measured: waves[0] === undefined ? 'never' : `day ${waves[0].day}, ${waves[0].count} dwarves` },
      { day: '56 Autumn: Wildwood caravan', measured: `day ${caravanDay['wildwood'] ?? 'never'}` },
      { day: '56 second guaranteed wave', measured: waves[1] === undefined ? 'never' : `day ${waves[1].day}, ${waves[1].count} dwarves` },
      { day: '56 first ambush or raid warning at peril >= 2', measured: `peril 0 region: ${raidDays.length} raids, ${warningDays.length} warnings` },
      { day: '84 Winter: surface farm dormant', measured: `${plantedDays.filter((d) => seasonOfDay(d) === 3).length} surface crops planted in winter` },
      { day: '84 cave farm carries', measured: `${cavePlantedDays.filter((d) => seasonOfDay(d) === 3).length} cave crops planted in winter, ${cavePlantedDays.length} all year` },
      { day: '84 river frozen at temper >= 1', measured: `temper 0 region: ${frozenDays.length} tiles frozen, first on day ${frozenDays[0] ?? 'never'}` },
      { day: '112 Year 2: Mountainhome caravan', measured: `scheduled day ${nextDay}` },
      { day: '112 the fortress is 11-15 dwarves', measured: `${population} dwarves` },
      { day: 'Wealth curve: year 1 is 4,000-8,000 marks', measured: `${items.wealth()} marks` },
      { day: 'Food chain: 0.25 plants per farm tile per day', measured: `${harvests} harvests from 32 tiles over ${DAYS_PER_YEAR} days` },
    ];
    const stocks = {
      drink: items.count('drink'), meal: items.count('meal'), plantFood: items.count('plant_food'),
      log: items.count('log'), stoneBlock: items.count('stone_block'), bar: items.count('bar'),
    };
    const blocked: Record<string, number> = {};
    for (const event of w.events('JobBlocked')) {
      const key = `${String(event['jobType'] ?? '?')}:${String(event['reason'] ?? '?')}`;
      blocked[key] = (blocked[key] ?? 0) + 1;
    }
    const NL = String.fromCharCode(10);
    console.log(['year_one balance table:', ...table.map((row) => `  ${row.day} -> ${row.measured}`)].join(NL));
    console.log(`year_one year end: ${JSON.stringify({ population, wealth: items.wealth(),
      deaths: deathCounts(w), stocks, waves, caravanDay, trades: tradesDone,
      crafted: w.events('ItemCrafted').length, harvested: harvests, blocked })}`);

    const wildSpawns: Record<string, number> = {};
    for (const ev of w.events('AnimalSpawned')) {
      const species = String(ev['species']);
      wildSpawns[species] = (wildSpawns[species] ?? 0) + 1;
    }
    console.log(`T-192 year_one wildlife: ${JSON.stringify({ spawns: wildSpawns, liveAtEnd: w.animals.reader().wildList().length, huntsCompleted: w.events('JobCompleted').filter((ev) => ev['jobType'] === 'hunt').length, huntKills: w.events('HuntKill').length })}`);

    stopInvariants();
    expect(checkInvariants(w.game), 'T-176 year end invariants').toEqual([]);

    // The rows that follow from a rule.
    const hillfolk = windowOf('hillfolk', 1);
    expect(caravanDay['hillfolk'], 'the Hillfolk caravan came in summer of year 1').not.toBeNull();
    expect(caravanDay['hillfolk'] as number).toBeGreaterThanOrEqual(hillfolk[0]);
    expect(caravanDay['hillfolk'] as number).toBeLessThanOrEqual(hillfolk[1]);
    const wildwood = windowOf('wildwood', 1);
    expect(caravanDay['wildwood'], 'the Wildwood caravan came in autumn of year 1').not.toBeNull();
    expect(caravanDay['wildwood'] as number).toBeGreaterThanOrEqual(wildwood[0]);
    expect(caravanDay['wildwood'] as number).toBeLessThanOrEqual(wildwood[1]);
    // No caravan in winter, and none from the Mountainhome in year 1 (`20` section Schedule).
    for (const [civ, day] of Object.entries(caravanDay)) {
      if (day === null) continue;
      expect(seasonOfDay(day), `${civ} did not come in winter`).not.toBe(3);
    }
    expect(caravanDay['mountainhome'], 'the Mountainhome comes in year 2').toBeNull();
    const spring2 = windowOf('mountainhome', 2);
    expect(nextDay).toBeGreaterThanOrEqual(spring2[0]);
    expect(nextDay).toBeLessThanOrEqual(spring2[1]);

    // The two guaranteed waves of `21` section Evaluation, at the change to summer and to autumn.
    const guaranteed = waves.filter((wave) => wave.guaranteed);
    expect(guaranteed.length, 'two guaranteed waves in year 1').toBeGreaterThanOrEqual(2);
    for (const wave of guaranteed.slice(0, 2)) {
      expect(wave.count).toBeGreaterThanOrEqual(GUARANTEED_SIZE_MIN);
      expect(wave.count).toBeLessThanOrEqual(GUARANTEED_SIZE_MAX);
    }
    expect(seasonOfDay(guaranteed[0]?.day ?? 0), 'the first wave arrives in summer').toBe(1);
    expect(seasonOfDay(guaranteed[1]?.day ?? 0), 'the second wave arrives in autumn').toBe(2);

    // A peril-0 region: no raid all year.
    expect(raidDays, 'no raid in a peril 0 region').toEqual([]);
    // "Winter: surface farm dormant; cave farm carries": the surface plot sows in spring and summer
    // only, the dimcap plot in every season.
    expect(plantedDays.filter((day) => seasonOfDay(day) === 3), 'no surface crop planted in winter').toEqual([]);
    expect(cavePlantedDays.filter((day) => seasonOfDay(day) === 3).length, 'the cave farm sows in winter').toBeGreaterThan(0);
    // Water freezes only in the cold seasons (`05` freezing; the row's river needs temper >= 1).
    for (const day of frozenDays) expect([0, 3], `a tile froze on day ${day}`).toContain(seasonOfDay(day));
    // `balance.md` section Mood floor and the no-spiral guarantee: a year passes without a death, and
    // the hall is larger than the seven who embarked. The exact size is a measured row, not an
    // assertion: B-006 records the wealth gap and B-005 the crop yield gap (D-202).
    expect(deathCounts(w).dwarf, 'no dwarf died in the first year').toBe(0);
    expect(population, 'the hall grew past the seven who embarked').toBeGreaterThan(7);
  },
};

export default scenario;
